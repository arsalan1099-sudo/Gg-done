import crypto from "node:crypto";

// Server-only: never ship admin phone number to public client bootstrap data.
export function configuredAdminPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/\s/g, "");
  // Fail closed: an Indian E.164 number must be set explicitly in the server env.
  if (!/^\+?91[6-9]\d{9}$/.test(value)) return null;
  return value.replace(/\D/g, "").slice(-10);
}

export function canReturnOtpInResponse(isProduction: boolean, explicitLocalDevOptIn = false): boolean {
  // Fail closed by default. Even in development require an explicit local-only
  // environment opt-in; never accept request flags or public config for OTP.
  return !isProduction && explicitLocalDevOptIn;
}

export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** Return the canonical Indian mobile number for phone-OTP endpoints. */
export function normalizeOtpPhone(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 25) return null;
  const digits = raw.replace(/[\s()+-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2);
  return null;
}

/** Only accept an email independently retrieved from a server-owned,
 * phone-verified identity record. Never use the email from a phone-OTP request. */
export function trustedLinkedEmail(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 254) return null;
  const email = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** In-process protection against rapid OTP guessing. Production multi-instance
 * deployments MUST also enforce a distributed/database-backed attempt budget. */
export function createOtpAttemptBudget(maxAttempts = 5, windowMs = 10 * 60 * 1000) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new TypeError("Invalid attempt budget");
  }
  const entries = new Map<string, { attempts: number; expiresAt: number }>();
  return {
    blocked(key: string, now = Date.now()): boolean {
      if (!key) return true;
      const item = entries.get(key);
      if (!item || item.expiresAt <= now) {
        entries.set(key, { attempts: 1, expiresAt: now + windowMs });
        return false;
      }
      if (item.attempts >= maxAttempts) return true;
      item.attempts += 1;
      return false;
    },
    clear(key: string) { entries.delete(key); }
  };
}
