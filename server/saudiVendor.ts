import type { Express, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import {sendSaudiPage} from "./saudiCsp";
import rateLimit from "express-rate-limit";
import {and, eq, gt, isNull, sql, desc} from "drizzle-orm";
import {db} from "./db";
import {sellerEnquiries,saudiVendorAccounts,saudiVendorInvites,saudiVendorSessions,saudiVendorDraftProducts} from "@shared/schema";
import {draftProduct,safeShopDescription,safeVendorToken,sha256Token,SAUDI_DRAFT_LIMIT} from "./saudiVendorRules";

const SOURCE="SAUDI_LANDING";
const leadIdPattern=/^SL_[a-f0-9]{30}$/;
const productIdPattern=/^SVP_[a-f0-9]{30}$/;
const inviteHours=24;
const sessionHours=12;
const COOKIE_NAME="__Host-go_saudi_vendor";
const COOKIE_FLAGS="Path=/; HttpOnly; Secure; SameSite=Strict";
const clearVendorCookie=(res:Response)=>res.setHeader("Set-Cookie",COOKIE_NAME+"=; "+COOKIE_FLAGS+"; Max-Age=0");
const randomId=(prefix:string)=>prefix+crypto.randomBytes(15).toString("hex");
const randomToken=()=>crypto.randomBytes(32).toString("hex");
const noCache=(res:Response)=>{
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("Pragma","no-cache");
};
const vendorLimiter=rateLimit({windowMs:15*60*1000,max:120,standardHeaders:true,legacyHeaders:false,message:{error:"Too many vendor requests"}});
const inviteLimiter=rateLimit({windowMs:15*60*1000,max:12,standardHeaders:true,legacyHeaders:false,message:{error:"Too many activation attempts"}});

async function vendorAuthorized(req:Request,res:Response,next:NextFunction) {
  noCache(res);
  const rawCookie=req.header("Cookie")||"";
  if(rawCookie.length>4096)return res.status(401).json({error:"Vendor session required"});
  const tokens=[...rawCookie.matchAll(/(?:^|;\s*)__Host-go_saudi_vendor=([a-f0-9]{64})(?=;|$)/g)];
  if(tokens.length!==1)return res.status(401).json({error:"Vendor session required"});
  // Cookies can be sent cross-site; explicitly require same-origin Origin on
  // mutating requests, in addition to Secure, HttpOnly and SameSite=Strict.
  if(["POST","PUT","PATCH","DELETE"].includes(req.method)){
    const expected=process.env.NODE_ENV==="production"
      ? new URL(process.env.APP_PUBLIC_URL||"https://invalid.invalid").origin
      : "http://"+req.get("host");
    if(!req.header("Origin")||req.header("Origin")!==expected)
      return res.status(403).json({error:"Same-origin vendor request required"});
  }
  try {
    const [row]=await db.select({
      id:saudiVendorSessions.id,vendorId:saudiVendorSessions.vendorId,
      enquiryId:saudiVendorAccounts.enquiryId
    }).from(saudiVendorSessions)
      .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiVendorSessions.vendorId))
      .innerJoin(sellerEnquiries,and(eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId),
        eq(sellerEnquiries.source,SOURCE),eq(sellerEnquiries.status,"APPROVED")))
      .where(and(eq(saudiVendorSessions.tokenHash,sha256Token(tokens[0][1])),
        isNull(saudiVendorSessions.revokedAt),gt(saudiVendorSessions.expiresAt,new Date())))
      .limit(1);
    if(!row)return res.status(401).json({error:"Session expired or seller no longer approved"});
    res.locals.saudiVendor={id:row.vendorId,enquiryId:row.enquiryId,sessionId:row.id};
    next();
  }catch(err){console.error("[SAUDI_VENDOR_AUTH] Query error",err);
    return res.status(503).json({error:"Vendor authentication temporarily unavailable"});}
}
const requestVendor=(res:Response)=>res.locals.saudiVendor as {id:string;enquiryId:string;sessionId:string};

