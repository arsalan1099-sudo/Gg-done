import assert from "node:assert/strict";
import { test } from "node:test";
import { ANNUAL_PRICE_PAISE, REFERRAL_RATE_PERCENT, referralPaise, isCapturedAnnualPayment } from "../vendorBillingRules";

test("annual membership is exactly ₹1000 and referral is exactly ₹330", () => {
  assert.equal(ANNUAL_PRICE_PAISE, 100000);
  assert.equal(REFERRAL_RATE_PERCENT, 33);
  assert.equal(referralPaise(ANNUAL_PRICE_PAISE, REFERRAL_RATE_PERCENT), 33000);
});

test("referral payout always uses integer paise", () => {
  assert.equal(referralPaise(101, 33), 33);
  assert.throws(() => referralPaise(-1000, 33));
  assert.throws(() => referralPaise(1000, 200));
});

test("capture must match order, paise, currency, payment ID and captured status", () => {
  const good = { id: "pay_secure123", order_id: "order_secure456", currency: "INR", amount: 100000, status: "captured" };
  assert.equal(isCapturedAnnualPayment(good, "order_secure456", 100000), true);
  assert.equal(isCapturedAnnualPayment({ ...good, status: "authorized" }, "order_secure456", 100000), false);
  assert.equal(isCapturedAnnualPayment({ ...good, status: "failed" }, "order_secure456", 100000), false);
  assert.equal(isCapturedAnnualPayment({ ...good, currency: "USD" }, "order_secure456", 100000), false);
  assert.equal(isCapturedAnnualPayment({ ...good, amount: 100 }, "order_secure456", 100000), false);
  assert.equal(isCapturedAnnualPayment({ ...good, order_id: "order_someoneElse" }, "order_secure456", 100000), false);
  assert.equal(isCapturedAnnualPayment({ ...good, id: 1 }, "order_secure456", 100000), false);
  assert.equal(isCapturedAnnualPayment(null, "order_secure456", 100000), false);
});
