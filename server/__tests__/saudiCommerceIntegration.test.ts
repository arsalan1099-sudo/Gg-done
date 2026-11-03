import {test} from "node:test";
import {strict as assert} from "node:assert";
import {validateSaudiBookingRequest} from "../saudiBookings";
import {encryptSaudiCustomerPhone} from "../saudiCustomerAuth";
import {safeSaudiPhone} from "../saudiCommerceRules";

test("booking request must use a genuine eligible future UTC slot",()=>{
 const id="SVC_"+"a".repeat(30),now=Date.UTC(2026,10,4,12,0,0);
 const valid={productId:id,requestedSlot:"2026-11-08T14:30:00Z",note:"Please confirm availability"};
 const ok=validateSaudiBookingRequest(valid,now);
 assert.equal(ok.ok,true);
 if(ok.ok)assert.equal(ok.slot.toISOString(),"2026-11-08T14:30:00.000Z");
 assert.equal(validateSaudiBookingRequest({...valid,requestedSlot:"2026-11-04T12:15:00Z"},now).ok,false);
 assert.equal(validateSaudiBookingRequest({...valid,requestedSlot:"2027-05-01T14:30:00Z"},now).ok,false);
 assert.equal(validateSaudiBookingRequest({...valid,requestedSlot:"2026-11-08"},now).ok,false);
 assert.equal(validateSaudiBookingRequest({...valid,productId:"other"},now).ok,false);
 assert.equal(validateSaudiBookingRequest({...valid,note:"x".repeat(501)},now).ok,false);
});
test("Saudi customer identifiers are encrypted with per-record nonce",()=>{
 const original=process.env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY;
 process.env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY="d".repeat(64);
 try{
  const phone=safeSaudiPhone("0551234567")!;
  const a=encryptSaudiCustomerPhone(phone),b=encryptSaudiCustomerPhone(phone);
  assert.ok(a.includes("."));
  assert.notEqual(a,b);
  assert.ok(!a.includes("0551234567")&&!a.includes("+966"));
  assert.equal(a.split(".").length,3);
 }finally{
  if(original===undefined)delete process.env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY;
  else process.env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY=original;
 }
});
