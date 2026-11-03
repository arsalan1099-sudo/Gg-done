import {test,before,after} from "node:test";
import {strict as assert} from "node:assert";
import crypto from "node:crypto";
import express from "express";
import type {Server} from "node:http";
import {eq} from "drizzle-orm";
import {db,pool} from "../db";
import {registerSaudiMarket} from "../saudiMarket";
import {sellerEnquiries,saudiVendorAccounts,saudiCatalogSubmissions,
 saudiVendorDraftProducts,saudiVendorSessions} from "@shared/schema";

const random=(p:string)=>p+crypto.randomBytes(15).toString("hex");
const vendorId=random("SV_"),leadId=random("SL_");
const goodId=random("SVC_"),serviceId=random("SVC_");
const paymentId="6a2d4a50-5f6f-4a0d-973f-024a88f7b662";
const otpPhone="0551234567";
const token=crypto.randomBytes(32).toString("hex");
const baseEnv:Record<string,string>={
 GO_SAUDI_MODE:"true",GO_SAUDI_PRIVACY_APPROVED:"true",
 GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED:"true",GO_SAUDI_CATALOG_PUBLIC:"true",
 GO_SAUDI_MERCHANT_VERIFICATION_APPROVED:"true",GO_SAUDI_ESTORE_VERIFIED:"true",
 GO_SAUDI_CUSTOMER_OTP_ENABLED:"true",GO_SAUDI_CUSTOMER_DATA_RIGHTS_READY:"true",
 GO_SAUDI_ORDER_OPERATIONAL_TESTS_PASSED:"true",GO_SAUDI_PAYMENT_WEBHOOK_READY:"true",
 GO_SAUDI_VENDOR_SETTLEMENT_READY:"true",GO_SAUDI_REGULATED_CATEGORY_REVIEW_READY:"true",
 GO_SAUDI_FULFILLMENT_READY:"true",GO_SAUDI_ZATCA_READY:"true",
 GO_SAUDI_REFUNDS_READY:"true",GO_SAUDI_SETTLEMENT_RECONCILIATION_READY:"true",
 GO_SAUDI_LIVE_CHARGES_APPROVED:"true",GO_SAUDI_ORDERS_ENABLED:"true",
 GO_SAUDI_PAYMENTS_ENABLED:"true",GO_SAUDI_BOOKINGS_ENABLED:"true",
 GO_SAUDI_SERVICE_BOOKINGS_LICENSED:"true",
 APP_PUBLIC_URL:"https://go-saudi-e2e.example/",
 MOYASAR_SECRET_KEY:"sk_live_"+"a".repeat(32),
 MOYASAR_PUBLISHABLE_KEY:"pk_live_"+"b".repeat(32),
 TWILIO_VERIFY_SERVICE_SID:"VA"+"c".repeat(32),
 TWILIO_API_KEY:"SK"+"d".repeat(32),TWILIO_API_SECRET:"test-in-ci-only",
 TWILIO_ACCOUNT_SID:"AC"+"e".repeat(32),
 GO_SAUDI_CUSTOMER_ENCRYPTION_KEY:"9".repeat(64)
};
let server:Server,base="",cookie="",vendorCookie="",createdOrder="";
let originalFetch:typeof fetch,originalEnv:Record<string,string|undefined>={};
const post=async(path:string,body:unknown,cookieHeader="")=>{
 const response=await fetch(base+path,{
  method:"POST",
  headers:{"Content-Type":"application/json",Origin:base,...(cookieHeader?{Cookie:cookieHeader}:{})},
  body:JSON.stringify(body)
 });
 return {status:response.status,json:await response.json() as any,cookie:response.headers.get("set-cookie")||""};
};
before(async()=>{
 for(const [key,value] of Object.entries(baseEnv)){
  originalEnv[key]=process.env[key];process.env[key]=value;
 }
 originalFetch=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url.startsWith("https://verify.twilio.com/")){
   if(url.endsWith("/Verifications"))
    return new Response(JSON.stringify({status:"pending"}),{status:201,headers:{"Content-Type":"application/json"}});
   if(url.endsWith("/VerificationCheck"))
    return new Response(JSON.stringify({status:"approved"}),{status:200,headers:{"Content-Type":"application/json"}});
  }
  if(url==="https://api.moyasar.com/v1/payment_intents"){
   const body=JSON.parse(String(init?.body));
   return new Response(JSON.stringify({
    id:"9f14400b-ab12-489b-98f3-1180d2358502",
    client_secret:"pi_secret_ci_only",
    amount:body.amount,currency:"SAR"
   }),{status:201,headers:{"Content-Type":"application/json"}});
  }
  if(url==="https://api.moyasar.com/v1/payments/"+paymentId)
   return new Response(JSON.stringify({
     id:paymentId,status:"paid",amount:5798,currency:"SAR",
     metadata:{order_id:createdOrder}
   }),{status:200,headers:{"Content-Type":"application/json"}});
  return originalFetch(input as any,init);
 }) as typeof fetch;
 await db.insert(sellerEnquiries).values({
  id:leadId,businessName:"CI Saudi Coffee "+Date.now(),phone:"0554445555",
  city:"Jeddah",category:"Food",status:"APPROVED",source:"SAUDI_LANDING",consent:true
 });
 await db.insert(saudiVendorAccounts).values({id:vendorId,enquiryId:leadId,description:"CI-only verified demo seller"});
 const goodDraft=random("SVP_"),serviceDraft=random("SVP_");
 await db.insert(saudiVendorDraftProducts).values([
  {id:goodDraft,vendorId,subcategoryId:"sc5",title:"CI Saudi Coffee",
   description:"Only a CI test",priceHalalas:2899,stock:3,status:"DRAFT"},
  {id:serviceDraft,vendorId,subcategoryId:"sc69",title:"CI Cleaning Service",
   description:"Manual appointment request",priceHalalas:6500,stock:8,status:"DRAFT"}
 ]);
 await db.insert(saudiCatalogSubmissions).values([
  {id:goodId,vendorId,draftId:goodDraft,subcategoryId:"sc5",
   title:"CI Saudi Coffee",description:"Only a CI test",priceHalalas:2899,stock:3,status:"APPROVED"},
  {id:serviceId,vendorId,draftId:serviceDraft,subcategoryId:"sc69",
   title:"CI Cleaning Service",description:"Manual appointment request",priceHalalas:6500,stock:8,status:"APPROVED"}
 ]);
 // Native customer and merchant sessions are scoped to this disposable CI DB.
 const app=express();app.use(express.json({limit:"32kb"}));registerSaudiMarket(app);
 await new Promise<void>(resolve=>{server=app.listen(0,"127.0.0.1",resolve)});
 const a=server.address();
 if(!a||typeof a==="string")throw Error("No server port");
 base="http://127.0.0.1:"+a.port;
 const vendorToken=crypto.randomBytes(32).toString("hex");
 vendorCookie="__Host-go_saudi_vendor="+vendorToken;
 await db.insert(saudiVendorSessions).values({
  id:random("SVS_"),vendorId,
  tokenHash:crypto.createHash("sha256").update(vendorToken).digest("hex"),
  expiresAt:new Date(Date.now()+4*60*60*1000)
 });
});
after(async()=>{
 globalThis.fetch=originalFetch;
 for(const key of Object.keys(baseEnv)){
  if(originalEnv[key]===undefined)delete process.env[key];
  else process.env[key]=originalEnv[key];
 }
 if(server)await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 await pool.end();
});
test("Saudi OTP, verified one-vendor order, payment reconciliation, stock and manual booking",async()=>{
 const otp=await post("/api/saudi/customer/otp/start",{phone:otpPhone,consent:true});
 assert.equal(otp.status,202,JSON.stringify(otp.json));
 const login=await post("/api/saudi/customer/otp/verify",{phone:otpPhone,code:"123456"});
 assert.equal(login.status,200,JSON.stringify(login.json));
 cookie=login.cookie.split(";")[0];
 assert.match(cookie,/^__Host-go_saudi_customer=[a-f0-9]{64}$/);
 const readiness=await originalFetch(base+"/api/saudi/commerce/readiness").then(r=>r.json()) as any;
 assert.equal(readiness.liveOrders,true);
 assert.equal(readiness.livePayments,true);
 assert.equal(readiness.liveBookings,true);
 const quote=await post("/api/saudi/checkout/quote",{items:[{productId:goodId,quantity:2}]});
 assert.equal(quote.status,200,JSON.stringify(quote.json));
 assert.equal(quote.json.subtotalHalalas,5798);
 const cart={items:[{productId:goodId,quantity:2}],
  fulfillment:"PICKUP",idempotencyKey:"ci_"+crypto.randomBytes(24).toString("hex")};
 const order=await post("/api/saudi/orders",cart,cookie);
 assert.equal(order.status,201,JSON.stringify(order.json));
 createdOrder=order.json.order.id;
 const dupe=await post("/api/saudi/orders",cart,cookie);
 assert.equal(dupe.status,200);
 assert.equal(dupe.json.order.id,createdOrder);
 const intent=await post("/api/saudi/orders/"+createdOrder+"/payment-intent",{},cookie);
 assert.equal(intent.status,200,JSON.stringify(intent.json));
 assert.equal(intent.json.amountHalalas,5798);
 assert.equal(intent.json.currency,"SAR");
 assert.equal(intent.json.publishableKey,baseEnv.MOYASAR_PUBLISHABLE_KEY);
 const paid=await post("/api/saudi/orders/"+createdOrder+"/reconcile",{paymentId},cookie);
 assert.equal(paid.status,200,JSON.stringify(paid.json));
 assert.equal(paid.json.status,"PAID");
 const [stock]=await db.select({available:saudiCatalogSubmissions.stock})
   .from(saudiCatalogSubmissions).where(eq(saudiCatalogSubmissions.id,goodId));
 assert.equal(stock.available,1);
 const duplicatePaid=await post("/api/saudi/orders/"+createdOrder+"/reconcile",{paymentId},cookie);
 assert.equal(duplicatePaid.status,200);
 const [stockAgain]=await db.select({available:saudiCatalogSubmissions.stock})
   .from(saudiCatalogSubmissions).where(eq(saudiCatalogSubmissions.id,goodId));
 assert.equal(stockAgain.available,1,"replayed payment cannot consume stock twice");
 const booking=await post("/api/saudi/bookings",{
  productId:serviceId,
  requestedSlot:new Date(Date.now()+2*86400000).toISOString().replace(/\.\d{3}Z$/,"Z"),
  note:"Customer asks for availability; no payment or confirmation"
 },cookie);
 assert.equal(booking.status,201,JSON.stringify(booking.json));
 assert.equal(booking.json.confirmed,false);
 const vendor=await originalFetch(base+"/api/saudi/vendor/bookings",{
  headers:{Cookie:vendorCookie}
 }).then(async r=>({status:r.status,body:await r.json()}));
 assert.equal(vendor.status,200);
 assert.ok(vendor.body.requests.some((b:any)=>b.id===booking.json.booking.id));
 const accepted=await originalFetch(base+"/api/saudi/vendor/bookings/"+booking.json.booking.id,{
  method:"PATCH",headers:{Cookie:vendorCookie,Origin:base,"Content-Type":"application/json"},
  body:JSON.stringify({status:"ACCEPTED"})
 }).then(async r=>({status:r.status,body:await r.json()}));
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 assert.equal(accepted.body.booking.status,"ACCEPTED");
});
