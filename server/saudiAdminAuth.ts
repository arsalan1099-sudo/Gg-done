import crypto from "node:crypto";

// Long random capability token, supplied as Authorization: Bearer <token>.
// Store only the SHA-256 hex digest in GO_SAUDI_ADMIN_TOKEN_SHA256.
export function isSaudiAdminKeyConfigured(hash: unknown): boolean {
  return typeof hash === "string" && /^[0-9a-f]{64}$/i.test(hash);
}
export function verifySaudiAdminAuthorization(header: unknown, hash: unknown): boolean {
  if (!isSaudiAdminKeyConfigured(hash) || typeof header !== "string") return false;
  const tokenMatch=/^Bearer ([a-zA-Z0-9_-]{32,128})$/.exec(header);
  if (!tokenMatch) return false;
  const supplied=crypto.createHash("sha256").update(tokenMatch[1],"utf8").digest();
  const expected=Buffer.from(hash,"hex");
  return crypto.timingSafeEqual(supplied,expected);
}
