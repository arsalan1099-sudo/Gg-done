import assert from "node:assert/strict";
import { test } from "node:test";
import { configuredAdminPhone, canReturnOtpInResponse, generateSecureOtp } from "../securityConfig";

test("missing or malformed admin phone never matches any account", () => {
  assert.equal(configuredAdminPhone(undefined), null);
  assert.equal(configuredAdminPhone(""), null);
  assert.equal(configuredAdminPhone("9876543210"), null);
  assert.equal(configuredAdminPhone("+91 1234567890"), null);
  assert.equal(configuredAdminPhone("+91 98765 43210"), "9876543210");
  assert.equal(configuredAdminPhone("919876543210"), "9876543210");
});
test("production never returns OTP, even when a legacy flag is present", () => {
  assert.equal(canReturnOtpInResponse(true), false);
  assert.equal(canReturnOtpInResponse(false), true);
});
test("cryptographic OTP generator emits six-digit codes", () => {
  for (let i = 0; i < 100; i++) {
    assert.match(generateSecureOtp(), /^[1-9]\d{5}$/);
  }
});