export function registerSaudiVendor(app:Express):void{
  app.get("/vendor",(_req,res)=>sendSaudiPage(res,"go-saudi-vendor.html"));
  app.get("/vendor-panel",(_req,res)=>res.redirect(302,"/vendor"));

  // Admin route executes AFTER registerSaudiAdmin installed its auth middleware.
  // Seller enquiry approval is NOT seller login; admin must issue a one-time invitation.
  app.post("/api/saudi/admin/vendor-invites",async(req,res)=>{
    noCache(res);
    const id=req.body?.enquiryId;
    if(typeof id!=="string"||!leadIdPattern.test(id))
      return res.status(400).json({error:"Valid Saudi enquiry ID required"});
    try{
      const [lead]=await db.select({id:sellerEnquiries.id,businessName:sellerEnquiries.businessName})
        .from(sellerEnquiries)
        .where(and(eq(sellerEnquiries.id,id),eq(sellerEnquiries.source,SOURCE),eq(sellerEnquiries.status,"APPROVED"))).limit(1);
      if(!lead)return res.status(403).json({error:"Seller must have APPROVED Saudi onboarding review"});
      const token=randomToken(),hash=sha256Token(token);
      const result=await db.transaction(async(tx)=>{
        await tx.insert(saudiVendorAccounts).values({
          id:randomId("SV_"),enquiryId:lead.id
        }).onConflictDoNothing({target:saudiVendorAccounts.enquiryId});
        const [vendor]=await tx.select({id:saudiVendorAccounts.id})
          .from(saudiVendorAccounts).where(eq(saudiVendorAccounts.enquiryId,id)).limit(1);
        if(!vendor)throw new Error("Vendor account creation failed");
        // Issuing a new invitation invalidates outstanding old invitations.
        await tx.update(saudiVendorInvites).set({consumedAt:new Date()})
          .where(and(eq(saudiVendorInvites.vendorId,vendor.id),
            isNull(saudiVendorInvites.consumedAt)));
        await tx.insert(saudiVendorInvites).values({
          id:randomId("SVI_"),vendorId:vendor.id,tokenHash:hash,
          expiresAt:new Date(Date.now()+inviteHours*60*60*1000)
        });
        return vendor;
      });
      return res.status(201).json({
        vendorId:result.id,inviteToken:token,expiresInHours:inviteHours,
        delivery:"Share privately with approved merchant after out-of-band identity check. Never put in a URL.",
        storeLive:false
      });
    }catch(err){console.error("[SAUDI_VENDOR] Invite creation",err);
      return res.status(503).json({error:"Could not create invitation"});}
  });

  app.post("/api/saudi/admin/vendor-sessions/revoke",async(req,res)=>{
    noCache(res);
    const id=req.body?.enquiryId;
    if(typeof id!=="string"||!leadIdPattern.test(id))return res.status(400).json({error:"Invalid enquiry ID"});
    try {
      const [vendor]=await db.select({id:saudiVendorAccounts.id})
        .from(saudiVendorAccounts)
        .innerJoin(sellerEnquiries,and(eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId),eq(sellerEnquiries.source,SOURCE)))
        .where(eq(saudiVendorAccounts.enquiryId,id)).limit(1);
      if(!vendor)return res.status(404).json({error:"Vendor account not found"});
      await db.transaction(async tx=>{
        await tx.update(saudiVendorSessions).set({revokedAt:new Date()})
          .where(and(eq(saudiVendorSessions.vendorId,vendor.id),isNull(saudiVendorSessions.revokedAt)));
        await tx.update(saudiVendorInvites).set({consumedAt:new Date()})
          .where(and(eq(saudiVendorInvites.vendorId,vendor.id),isNull(saudiVendorInvites.consumedAt)));
      });
      return res.json({success:true});
    }catch(err){console.error("[SAUDI_VENDOR] Revoke",err);return res.status(503).json({error:"Could not revoke vendor sessions"});}
  });

  // No Saudi phone OTP provider is configured. One-time admin-issued invitation
  // is intentionally required until a compliant identity and login system exists.
  app.post("/api/saudi/vendor/activate",inviteLimiter,async(req,res)=>{
    noCache(res);
    const token=req.body?.inviteToken;
    if(!safeVendorToken(token))return res.status(400).json({error:"Valid one-time invitation required"});
    try {
      const sessionToken=randomToken();
      const created=await db.transaction(async tx=>{
        const [invite]=await tx.select({id:saudiVendorInvites.id,vendorId:saudiVendorInvites.vendorId})
          .from(saudiVendorInvites)
          .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiVendorInvites.vendorId))
          .innerJoin(sellerEnquiries,and(eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId),
            eq(sellerEnquiries.source,SOURCE),eq(sellerEnquiries.status,"APPROVED")))
          .where(and(eq(saudiVendorInvites.tokenHash,sha256Token(token)),
            isNull(saudiVendorInvites.consumedAt),gt(saudiVendorInvites.expiresAt,new Date()))).limit(1);
        if(!invite)return false;
        const [used]=await tx.update(saudiVendorInvites).set({consumedAt:new Date()})
          .where(and(eq(saudiVendorInvites.id,invite.id),isNull(saudiVendorInvites.consumedAt),
            gt(saudiVendorInvites.expiresAt,new Date()))).returning({id:saudiVendorInvites.id});
        if(!used)return false;
        await tx.insert(saudiVendorSessions).values({
          id:randomId("SVS_"),vendorId:invite.vendorId,
          tokenHash:sha256Token(sessionToken),
          expiresAt:new Date(Date.now()+sessionHours*60*60*1000)
        });
        return true;
      });
      if(!created)return res.status(401).json({error:"Invitation expired, used, or seller approval revoked"});
      res.setHeader("Set-Cookie",COOKIE_NAME+"="+sessionToken+"; "+COOKIE_FLAGS+
        "; Max-Age="+(sessionHours*60*60));
      return res.json({activated:true,expiresInHours:sessionHours,mode:"DRAFT_ONLY"});
    }catch(err){console.error("[SAUDI_VENDOR] Activate",err);
      return res.status(503).json({error:"Vendor activation unavailable"});}
  });

  app.use("/api/saudi/vendor",vendorLimiter,vendorAuthorized);

  app.get("/api/saudi/vendor/me",async(_req,res)=>{
    noCache(res);
    const v=requestVendor(res);
    try {
      const [store]=await db.select({
        accountId:saudiVendorAccounts.id,businessName:sellerEnquiries.businessName,
        city:sellerEnquiries.city,category:sellerEnquiries.category,
        phone:sellerEnquiries.phone,description:saudiVendorAccounts.description
      }).from(saudiVendorAccounts)
        .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
        .where(eq(saudiVendorAccounts.id,v.id)).limit(1);
      if(!store)return res.status(404).json({error:"Seller store missing"});
      const [counter]=await db.select({count:sql<number>`count(*)::int`})
        .from(saudiVendorDraftProducts).where(eq(saudiVendorDraftProducts.vendorId,v.id));
      return res.json({store:{...store,status:"DRAFT",storeLive:false},
        counts:{products:counter?.count||0,orders:0},currency:"SAR",mode:"PRELAUNCH",
        paymentsEnabled:false,ordersEnabled:false,
        note:"Approved onboarding review grants draft editing only. No public store or buyer orders."});
    }catch(err){console.error("[SAUDI_VENDOR] Store lookup",err);return res.status(503).json({error:"Store unavailable"});}
  });

  app.patch("/api/saudi/vendor/store",async(req,res)=>{
    noCache(res);
    const desc=safeShopDescription(req.body?.description);
    if(desc===null)return res.status(400).json({error:"Store description must be 600 characters or fewer"});
    try{
      const [updated]=await db.update(saudiVendorAccounts)
        .set({description:desc,updatedAt:new Date()})
        .where(eq(saudiVendorAccounts.id,requestVendor(res).id))
        .returning({description:saudiVendorAccounts.description});
      return res.json({success:!!updated,store:updated,storeLive:false});
    }catch(err){console.error("[SAUDI_VENDOR] Store update",err);return res.status(503).json({error:"Could not save description"});}
  });

  app.get("/api/saudi/vendor/products",async(_req,res)=>{
    noCache(res);
    try{
      const products=await db.select({
        id:saudiVendorDraftProducts.id,title:saudiVendorDraftProducts.title,
        description:saudiVendorDraftProducts.description,
        priceHalalas:saudiVendorDraftProducts.priceHalalas,
        stock:saudiVendorDraftProducts.stock,status:saudiVendorDraftProducts.status,
        updatedAt:saudiVendorDraftProducts.updatedAt
      }).from(saudiVendorDraftProducts)
      .where(eq(saudiVendorDraftProducts.vendorId,requestVendor(res).id))
      .orderBy(desc(saudiVendorDraftProducts.updatedAt)).limit(SAUDI_DRAFT_LIMIT);
      return res.json({products,currency:"SAR",allDrafts:true});
    }catch(err){console.error("[SAUDI_VENDOR] Products lookup",err);return res.status(503).json({error:"Could not load drafts"});}
  });

  app.post("/api/saudi/vendor/products",async(req,res)=>{
    noCache(res);
    const parsed=draftProduct(req.body);
    if(!parsed.ok)return res.status(400).json({error:parsed.error});
    const vendorId=requestVendor(res).id;
    try{
      const product=await db.transaction(async tx=>{
        // Serializes concurrent additions for the same vendor, enforcing the cap.
        const [locked]=await tx.select({id:saudiVendorAccounts.id})
          .from(saudiVendorAccounts)
          .where(eq(saudiVendorAccounts.id,vendorId)).for("update").limit(1);
        if(!locked)throw new Error("Vendor account unavailable");
        const [counter]=await tx.select({n:sql<number>`count(*)::int`})
          .from(saudiVendorDraftProducts).where(eq(saudiVendorDraftProducts.vendorId,vendorId));
        if((counter?.n||0)>=SAUDI_DRAFT_LIMIT)return null;
        const [created]=await tx.insert(saudiVendorDraftProducts)
          .values({id:randomId("SVP_"),vendorId,...parsed.value,status:"DRAFT"})
          .returning({id:saudiVendorDraftProducts.id,title:saudiVendorDraftProducts.title,
            description:saudiVendorDraftProducts.description,priceHalalas:saudiVendorDraftProducts.priceHalalas,
            stock:saudiVendorDraftProducts.stock,status:saudiVendorDraftProducts.status});
        return created;
      });
      if(!product)return res.status(409).json({error:"Draft product limit reached"});
      return res.status(201).json({product,public:false});
    }catch(err){console.error("[SAUDI_VENDOR] Add product",err);return res.status(503).json({error:"Could not save draft"});}
  });

  app.patch("/api/saudi/vendor/products/:id",async(req,res)=>{
    noCache(res);
    const id=String(req.params.id||"");
    if(!productIdPattern.test(id))return res.status(400).json({error:"Invalid product id"});
    const parsed=draftProduct(req.body);
    if(!parsed.ok)return res.status(400).json({error:parsed.error});
    try{
      const [product]=await db.update(saudiVendorDraftProducts)
        .set({...parsed.value,updatedAt:new Date()})
        .where(and(eq(saudiVendorDraftProducts.id,id),
          eq(saudiVendorDraftProducts.vendorId,requestVendor(res).id),
          eq(saudiVendorDraftProducts.status,"DRAFT")))
        .returning({id:saudiVendorDraftProducts.id,title:saudiVendorDraftProducts.title,
          description:saudiVendorDraftProducts.description,priceHalalas:saudiVendorDraftProducts.priceHalalas,
          stock:saudiVendorDraftProducts.stock,status:saudiVendorDraftProducts.status});
      if(!product)return res.status(404).json({error:"Draft not found"});
      return res.json({product,public:false});
    }catch(err){console.error("[SAUDI_VENDOR] Update draft",err);return res.status(503).json({error:"Could not update draft"});}
  });

  app.delete("/api/saudi/vendor/products/:id",async(req,res)=>{
    noCache(res);
    const id=String(req.params.id||"");
    if(!productIdPattern.test(id))return res.status(400).json({error:"Invalid product id"});
    try{
      const [deleted]=await db.delete(saudiVendorDraftProducts)
        .where(and(eq(saudiVendorDraftProducts.id,id),
          eq(saudiVendorDraftProducts.vendorId,requestVendor(res).id),
          eq(saudiVendorDraftProducts.status,"DRAFT")))
        .returning({id:saudiVendorDraftProducts.id});
      if(!deleted)return res.status(404).json({error:"Draft not found"});
      return res.json({deleted:true});
    }catch(err){console.error("[SAUDI_VENDOR] Delete draft",err);return res.status(503).json({error:"Could not delete draft"});}
  });

  app.post("/api/saudi/vendor/logout",async(_req,res)=>{
    noCache(res);
    try{
      await db.update(saudiVendorSessions).set({revokedAt:new Date()})
        .where(eq(saudiVendorSessions.id,requestVendor(res).sessionId));
      clearVendorCookie(res);
      return res.json({loggedOut:true});
    }catch(err){console.error("[SAUDI_VENDOR] Logout",err);return res.status(503).json({error:"Session revocation unavailable"});}
  });
}
