import {test} from "node:test";
import {strict as assert} from "node:assert";
import crypto from "node:crypto";
import {isSaudiAdminKeyConfigured,verifySaudiAdminAuthorization} from "../saudiAdminAuth";
const token="x".repeat(64);
const digest=crypto.createHash("sha256").update(token).digest("hex");
test("admin login fails closed without configured SHA-256 digest",()=>{
  assert.equal(isSaudiAdminKeyConfigured(undefined),false);
  assert.equal(verifySaudiAdminAuthorization("Bearer "+token,undefined),false);
  assert.equal(verifySaudiAdminAuthorization("Bearer "+token,"malformed"),false);
});
test("strong bearer token only is accepted",()=>{
  assert.equal(verifySaudiAdminAuthorization("Bearer "+token,digest),true);
  assert.equal(verifySaudiAdminAuthorization("Bearer "+("y".repeat(64)),digest),false);
  assert.equal(verifySaudiAdminAuthorization("Basic "+token,digest),false);
  assert.equal(verifySaudiAdminAuthorization("Bearer "+("z".repeat(8)),digest),false);
});
