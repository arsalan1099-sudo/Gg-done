import type { Express, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { sellerEnquiries, saudiSellerReviewEvents } from "@shared/schema";
import { isSaudiLeadStatus, reviewTransition, SAUDI_LEAD_STATUSES } from "./saudiAdminRules";

const SOURCE = "SAUDI_LANDING";
const ID_REGEX = /^SL_[a-f0-9]{30}$/;
const SAFE_ADMIN_TOKEN = /^Bearer ([a-zA-Z0-9_-]{32,128})$/;
function adminKeyConfigured(): boolean {
  return /^[0-9a-f]{64}$/i.test(process.env.GO_SAUDI_ADMIN_TOKEN_SHA256 || "");
}
function secureAdminAccess(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  if (!adminKeyConfigured()) {
    return res.status(503).json({error:"Saudi admin is not configured; access disabled."});
  }
  const auth = SAFE_ADMIN_TOKEN.exec(req.header("Authorization") || "");
  if (!auth) return res.status(401).json({error:"Admin access token required."});
  const given = crypto.createHash("sha256").update(auth[1], "utf8").digest();
  const expected = Buffer.from(process.env.GO_SAUDI_ADMIN_TOKEN_SHA256!, "hex");
  if (!crypto.timingSafeEqual(given, expected))
    return res.status(401).json({error:"Invalid admin access token."});
  next();
}
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 80,
  standardHeaders: true, legacyHeaders: false,
  message:{error:"Too many admin requests. Try later."}
});
function sendNoStore(res: Response) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
}

