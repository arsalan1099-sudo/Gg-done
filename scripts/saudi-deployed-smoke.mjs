#!/usr/bin/env node
// Read-only Go Saudi deployment smoke test; never creates users, orders or charges.
// Run: node scripts/saudi-deployed-smoke.mjs
//      GO_SAUDI_SMOKE_ORIGIN=https://go-saudi-prelaunch.onrender.com node scripts/saudi-deployed-smoke.mjs
import assert from "node:assert/strict";

const rawOrigin = process.env.GO_SAUDI_SMOKE_ORIGIN || "https://go-saudi-prelaunch.onrender.com";
const origin = new URL(rawOrigin);
if (origin.protocol !== "https:" || origin.username || origin.password ||
    origin.search || origin.hash || origin.pathname !== "/" ||
    origin.hostname !== "go-saudi-prelaunch.onrender.com") {
  throw new Error("Go Saudi smoke origin must be the dedicated HTTPS Render prelaunch hostname");
}

async function getJson(path) {
  const response = await fetch(new URL(path, origin), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`${path}: expected HTTP 200, got ${response.status}`);
  if (!(response.headers.get("content-type") || "").includes("application/json")) {
    throw new Error(`${path}: expected JSON`);
  }
  return response.json();
}

async function smoke() {
  // Render Free may cold-start. Only retry an idempotent, read-only health check.
  let health;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      health = await getJson("/api/health");
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }
  assert.equal(health.service, "go-saudi", "Saudi service identity mismatch");
  assert.equal(health.status, "healthy", "Backend has not passed health checks");
  assert.equal(health.database, "connected", "Dedicated Saudi database is disconnected");
  console.log("PASS: Saudi backend health and DB connection");

  // Homepage regression guard: prevent a live API masking a blank or missing landing page.
  // Go Saudi uses a checked-in single HTML page with inline CSS, not Next.js assets.
  const homepageResponse = await fetch(new URL("/", origin), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "text/html" }
  });
  assert.equal(homepageResponse.status, 200, "Homepage must return HTTP 200");
  assert.match(homepageResponse.headers.get("content-type") || "", /text\\/html/i,
    "Homepage must return HTML rather than JSON or an error document");
  const homepage = await homepageResponse.text();
  assert.ok(homepage.length > 5000, "Homepage HTML unexpectedly short");
  assert.match(homepage, /<style[\\s>]/i, "Homepage inline stylesheet is missing");
  assert.match(homepage, /<header[\\s>]/i, "Homepage navigation header is missing");
  assert.match(homepage, /<main[\\s>]/i, "Homepage main content is missing");
  assert.match(homepage, /GO SAUDI/, "Go Saudi branding is missing");
  assert.match(homepage, /id=["']categoryGrid["']/, "Homepage categories are missing");
  assert.doesNotMatch(homepage, /\\/_next\\/static\\//i,
    "Unexpected Next.js assets on Saudi static prelaunch page");
  console.log("PASS: Homepage serves complete branded HTML and inline CSS");

  const market = await getJson("/api/saudi/market");
  assert.equal(market.brand, "Go Saudi");
  assert.equal(market.country, "SA");
  assert.equal(market.currency, "SAR");
  assert.equal(market.status, "PRELAUNCH");
  console.log("PASS: Saudi identity and marketplace metadata");

  const readiness = await getJson("/api/saudi/readiness");
  assert.equal(readiness.market, "go-saudi");
  assert.equal(readiness.mode, "PRELAUNCH");
  assert.equal(readiness.commercialLaunchReady, false);
  console.log("PASS: Marketplace prelaunch gate remains closed");

  const commerce = await getJson("/api/saudi/commerce/readiness");
  assert.equal(commerce.country, "SA");
  assert.equal(commerce.currency, "SAR");
  assert.equal(commerce.liveOrders, false, "Unsafe: orders are live in prelaunch");
  assert.equal(commerce.livePayments, false, "Unsafe: payments are live in prelaunch");
  assert.equal(commerce.liveBookings, false, "Unsafe: bookings are live in prelaunch");
  assert.ok(Array.isArray(commerce.blockedBy) && commerce.blockedBy.length > 0,
    "Unsafe: expected independent commerce blockers during prelaunch");
  console.log(`PASS: No live orders, bookings or payments; ${commerce.blockedBy.length} blocker(s) remain`);

  const otp = await getJson("/api/saudi/customer/auth/status");
  assert.equal(otp.country, "SA");
  assert.equal(otp.method, "sms_otp");
  assert.equal(otp.available, false, "Unsafe: unverified OTP was exposed");
  console.log("PASS: Customer OTP remains unavailable until real provider verification");
  console.log("PASS: Read-only Saudi prelaunch smoke tests complete");
}

smoke().catch(error => {
  console.error("FAIL: Saudi deployment smoke:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
