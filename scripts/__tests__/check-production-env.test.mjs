import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectProductionEnv } from "../check-production-env.mjs";

const valid = {
  DATABASE_URL: "postgresql://db.example/database",
  JWT_SECRET: "a".repeat(48),
  ADMIN_PHONE: "+919876543210",
  APP_PUBLIC_URL: "https://go-bharat.example",
  DATABASE_BACKUP_VERIFIED_AT: "2026-11-08",
  PRODUCTION_SMOKE_TESTED_AT: "2026-11-08"
};

test("valid env passes without exposing secret values", () => {
  const out = inspectProductionEnv(valid);
  assert.equal(out.ok, true);
  assert.deepEqual(out.errors, []);
  assert.equal(JSON.stringify(out).includes(valid.JWT_SECRET), false);
});

test("missing config fails closed", () => {
  const out = inspectProductionEnv({});
  assert.equal(out.ok, false);
  assert.ok(out.errors.some(e => e.includes("JWT_SECRET")));
});

test("weak JWT and insecure URL rejected", () => {
  const out = inspectProductionEnv({ ...valid, JWT_SECRET: "change-me", APP_PUBLIC_URL: "http://website.example" });
  assert.equal(out.ok, false);
  assert.ok(out.errors.length >= 2);
});

test("partial payment provider configuration rejected", () => {
  const out = inspectProductionEnv({ ...valid, RAZORPAY_KEY_ID: "rzp_test_example" });
  assert.equal(out.ok, false);
  assert.ok(out.errors.some(e => e.includes("Partial payment")));
});

test("unknown backups and smoke tests warn without claiming success", () => {
  const out = inspectProductionEnv({ ...valid, DATABASE_BACKUP_VERIFIED_AT: "", PRODUCTION_SMOKE_TESTED_AT: "" });
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 3);
});
