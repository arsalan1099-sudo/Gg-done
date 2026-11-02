// Go Saudi: pure, testable input validation. No payment credentials or secrets.
export const SAUDI_CITIES = ["Riyadh","Jeddah","Makkah","Madinah","Dammam","Khobar","Dhahran","Taif","Tabuk","Abha","Jazan","Hail","Other"] as const;
export const SAUDI_CATEGORIES = ["Grocery","Fashion","Food","Electronics","Home","Beauty","Services","Wholesale","Other"] as const;
export const REFERRAL_PERCENT = 33; // Policy proposal; never accrued until captured, verified settlement.
export function normalizeSaudiMobile(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const d = raw.replace(/[^0-9]/g, "");
  if (/^05[0-9]{8}$/.test(d)) return "+966" + d.slice(1);
  if (/^9665[0-9]{8}$/.test(d)) return "+" + d;
  if (/^5[0-9]{8}$/.test(d)) return "+966" + d;
  return null;
}
export function validateSaudiEnquiry(v: Record<string, unknown>) {
  const businessName = typeof v.businessName === "string" ? v.businessName.trim() : "";
  const city = typeof v.city === "string" ? v.city.trim() : "";
  const category = typeof v.category === "string" ? v.category.trim() : "";
  const phone = normalizeSaudiMobile(v.phone);
  const consent = v.consent === true;
  const valid = consent && businessName.length >= 2 && businessName.length <= 100 &&
    (SAUDI_CITIES as readonly string[]).includes(city) &&
    (SAUDI_CATEGORIES as readonly string[]).includes(category) && !!phone;
  return {valid, businessName, city, category, phone};
}
export function referralHalalas(capturedHalalas: number, rate = REFERRAL_PERCENT): number {
  if (!Number.isSafeInteger(capturedHalalas) || capturedHalalas < 0 ||
      !Number.isSafeInteger(rate) || rate < 0 || rate > 100) {
    throw new Error("Invalid captured settlement");
  }
  return Math.round(capturedHalalas * rate / 100);
}
