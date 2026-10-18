import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "./db";
import { vendorApplications, vendorMemberships, teamMembers } from "@shared/schema";
import { requireAuth, requireRole } from "./auth";
import { ANNUAL_PRICE_PAISE, REFERRAL_RATE_PERCENT, referralPaise, isCapturedAnnualPayment } from "./vendorBillingRules";
import { createRazorpayOrder, fetchRazorpayPayment, fetchCapturedRazorpayOrderPayments, getRazorpayKeyId, isRazorpayConfigured, verifyRazorpaySignature } from "./razorpayClient";

// The annual launch offer is charged ONLY by this trusted backend, never from a client amount.
// Referral commission is a reserved liability, not an automatic payout.
const yearMs = 365 * 24 * 60 * 60 * 1000;

function digits10(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(-10);
}
function phoneMatches(phone: string, column: typeof vendorApplications.phone | typeof teamMembers.phone) {
  return or(eq(column, phone), eq(column, "+91" + phone), eq(column, "91" + phone));
}
function isLiveGateway(): boolean {
  // Explicit opt-in: production cannot accept memberships until gateway, terms and review are verified.
  return process.env.VENDOR_MEMBERSHIP_PAYMENTS_ENABLED === "true" &&
    isRazorpayConfigured() && getRazorpayKeyId().startsWith("rzp_live_");
}
function jsonError(res: Response, error: unknown) {
  console.error("[VENDOR_REVENUE]", error);
  return res.status(500).json({ error: "Vendor billing temporarily unavailable" });
}
function publicMembership(row: typeof vendorMemberships.$inferSelect | undefined) {
  if (!row) return { status: "NOT_PURCHASED", active: false };
  const active = row.status === "ACTIVE" && Boolean(row.expiresAt && row.expiresAt > new Date());
  return {
    status: row.status === "ACTIVE" && !active ? "EXPIRED" : row.status,
    active, plan: row.plan, amount: row.amountPaise / 100,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    paymentReference: row.status === "ACTIVE" ? row.razorpayPaymentId : null,
  };
}
async function getMyVendor(phone: string) {
  const [v] = await db.select().from(vendorApplications)
    .where(phoneMatches(phone, vendorApplications.phone))
    .orderBy(desc(vendorApplications.submittedAt)).limit(1);
  return v;
}
async function latestForVendor(vendorId: string) {
  const [row] = await db.select().from(vendorMemberships)
    .where(eq(vendorMemberships.vendorApplicationId, vendorId))
    .orderBy(desc(vendorMemberships.createdAt)).limit(1);
  return row;
}

// One atomic transition per order; a duplicate callback or signed webhook cannot mint a second commission.
async function confirmCaptured(row: typeof vendorMemberships.$inferSelect, payment: any): Promise<boolean> {
  if (!isCapturedAnnualPayment(payment, row.razorpayOrderId, row.amountPaise)) return false;
  if (row.status === "REFUNDED") return false;
  if (row.status === "ACTIVE") return row.razorpayPaymentId === payment.id;

  const paidAt = new Date();
  const changed = await db.update(vendorMemberships)
    .set({ status: "ACTIVE", razorpayPaymentId: payment.id, paidAt, expiresAt: new Date(paidAt.getTime() + yearMs) })
    .where(and(eq(vendorMemberships.id, row.id), eq(vendorMemberships.status, "PENDING")))
    .returning({ id: vendorMemberships.id });
  return changed.length > 0;
}

async function reconcilePendingMembership(row: typeof vendorMemberships.$inferSelect): Promise<{
  latest: typeof vendorMemberships.$inferSelect; gatewayAvailable: boolean
}> {
  if (row.status !== "PENDING") return { latest: row, gatewayAvailable: true };
  const captured = await fetchCapturedRazorpayOrderPayments(row.razorpayOrderId);
  if (captured === null) return { latest: row, gatewayAvailable: false };
  for (const payment of captured) {
    if (await confirmCaptured(row, payment)) break;
  }
  const [latest] = await db.select().from(vendorMemberships).where(eq(vendorMemberships.id, row.id)).limit(1);
  return { latest: latest || row, gatewayAvailable: true };
}

