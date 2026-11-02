import type { Express } from "express";
import crypto from "node:crypto";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { and, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { sellerEnquiries } from "@shared/schema";
import { SAUDI_CITIES, SAUDI_CATEGORIES, validateSaudiEnquiry, REFERRAL_PERCENT } from "./saudiRules";
import { registerSaudiAdmin } from "./saudiAdmin";

// This Saudi launch slice is intentionally fail-closed. It reuses the original
// Go Bharat codebase without exposing INR checkout, payouts, or Indian write APIs.
export function registerSaudiMarket(app: Express): void {
  registerSaudiAdmin(app);
  const sendLanding = (_req: any, res: any) => {
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(path.resolve(process.cwd(), "server/templates/go-saudi.html"));
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
      membershipPriceSar: null, referralPercentProposed: REFERRAL_PERCENT,
      note: "Membership pricing and any commission require approval. No payments accepted."
    });
  });

  app.get("/api/saudi/readiness", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      mode: "PRELAUNCH", livePayments: false,
      onboardingDatabaseConfigured: Boolean(process.env.DATABASE_URL),
      requiredBeforeLaunch: [
        "Saudi legal entity and e-commerce store verification",
        "Saudi-ready authentication, registration and tax/compliance flows",
        "ZATCA VAT / invoicing rules and privacy/legal documents",
        "Licensed gateway onboarding, signed webhooks, settlement reconciliation",
        "Arabic RTL UX and all India-only customer/product/admin flows localized",
        "Isolated Saudi database and secrets, integration/security tests"
      ]
    });
  });

  const enquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many enquiries. Try again later." }
  });
  app.post("/api/saudi/seller-enquiries", enquiryLimiter, async (req, res) => {
    if (req.body?.website) return res.json({success:true}); // bot honeypot
    const parsed = validateSaudiEnquiry(req.body && typeof req.body === "object" ? req.body : {});
    if (!parsed.valid) return res.status(400).json({error:"Valid seller name, Saudi city, category, Saudi mobile and consent required."});
    try {
      const [existing] = await db.select({id:sellerEnquiries.id})
        .from(sellerEnquiries).where(and(
          eq(sellerEnquiries.phone, parsed.phone!),
          eq(sellerEnquiries.businessName, parsed.businessName),
          gte(sellerEnquiries.createdAt, new Date(Date.now() - 86400000))
        )).limit(1);
      if (existing) return res.json({success:true, deduplicated:true});
      await db.insert(sellerEnquiries).values({
        id:"SL_"+crypto.randomBytes(15).toString("hex"),
        businessName:parsed.businessName, city:parsed.city, category:parsed.category,
        phone:parsed.phone!, consent:true, status:"NEW", source:"SAUDI_LANDING"
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(201).json({success:true});
    } catch (err) {
      console.error("[SAUDI_LEAD] Lead database unavailable", err);
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
