import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSellerPhone, validSellerEnquiry } from "../sellerLeadRules";

const valid = { businessName: "Example Bazaar", city: "Malegaon", category: "Grocery", phone: "9876543210", consent: true };

test("Indian numbers normalize without losing first digits", () => {
  assert.equal(normalizeSellerPhone("9876543210"), "9876543210");
  assert.equal(normalizeSellerPhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizeSellerPhone("12345"), null);
  assert.equal(normalizeSellerPhone("1111111111"), null);
  assert.equal(normalizeSellerPhone("919876543210123"), null);
});

test("seller enquiries require affirmative contact consent and bounded inputs", () => {
  assert.equal(validSellerEnquiry(valid), true);
  assert.equal(validSellerEnquiry({...valid, consent: false}), false);
  assert.equal(validSellerEnquiry({...valid, consent: "true"}), false);
  assert.equal(validSellerEnquiry({...valid, businessName: "  "}), false);
  assert.equal(validSellerEnquiry({...valid, businessName: "x".repeat(101)}), false);
  assert.equal(validSellerEnquiry({...valid, city: "x".repeat(81)}), false);
  assert.equal(validSellerEnquiry({...valid, category: "Unknown"}), false);
});