export async function settleVendorMembershipWebhook(payment: any): Promise<void> {
  if (!payment || typeof payment.order_id !== "string") return;
  const [row] = await db.select().from(vendorMemberships)
    .where(eq(vendorMemberships.razorpayOrderId, payment.order_id)).limit(1);
  if (row) await confirmCaptured(row, payment);
}
export async function refundVendorMembershipWebhook(paymentId: unknown): Promise<void> {
  if (typeof paymentId !== "string" || !paymentId) return;
  await db.update(vendorMemberships)
    .set({ status: "REFUNDED", refundedAt: new Date() })
    .where(and(eq(vendorMemberships.razorpayPaymentId, paymentId), eq(vendorMemberships.status, "ACTIVE")));
}

function checkoutPage(orderId: string, amountPaise: number, key: string): string {
  // Values come exclusively from a persisted billing record and the server's public gateway key.
  const safeOrder = JSON.stringify(orderId);
  const safeKey = JSON.stringify(key);
  const amount = Number(amountPaise);
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Go Bharat | Secure Annual Membership</title>',
    '<style>body{font:16px system-ui,sans-serif;background:#0b1d38;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}',
    '.box{max-width:440px;width:calc(100% - 35px);background:#fff;color:#172333;border-radius:20px;padding:28px;box-sizing:border-box;text-align:center}',
    'button{border:0;border-radius:12px;background:#ff7119;color:#fff;padding:14px 25px;font-weight:700;cursor:pointer}',
    'small{color:#64748b}h1{font-size:25px}</style>',
    '<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>',
    '<body><div class="box"><h1>GO BHARAT</h1><p>Annual Vendor Membership</p>',
    '<h1>₹1,000 / year</h1><p id="state">Secure checkout with Razorpay</p>',
    '<button id="pay">Pay ₹1,000</button><p><small>Membership is activated only after bank-confirmed payment.</small></p>',
    '<a href="/vendor-subscription">Return to membership screen</a></div>',
    '<script>',
    'const orderId='+safeOrder+';const key='+safeKey+';const amount='+amount+';',
    'const state=document.getElementById("state");const pay=document.getElementById("pay");',
    'async function verified(r){state.textContent="Verifying payment with gateway...";try{const v=await fetch("/api/vendor-membership/confirm",{method:"POST",headers:{"Content-Type":"application/json"},',
    'body:JSON.stringify({razorpay_order_id:r.razorpay_order_id,razorpay_payment_id:r.razorpay_payment_id,razorpay_signature:r.razorpay_signature})});',
    'const data=await v.json();if(v.ok&&data.paid){state.textContent="Payment verified! Membership activated.";pay.disabled=true;pay.textContent="Paid";}',
    'else{state.textContent=data.error||"Payment not yet captured. Return to the app and check status.";pay.disabled=true;}}',
    'catch(e){state.textContent="Verification pending. Return to the app to check status.";pay.disabled=true;}}',
    'pay.onclick=function(){if(!window.Razorpay){state.textContent="Payment gateway could not load";return;}',
    'const rz=new Razorpay({key:key,amount:amount,currency:"INR",name:"Go Bharat",description:"Annual Vendor Membership",',
    'order_id:orderId,handler:verified,modal:{ondismiss:function(){state.textContent="Checkout closed. No payment confirmed.";}}});',
    'rz.on("payment.failed",function(){state.textContent="Payment failed. No membership activated.";});rz.open();};',
    '</script></body></html>'
  ].join("");
}

