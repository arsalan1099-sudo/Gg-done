import {test} from "node:test";
import {strict as assert} from "node:assert";
import {saudiCommerceBlockers,saudiOrdersReady,saudiPaymentsReady,
 validateSaudiCartRequest,calculateSaudiQuote,safeSaudiPhone,
 isSaudiOtpCode,verifyMoyasarPayment,SAUDI_COMMERCE_GATES} from "../saudiCommerceRules";

const prod={id:"SVC_"+"a".repeat(30),vendorId:"VENDOR1",title:"Saudi coffee",
 stock:2,priceHalalas:2999,status:"APPROVED",merchantStatus:"APPROVED"};
test("real charges and orders remain blocked without all independent approvals",()=>{
 const blank:Record<string,string>={};
 assert.equal(saudiOrdersReady(blank),false);
 assert.equal(saudiPaymentsReady(blank),false);
 const missing=saudiCommerceBlockers(blank);
 assert.ok(missing.includes("GO_SAUDI_ESTORE_VERIFIED"));
 assert.ok(missing.includes("GO_SAUDI_CUSTOMER_DATA_RIGHTS_READY"));
 assert.ok(missing.includes("GO_SAUDI_ZATCA_READY"));
 assert.ok(missing.includes("MOYASAR_SECRET_KEY"));
 assert.ok(missing.includes("MOYASAR_WEBHOOK_SECRET_TOKEN"));
 assert.ok(missing.includes("TWILIO_VERIFY"));
 const signed:Record<string,string>=Object.fromEntries(SAUDI_COMMERCE_GATES.map(x=>[x,"true"]));
 signed.APP_PUBLIC_URL="https://saudi.example/";
 signed.DATABASE_URL="postgres://saudi:xxx@host/saudi_db";
 signed.MOYASAR_SECRET_KEY="sk_live_123456789012345678";
 signed.MOYASAR_WEBHOOK_SECRET_TOKEN="ci_webhook_secret_"+"a".repeat(40);
 signed.MOYASAR_PUBLISHABLE_KEY="pk_live_123456789012345678";
 signed.TWILIO_VERIFY_SERVICE_SID="VA"+"a".repeat(32);
 signed.TWILIO_API_KEY="SK"+"b".repeat(32);
 signed.TWILIO_API_SECRET="secure-otp-provider-secret";
 signed.TWILIO_ACCOUNT_SID="AC"+"c".repeat(32);
 signed.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY="1".repeat(64);
 assert.deepEqual(saudiCommerceBlockers(signed),[]);
 assert.equal(saudiOrdersReady(signed),false);
 assert.equal(saudiPaymentsReady(signed),false);
 signed.GO_SAUDI_ORDERS_ENABLED="true";
 assert.equal(saudiOrdersReady(signed),true);
 assert.equal(saudiPaymentsReady(signed),false);
});
test("untrusted customer cart is validated before product lookup",()=>{
 const valid={productId:prod.id,quantity:2};
 assert.equal(validateSaudiCartRequest([valid]).ok,true);
 assert.equal(validateSaudiCartRequest([]).ok,false);
 assert.equal(validateSaudiCartRequest([{...valid,quantity:1.5}]).ok,false);
 assert.equal(validateSaudiCartRequest([{...valid,quantity:21}]).ok,false);
 assert.equal(validateSaudiCartRequest([valid,valid]).ok,false);
 assert.equal(validateSaudiCartRequest([{...valid,productId:"../api"}]).ok,false);
});
test("quote uses only authoritative SAR price, stock and one vendor",()=>{
 const lines=[{productId:prod.id,quantity:2}];
 const quote=calculateSaudiQuote(lines,[prod]);
 assert.equal(quote.ok,true);
 if(quote.ok){assert.equal(quote.subtotalHalalas,5998);assert.equal(quote.currency,"SAR");}
 assert.equal(calculateSaudiQuote([{productId:prod.id,quantity:3}],[prod]).ok,false);
 assert.equal(calculateSaudiQuote(lines,[{...prod,status:"PENDING"}]).ok,false);
 assert.equal(calculateSaudiQuote(lines,[{...prod,merchantStatus:"REJECTED"}]).ok,false);
 assert.equal(calculateSaudiQuote([...lines,{productId:"SVC_"+"b".repeat(30),quantity:1}],
  [prod,{...prod,id:"SVC_"+"b".repeat(30),vendorId:"OTHER"}]).ok,false);
});
test("Saudi phone and OTP values are strict",()=>{
 assert.equal(safeSaudiPhone("0551234567"),"+966551234567");
 assert.equal(safeSaudiPhone("+966551234567"),"+966551234567");
 assert.equal(safeSaudiPhone("00966551234567"),null);
 assert.equal(safeSaudiPhone("+919876543210"),null);
 assert.equal(isSaudiOtpCode("123456"),true);
 assert.equal(isSaudiOtpCode("1234567x"),false);
});
test("a browser-paid redirect cannot authorize a Saudi merchant order",()=>{
 const expected={id:"d183afaa-4311-4a90-9774-4e6a882be390",
  amount:5998,currency:"SAR" as const,orderId:"SO_"+"d".repeat(30)};
 const payment={...expected,status:"paid",metadata:{order_id:expected.orderId}};
 assert.equal(verifyMoyasarPayment(payment,expected),true);
 assert.equal(verifyMoyasarPayment({...payment,status:"authorized"},expected),false);
 assert.equal(verifyMoyasarPayment({...payment,amount:1},expected),false);
 assert.equal(verifyMoyasarPayment({...payment,currency:"INR"},expected),false);
 assert.equal(verifyMoyasarPayment({...payment,metadata:{order_id:"OTHER"}},expected),false);
 assert.equal(verifyMoyasarPayment({status:"paid"},expected),false);
});
