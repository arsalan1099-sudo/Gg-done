import { test } from "node:test";
import { strict as assert } from "node:assert";
import {normalizeSaudiMobile, validateSaudiEnquiry, referralHalalas} from "../saudiRules";

test("KSA mobile normalization only accepts Saudi mobile formats", () => {
  assert.equal(normalizeSaudiMobile("0501234567"), "+966501234567");
  assert.equal(normalizeSaudiMobile("+966 50 123 4567"), "+966501234567");
  assert.equal(normalizeSaudiMobile("501234567"), "+966501234567");
  assert.equal(normalizeSaudiMobile("+91 9876543210"), null);
  assert.equal(normalizeSaudiMobile("0111234567"), null);
});
test("enquiry requires valid consent and location", () => {
  const body = { businessName:"Test Shop",city:"Jeddah",category:"Grocery",phone:"0501234567",consent:true };
  assert.equal(validateSaudiEnquiry(body).valid, true);
  assert.equal(validateSaudiEnquiry({...body, consent:false}).valid, false);
  assert.equal(validateSaudiEnquiry({...body,city:"Mumbai"}).valid, false);
});
test("referrals use integer halalas (not floating point SAR)", () => {
  assert.equal(referralHalalas(10000), 3300);
  assert.equal(referralHalalas(0), 0);
  assert.throws(()=>referralHalalas(-1));
  assert.throws(()=>referralHalalas(100, 101));
});