export function registerVendorRevenueRoutes(app: Express): void {
  const paymentLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, max: 8,
    standardHeaders: true, legacyHeaders: false,
    message: { error: "Too many payment attempts. Please try later." }
  });
  app.get("/api/vendor-membership/offer", (_req, res) => res.json({
    plan: "ANNUAL", amount: ANNUAL_PRICE_PAISE / 100, currency: "INR",
    onboardingFee: 0, marketingReferralPercent: REFERRAL_RATE_PERCENT,
    gatewayAvailable: isLiveGateway(),
    note: "Other order commissions may apply separately. No payment is charged by visiting this page.",
  }));

  app.get("/api/vendor-membership/status", requireAuth, requireRole("VENDOR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const phone = digits10(req.user?.phone);
      if (phone.length !== 10) return res.status(401).json({ error: "Verified phone required" });
      const vendor = await getMyVendor(phone);
      if (!vendor) return res.status(404).json({ error: "Vendor application not found" });
      res.setHeader("Cache-Control", "no-store");
      const latest = await latestForVendor(vendor.id);
      const resolved = latest ? await reconcilePendingMembership(latest) : null;
      res.json({ vendorStatus: vendor.status, membership: publicMembership(resolved?.latest) });
    } catch (error) { return jsonError(res,error); }
  });

  app.post("/api/vendor-membership/create-order", paymentLimiter, requireAuth, requireRole("VENDOR", "SUPER_ADMIN"), async (req,res) => {
    try {
      const phone = digits10(req.user?.phone);
      if (phone.length !== 10) return res.status(401).json({ error: "Verified phone required" });
      const vendor = await getMyVendor(phone);
      if (!vendor) return res.status(404).json({ error: "Vendor application not found" });
      if (vendor.status !== "APPROVED" && vendor.status !== "LIVE") {
        return res.status(403).json({ error: "Vendor application must be approved before payment" });
      }
      if (!isLiveGateway()) return res.status(503).json({ error: "Live payment gateway is not ready; no charge was made" });
      const previous = await latestForVendor(vendor.id);
      const reconciliation = previous ? await reconcilePendingMembership(previous) : null;
      const prior = reconciliation?.latest || previous;
      if (prior?.status === "ACTIVE" && prior.expiresAt && prior.expiresAt > new Date()) {
        return res.status(409).json({ error: "Annual membership is already active" });
      }
      if (prior?.status === "PENDING" && !reconciliation?.gatewayAvailable) {
        return res.status(503).json({ error: "Gateway reconciliation unavailable. No new charge has been made; try checking status." });
      }
      if (prior?.status === "PENDING" && prior.createdAt && Date.now() - prior.createdAt.getTime() < 30 * 60 * 1000) {
        return res.json({ checkoutUrl: "/api/vendor-membership/checkout/" + prior.checkoutToken, orderId: prior.razorpayOrderId, amount: prior.amountPaise / 100, reused: true });
      }
      const receipt = "SUB_" + crypto.randomBytes(12).toString("hex");
      const order = await createRazorpayOrder(ANNUAL_PRICE_PAISE / 100, receipt, { platform: "go_bharat", purpose: "vendor_annual" });
      if (!order.success || !order.order?.id || order.order.amount !== ANNUAL_PRICE_PAISE || order.order.currency !== "INR") {
        return res.status(502).json({ error: "Unable to create a verified payment order" });
      }
      const token = crypto.randomBytes(24).toString("hex");
      await db.insert(vendorMemberships).values({
        id: "MEM_" + crypto.randomBytes(14).toString("hex"),
        vendorApplicationId: vendor.id, razorpayOrderId: order.order.id,
        checkoutToken: token, plan: "ANNUAL", amountPaise: ANNUAL_PRICE_PAISE,
        referralRatePercent: REFERRAL_RATE_PERCENT, referralName: vendor.submittedBy || "", status: "PENDING"
      });
      return res.json({ checkoutUrl: "/api/vendor-membership/checkout/" + token, orderId: order.order.id, amount: ANNUAL_PRICE_PAISE / 100 });
    } catch (error) { return jsonError(res,error); }
  });

  app.get("/api/vendor-membership/checkout/:token", async (req,res) => {
    try {
      const token = String(req.params.token || "");
      if (!/^[a-f0-9]{48}$/.test(token)) return res.status(404).send("Checkout not found");
      const [row] = await db.select().from(vendorMemberships).where(eq(vendorMemberships.checkoutToken, token)).limit(1);
      if (!row || row.status !== "PENDING" || !row.createdAt || Date.now() - row.createdAt.getTime() > 30 * 60 * 1000) {
        return res.status(410).send("Checkout expired or already completed. Return to your vendor dashboard.");
      }
      res.setHeader("Cache-Control", "no-store");
      return res.type("html").send(checkoutPage(row.razorpayOrderId, row.amountPaise, getRazorpayKeyId()));
    } catch (error) { return jsonError(res,error); }
  });

  app.post("/api/vendor-membership/confirm", paymentLimiter, async (req,res) => {
    try {
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
      if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string"
          || !/^order_[a-zA-Z0-9]+$/.test(orderId) || !/^pay_[a-zA-Z0-9]+$/.test(paymentId) || !/^[0-9a-f]{64}$/.test(signature)) {
        return res.status(400).json({ paid: false, error: "Invalid payment confirmation fields" });
      }
      if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
        return res.status(401).json({ paid: false, error: "Payment signature verification failed" });
      }
      const [row] = await db.select().from(vendorMemberships).where(eq(vendorMemberships.razorpayOrderId, orderId)).limit(1);
      if (!row) return res.status(404).json({ paid: false, error: "Membership order not found" });
      const gateway = await fetchRazorpayPayment(paymentId);
      if (!gateway.success || !gateway.payment) return res.status(503).json({ paid: false, error: "Gateway confirmation unavailable" });
      const paid = await confirmCaptured(row, gateway.payment);
      return res.status(paid ? 200 : 409).json({ paid, error: paid ? undefined : "Payment not captured or does not match this membership" });
    } catch (error) { return jsonError(res,error); }
  });

  app.get("/api/vendor-membership/marketing", requireAuth, requireRole("MARKETING"), async(req,res) => {
    try {
      const phone = digits10(req.user?.phone);
      const [rep] = await db.select({ name: teamMembers.name }).from(teamMembers)
        .where(and(phoneMatches(phone, teamMembers.phone), eq(teamMembers.role, "MARKETING"), eq(teamMembers.status, "ACTIVE"))).limit(1);
      if (!rep?.name || phone.length !== 10) return res.status(403).json({ error: "Active marketing account required" });
      const rows = await db.select().from(vendorMemberships).where(eq(vendorMemberships.status, "ACTIVE"));
      const eligible = rows.filter(m => (m.referralName || "").trim().toLowerCase() === rep.name.trim().toLowerCase());
      const commissionPaise = eligible.reduce((sum,m) => sum + referralPaise(m.amountPaise, m.referralRatePercent), 0);
      res.setHeader("Cache-Control", "no-store");
      res.json({ verifiedPaidSubscriptions: eligible.length, pendingReviewCommission: commissionPaise / 100,
        paidOut: 0, payoutStatus: "NOT_ENABLED",
        note: "Amounts are reserved estimates subject to attribution verification and payout approval. No withdrawal request is created by viewing this screen.",
        items: eligible.map(m=>({ id:m.id, amount:m.amountPaise / 100, commission:referralPaise(m.amountPaise,m.referralRatePercent)/100, paidAt:m.paidAt?.toISOString()||null }))
      });
    } catch (error) { return jsonError(res,error); }
  });

  app.get("/api/admin/vendor-membership-revenue", requireAuth, requireRole("SUPER_ADMIN"), async (_req,res) => {
    try {
      const rows = await db.select().from(vendorMemberships).orderBy(desc(vendorMemberships.createdAt));
      const captured = rows.filter(m => m.status === "ACTIVE");
      const refunded = rows.filter(m => m.status === "REFUNDED");
      const grossPaise = captured.reduce((sum,m) => sum + m.amountPaise, 0);
      const commissionPaise = captured.reduce((sum,m) => sum + referralPaise(m.amountPaise, m.referralRatePercent), 0);
      res.setHeader("Cache-Control", "no-store");
      res.json({
        activePayments: captured.length, pendingPayments: rows.filter(m => m.status==="PENDING").length,
        refundedPayments: refunded.length, capturedRevenue: grossPaise/100,
        reservedMarketingCommission: commissionPaise/100, beforeTaxAndGatewayFees: (grossPaise-commissionPaise)/100,
        currency: "INR", payoutsExecuted: 0,
        payments: rows.slice(0,100).map(m=>({ id:m.id, status:m.status, plan:m.plan, amount:m.amountPaise/100, 
          referralCommission:referralPaise(m.amountPaise,m.referralRatePercent)/100, paidAt:m.paidAt?.toISOString()||null }))
      });
    } catch (error) { return jsonError(res,error); }
  });
}
