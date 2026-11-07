// Read-only configuration audit. Never prints secret values.
import { pathToFileURL } from "node:url";

export function inspectProductionEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const required = ["DATABASE_URL", "JWT_SECRET", "ADMIN_PHONE", "APP_PUBLIC_URL"];
  for (const key of required) {
    if (!env[key]?.trim()) errors.push(`Missing ${key}`);
  }
  if (env.DATABASE_URL && !/^postgres(?:ql)?:\/\//i.test(env.DATABASE_URL)) {
    errors.push("DATABASE_URL must be a PostgreSQL connection URL");
  }
  if (env.JWT_SECRET && (env.JWT_SECRET.length < 32 || /^(dev|test|example|change[-_ ]?me)/i.test(env.JWT_SECRET))) {
    errors.push("JWT_SECRET must be an unpredictable secret of at least 32 characters");
  }
  if (env.ADMIN_PHONE && !/^\+?91[6-9]\d{9}$/.test(env.ADMIN_PHONE.replace(/\s/g, ""))) {
    errors.push("ADMIN_PHONE must be an Indian E.164 number with country code");
  }
  if (env.APP_PUBLIC_URL && !/^https:\/\//i.test(env.APP_PUBLIC_URL)) {
    errors.push("APP_PUBLIC_URL must start with https://");
  }
  const paymentSets = [
    ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
    ["PHONEPE_MERCHANT_ID", "PHONEPE_SALT_KEY"]
  ];
  for (const keys of paymentSets) {
    const present = keys.filter(k => Boolean(env[k]?.trim()));
    if (present.length > 0 && present.length !== keys.length) {
      errors.push(`Partial payment configuration for ${keys[0]}: configure all companion keys or none`);
    }
  }
  if (!env.RAZORPAY_KEY_ID && !env.PHONEPE_MERCHANT_ID) {
    warnings.push("No payment provider configured; keep production checkout disabled");
  }
  if (!env.DATABASE_BACKUP_VERIFIED_AT) {
    warnings.push("No evidence of a verified database backup and restore test (DATABASE_BACKUP_VERIFIED_AT)");
  }
  if (!env.PRODUCTION_SMOKE_TESTED_AT) {
    warnings.push("Production smoke-test evidence not recorded (PRODUCTION_SMOKE_TESTED_AT)");
  }
  // Existing /server/routes.ts contains an ADMIN_PHONE fallback. Set env explicitly
  // and remove that fallback in a separately reviewed security patch.
  return { ok: errors.length === 0, errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = inspectProductionEnv();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
