import crypto from "node:crypto";

// Server-only: never ship admin phone number to public client bootstrap data.
export function configuredAdminPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/\s/g, "");
  // Fail closed: an Indian E.164 number must be set explicitly in the server env.
  if (!/^\+?91[6-9]\d{9}$/.test(value)) return null;
  return value.replace(/\D/g, "").slice(-10);
}

export function canReturnOtpInResponse(isProduction: boolean): boolean {
  // Never let a deployment flag or API request turn production OTP into the
  // equivalent of a publicly known authentication code.
  return !isProduction;
}

export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