export function registerSaudiAdmin(app: Express): void {
  // The login shell is public, but ALL data & mutations require a long random
  // bearer token whose SHA-256 hash is stored in the server environment.
  app.get("/saudi-admin", (_req,res)=>{
    sendNoStore(res);
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    return res.sendFile(path.resolve(process.cwd(),"server/templates/go-saudi-admin.html"));
  });
  // Do not expose the original India admin screen on the Saudi branch.
  app.get("/admin", (_req,res)=>res.redirect(302,"/saudi-admin"));

  app.use("/api/saudi/admin", adminLimiter, secureAdminAccess);

  app.get("/api/saudi/admin/seller-enquiries", async (req,res)=>{
    try {
      const rawStatus = typeof req.query.status === "string" ? req.query.status : "ALL";
      if (rawStatus !== "ALL" && !isSaudiLeadStatus(rawStatus))
        return res.status(400).json({error:"Invalid status filter."});
      const pageRaw = Number(req.query.page ?? "1");
      if (!Number.isInteger(pageRaw) || pageRaw < 1 || pageRaw > 10000)
        return res.status(400).json({error:"Invalid page."});
      const limit = 50;
      const filter = rawStatus === "ALL"
        ? eq(sellerEnquiries.source,SOURCE)
        : and(eq(sellerEnquiries.source,SOURCE),eq(sellerEnquiries.status,rawStatus));
      const [leads, totalRows, counts] = await Promise.all([
        db.select({
          id:sellerEnquiries.id, businessName:sellerEnquiries.businessName,
          city:sellerEnquiries.city, category:sellerEnquiries.category,
          phone:sellerEnquiries.phone, consent:sellerEnquiries.consent,
          status:sellerEnquiries.status, source:sellerEnquiries.source,
          createdAt:sellerEnquiries.createdAt, updatedAt:sellerEnquiries.updatedAt
        }).from(sellerEnquiries).where(filter).orderBy(desc(sellerEnquiries.createdAt))
          .limit(limit).offset((pageRaw-1)*limit),
        db.select({n:sql<number>`count(*)::int`}).from(sellerEnquiries).where(filter),
        db.select({status:sellerEnquiries.status,n:sql<number>`count(*)::int`})
          .from(sellerEnquiries).where(eq(sellerEnquiries.source,SOURCE)).groupBy(sellerEnquiries.status)
      ]);
      sendNoStore(res);
      return res.json({
        leads, pagination:{page:pageRaw,perPage:limit,total:totalRows[0]?.n||0},
        statuses:SAUDI_LEAD_STATUSES,
        summary:Object.fromEntries(SAUDI_LEAD_STATUSES.map(status=>
          [status,counts.find(c=>c.status===status)?.n||0])),
        note:"APPROVED means onboarding reviewed, NOT store live. No payments or selling are enabled."
      });
    } catch (err) {
      console.error("[SAUDI_ADMIN] Lead listing failed",err);
      return res.status(503).json({error:"Seller enquiries are temporarily unavailable."});
    }
  });

  app.get("/api/saudi/admin/seller-enquiries/:id/events", async (req,res)=>{
    const id=String(req.params.id||"");
    if (!ID_REGEX.test(id)) return res.status(400).json({error:"Invalid seller enquiry identifier."});
    try {
      const [lead] = await db.select({id:sellerEnquiries.id}).from(sellerEnquiries)
        .where(and(eq(sellerEnquiries.id,id),eq(sellerEnquiries.source,SOURCE))).limit(1);
      if (!lead) return res.status(404).json({error:"Seller enquiry not found."});
      const events=await db.select().from(saudiSellerReviewEvents)
        .where(eq(saudiSellerReviewEvents.enquiryId,id))
        .orderBy(desc(saudiSellerReviewEvents.createdAt)).limit(100);
      sendNoStore(res);
      return res.json({events});
    } catch(err) {
      console.error("[SAUDI_ADMIN] Review history read failed",err);
      return res.status(503).json({error:"Review history unavailable."});
    }
  });

  app.patch("/api/saudi/admin/seller-enquiries/:id", async(req,res)=>{
    const id=String(req.params.id||"");
    if(!ID_REGEX.test(id)) return res.status(400).json({error:"Invalid seller enquiry identifier."});
    if (!req.is("application/json")) return res.status(415).json({error:"JSON required."});
    try{
      const [before]=await db.select({id:sellerEnquiries.id,status:sellerEnquiries.status})
        .from(sellerEnquiries)
        .where(and(eq(sellerEnquiries.id,id),eq(sellerEnquiries.source,SOURCE))).limit(1);
      if(!before)return res.status(404).json({error:"Saudi seller enquiry not found."});
      const decision=reviewTransition(before.status,req.body?.status,req.body?.note,req.body?.checks);
      if(!decision.ok)return res.status(400).json({error:decision.error});
      const reviewer=(process.env.GO_SAUDI_ADMIN_REVIEWER || "Saudi admin").slice(0,80);
      const result=await db.transaction(async(tx)=>{
        // Compare-and-set prevents two concurrent reviewers from silently
        // approving an outdated status. Event insertion is in same transaction.
        const [updated]=await tx.update(sellerEnquiries)
          .set({status:decision.to,updatedAt:new Date()})
          .where(and(eq(sellerEnquiries.id,id),
             eq(sellerEnquiries.source,SOURCE),eq(sellerEnquiries.status,decision.from)))
          .returning({id:sellerEnquiries.id,status:sellerEnquiries.status,updatedAt:sellerEnquiries.updatedAt});
        if(!updated)return null;
        await tx.insert(saudiSellerReviewEvents).values({
          id:"SR_"+crypto.randomBytes(15).toString("hex"),
          enquiryId:id,fromStatus:decision.from,toStatus:decision.to,
          reviewer,note:decision.note,
          phoneConfirmed:decision.checks.phoneConfirmed,
          businessDocumentsChecked:decision.checks.businessDocumentsChecked,
          complianceReviewed:decision.checks.complianceReviewed
        });
        return updated;
      });
      if(!result)return res.status(409).json({error:"Status changed. Refresh before updating."});
      sendNoStore(res);
      return res.json({success:true,lead:result,storeLive:false,
        note:"Approval records onboarding review only; shop activation and payments remain disabled."});
    }catch(err){
      console.error("[SAUDI_ADMIN] Review write failed",err);
      return res.status(503).json({error:"Could not update seller review."});
    }
  });
}
