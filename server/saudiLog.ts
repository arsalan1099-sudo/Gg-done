/**
 * Go Saudi PII-safe server logging. Driver exceptions may contain SQL parameters,
 * Saudi phone numbers, secrets, vendor notes or invitation tokens. Never print
 * untrusted error.message, stack, query, parameters or request body.
 */
export function saudiErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const name = Object.getPrototypeOf(error)?.constructor?.name;
  const code = (error as {code?: unknown}).code;
  const category = typeof name === "string" && /^[A-Za-z]{2,48}$/.test(name) ? name : "Error";
  // Expose only a small allowlist of PostgreSQL SQLSTATE codes; no free-form strings.
  const allowed = new Set(["23505","23503","23514","40001","40P01","08006","08001","53300","57014"]);
  return category + (typeof code === "string" && allowed.has(code) ? ":" + code : "");
}
export function logSaudiError(context: string, error: unknown): void {
  const safeContext = /^[A-Z_]{2,50}$/.test(context) ? context : "SAUDI_ERROR";
  console.error("["+safeContext+"]",saudiErrorCode(error));
}
