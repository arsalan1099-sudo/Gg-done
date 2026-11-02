import {logSaudiError} from "./saudiLog";
import type { Express } from "express";
import crypto from "node:crypto";
import {sendSaudiPage} from "./saudiCsp";
import rateLimit from "express-rate-limit";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { sellerEnquiries } from "@shared/schema";
import { SAUDI_CITIES, SAUDI_CATEGORIES, validateSaudiEnquiry, REFERRAL_PERCENT } from "./saudiRules";
import { registerSaudiAdmin } from "./saudiAdmin";
import { registerSaudiVendor } from "./saudiVendor";
import { registerSaudiDataRights } from "./saudiDataRights";
import { registerSaudiCatalog } from "./saudiCatalog";

// This Saudi launch slice is intentionally fail-closed. It reuses the original
// Go Bharat codebase without exposing INR checkout, payouts, or Indian write APIs.
export function registerSaudiMarket(app: Express): void {
  registerSaudiAdmin(app);
  registerSaudiVendor(app);
  registerSaudiDataRights(app);
  registerSaudiCatalog(app);
  const sendLanding = (_req: any, res: any) => {
    return sendSaudiPage(res,"go-saudi.html");
  };
  app.get("/", sendLanding);
  app.get("/sell", sendLanding);

  app.get("/api/saudi/market", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      brand: "Go Saudi", country: "SA", currency: "SAR",
      languages: ["ar", "en"], cities: SAUDI_CITIES,
      categories: SAUDI_CATEGORIES,
      status: "PRELAUNCH", paymentsEnabled: false,
      sellerEnquiriesOpen: process.env.NODE_ENV!=="production" || process.env.GO_SAUDI_PRIVACY_APPROVED==="true",
      membershipPriceSar: null, referralPercentProposed: REFERRAL_PERCENT,
      note: "Membership pricing and any commission require approval. No payments accepted."
    });
  });

  app.get("/api/saudi/readiness", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const privacyApproved=process.env.GO_SAUDI_PRIVACY_APPROVED==="true";
    const adminConfigured=/^[0-9a-f]{64}$/i.test(process.env.GO_SAUDI_ADMIN_TOKEN_SHA256||"");
    const httpsOriginConfigured=(()=>{
      try{const u=new URL(process.env.APP_PUBLIC_URL||"");return u.protocol==="https:"&&u.pathname==="/"&&!u.search&&!u.hash;}
      catch{return false;}
    })();
    res.json({
      market:"go-saudi",mode:"PRELAUNCH",commercialLaunchReady:false,
      liveOrders:false,livePayments:false,publicProducts:process.env.GO_SAUDI_CATALOG_PUBLIC==="true" && process.env.GO_SAUDI_PRIVACY_APPROVED==="true" && process.env.GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED==="true",
      vendorPanel:"DRAFT_AND_CATALOG_REVIEW",vendorAuthentication:"ADMIN_INVITE_ONLY",
      onboardingDatabaseConfigured:Boolean(process.env.DATABASE_URL),
      technicalConfiguration:{
        saudiMode:process.env.GO_SAUDI_MODE==="true",
        adminSecretConfigured:adminConfigured,
        publicHttpsOriginConfigured:httpsOriginConfigured,
        sellerPrivacyApprovalRecorded:privacyApproved,
        sellerEnquiriesOpen:process.env.NODE_ENV!=="production"||privacyApproved
      },
      remainingReleaseGates:[
        "Saudi privacy notice and PDPL cross-border/hosting review",
        "Legal Saudi merchant identity, company and store verification",
        "Individual admin MFA, Saudi merchant OTP and account recovery",
        "Licensed Saudi payment gateway including mada and reconciliation",
        "Applicable ZATCA VAT/invoicing, customer terms, refunds and delivery",
        "External security test, restore exercise and live device smoke tests"
      ]
    });
  });

  const enquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many enquiries. Try again later." }
  });
  app.post("/api/saudi/seller-enquiries", enquiryLimiter, async (req, res) => {
    // No personal data collection in production until legal privacy documents,
    // retention/deletion process and Saudi cross-border/hosting review are signed off.
    if(process.env.NODE_ENV==="production" && process.env.GO_SAUDI_PRIVACY_APPROVED!=="true")
      return res.status(503).json({error:"Seller enquiries are closed pending privacy readiness"});
    if (req.body?.website) return res.json({success:true}); // bot honeypot
    const parsed = validateSaudiEnquiry(req.body && typeof req.body === "object" ? req.body : {});
    if (!parsed.valid) return res.status(400).json({error:"Valid seller name, Saudi city, category, Saudi mobile and consent required."});
    try {
      const inserted = await db.transaction(async(tx)=>{
        // Serialize same Saudi mobile/business submissions so a burst of
        // concurrent requests cannot create duplicate admin applications.
        const fingerprint=crypto.createHash("sha256")
          .update(parsed.phone!+"\\0"+parsed.businessName.toLocaleLowerCase("en")).digest("hex");
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${fingerprint}))`);
        const [existing] = await tx.select({id:sellerEnquiries.id})
          .from(sellerEnquiries).where(and(
            eq(sellerEnquiries.source, "SAUDI_LANDING"),
            eq(sellerEnquiries.phone, parsed.phone!),
            eq(sellerEnquiries.businessName, parsed.businessName),
            gte(sellerEnquiries.createdAt, new Date(Date.now() - 86400000))
          )).limit(1);
        if(existing)return false;
        await tx.insert(sellerEnquiries).values({
          id:"SL_"+crypto.randomBytes(15).toString("hex"),
          businessName:parsed.businessName, city:parsed.city, category:parsed.category,
          phone:parsed.phone!, consent:true, status:"NEW", source:"SAUDI_LANDING"
        });
        return true;
      });
      res.setHeader("Cache-Control", "no-store");
      if(!inserted)return res.json({success:true, deduplicated:true});
      return res.status(201).json({success:true});
    } catch (err) {
      logSaudiError("SAUDI_LEAD",err);
      return res.status(503).json({error:"Enquiry service unavailable. No submission was saved."});
    }
  });

  // Other write APIs are Indian-origin and cannot be exposed as working Saudi
  // commerce without complete KSA business-logic/payment/auth migration.
  app.use("/api", (req, res, next) => {
    // Existing Go Bharat endpoints are India-specific. Only Saudi APIs and
    // deployment health are enabled until the full migration has passed review.
    if (req.path === "/health") return next();
    res.status(423).json({error:"Go Saudi is in prelaunch. Legacy Indian commerce APIs are disabled."});
  });

  // Prevent accidental exposure of the inherited Go Bharat mobile/admin
  // SPA paths in the Saudi preview. Only the Saudi landing, seller form and
  // protected admin page (registered above) are public pages.
  app.use((req, res, next) => {
    if (req.path === "/api/health") return next();
    return res.status(404).send("Go Saudi page not available in prelaunch.");
  });
}
