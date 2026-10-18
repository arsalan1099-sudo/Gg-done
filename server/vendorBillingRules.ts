// Server-authoritative membership pricing and settlement invariants.
export const ANNUAL_PRICE_PAISE = 100000;
export const REFERRAL_RATE_PERCENT = 33;

export function referralPaise(amountPaise: number, rate: number): number {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0 || !Number.isInteger(rate) || rate < 0 || rate > 100) {
    throw new Error("Invalid membership commission parameters");
  }
  return Math.round(amountPaise * rate / 100);
}

export function isCapturedAnnualPayment(
  payment: unknown, orderId: string, expectedPaise: number
): boolean {
  if (!payment || typeof payment !== "object") return false;
  const p = payment as Record<string, unknown>;
  return p.status === "captured" &&
    p.order_id === orderId && p.currency === "INR" &&
    p.amount === expectedPaise &&
    typeof p.id === "string" && /^pay_[a-zA-Z0-9]+$/.test(p.id);
}
