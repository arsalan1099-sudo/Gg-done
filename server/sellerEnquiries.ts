import type { Express } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { sellerEnquiries } from "@shared/schema";
import { requireAuth, requireRole } from "./auth";

import { normalizeSellerPhone, validSellerEnquiry } from "./sellerLeadRules";
const statuses = new Set(["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "NOT_INTERESTED"]);

export function registerSellerEnquiryRoutes(app: Express): void {
  const submitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5,
    standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many enquiries from this connection. Please contact support directly." },
  });

  app.post("/api/seller-enquiries", submitLimiter, async (req, res) => {
    try {
      // Honeypot trap is not shown to human applicants.
      if (req.body?.website) return res.json({ success: true });
      const businessName = String(req.body?.businessName || "").trim();
      const city = String(req.body?.city || "").trim();
      const category = String(req.body?.category || "").trim();
      if (req.body?.consent !== true) return res.status(400).json({ error: "Consent to business follow-up is required" });
      if (!validSellerEnquiry({
        businessName: req.body?.businessName,
        city: req.body?.city,
        category: req.body?.category,
        phone: req.body?.phone,
        consent: req.body?.consent
      })) {
        return res.status(400).json({ error: "Please enter valid business, city, category and 10-digit Indian mobile number" });
      }
      const phone = normalizeSellerPhone(req.body.phone)!;
      const [recent] = await db.select({ id: sellerEnquiries.id }).from(sellerEnquiries)
        .where(and(eq(sellerEnquiries.phone, phone), eq(sellerEnquiries.businessName, businessName),
          gte(sellerEnquiries.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
        .limit(1);
      if (recent) return res.json({ success: true, deduplicated: true });
      await db.insert(sellerEnquiries).values({
        id: "SL_" + crypto.randomBytes(15).toString("hex"),
        businessName, city, category, phone, consent: true,
        status: "NEW", source: "SELL_LANDING"
      });
      res.setHeader("Cache-Control", "no-store");
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("[SELLER_ENQUIRY] Could not save enquiry", error);
      res.status(500).json({ error: "Enquiry unavailable. You can still contact Go Bharat by phone or WhatsApp." });
    }
  });

  app.get("/api/admin/seller-enquiries", requireAuth, requireRole("SUPER_ADMIN"), async (_req,res) => {
    try {
      const rows = await db.select().from(sellerEnquiries)
        .orderBy(desc(sellerEnquiries.createdAt)).limit(250);
      const summary = Object.fromEntries([...statuses].map(status => [status, rows.filter(r => r.status === status).length]));
      res.setHeader("Cache-Control", "no-store");
      res.json({ enquiries: rows, summary, note: "Lead count is not payment revenue. Showing at most 250 recent enquiries." });
    } catch (error) {
      console.error("[SELLER_ENQUIRY] Admin lookup failed", error);
      res.status(500).json({ error: "Unable to retrieve seller enquiries" });
    }
  });

  app.patch("/api/admin/seller-enquiries/:id", requireAuth, requireRole("SUPER_ADMIN"), async (req,res) => {
    try {
      const id = String(req.params.id || "");
      const status = String(req.body?.status || "");
      if (!/^SL_[a-f0-9]{30}$/.test(id) || !statuses.has(status)) {
        return res.status(400).json({ error: "Invalid enquiry or status" });
      }
      const [updated] = await db.update(sellerEnquiries)
        .set({ status, updatedAt: new Date() })
        .where(eq(sellerEnquiries.id, id)).returning({ id: sellerEnquiries.id, status: sellerEnquiries.status });
      if (!updated) return res.status(404).json({ error: "Enquiry not found" });
      res.setHeader("Cache-Control", "no-store");
      res.json({ success: true, enquiry: updated });
    } catch (error) {
      console.error("[SELLER_ENQUIRY] Status update failed", error);
      res.status(500).json({ error: "Unable to update enquiry" });
    }
  });
}
