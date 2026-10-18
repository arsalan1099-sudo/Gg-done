export const SELLER_CATEGORIES = new Set(["Grocery", "Fashion", "Food", "Electronics", "Wholesale", "Services", "Other"]);

export function normalizeSellerPhone(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 32) return null;
  const digits = raw.replace(/\D/g, "");
  const phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(phone) ? phone : null;
}

export function validSellerEnquiry(fields: { businessName: unknown; city: unknown; category: unknown; consent: unknown; phone: unknown }): boolean {
  return fields.consent === true &&
    typeof fields.businessName === "string" &&
    fields.businessName.trim().length > 0 && fields.businessName.trim().length <= 100 &&
    typeof fields.city === "string" &&
    fields.city.trim().length > 0 && fields.city.trim().length <= 80 &&
    typeof fields.category === "string" && SELLER_CATEGORIES.has(fields.category) &&
    normalizeSellerPhone(fields.phone) !== null;
}
