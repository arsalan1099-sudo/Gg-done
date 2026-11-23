import {test,after,before} from "node:test";
import {strict as assert} from "node:assert";
import crypto from "node:crypto";
import express from "express";
import type {Server} from "node:http";
import {pool} from "../db";
import webpush from "web-push";
import {notifyDeliveryPartners} from "../saudiDeliveryPush";
import {rankedDeliveries} from "../saudiDelivery";
import {registerSaudiMarket} from "../saudiMarket";

let server:Server,base="",adminToken="";
const adminHeaders=()=>({Authorization:"Bearer "+adminToken,"Content-Type":"application/json"});
const json=async(path:string,init:RequestInit={})=>{
 const res=await fetch(base+path,init);
 const data=await res.json() as any;
 return {res,data};
};
const post=async(path:string,body:unknown,extra:Record<string,string>={})=>json(path,{
 method:"POST",headers:{"Content-Type":"application/json",Origin:base,...extra},body:JSON.stringify(body)
});
const patch=async(path:string,body:unknown,extra:Record<string,string>={})=>json(path,{
 method:"PATCH",headers:{"Content-Type":"application/json",Origin:base,...extra},body:JSON.stringify(body)
});
before(async()=>{
 adminToken=crypto.randomBytes(32).toString("hex");
 process.env.GO_SAUDI_ADMIN_TOKEN_SHA256=crypto.createHash("sha256").update(adminToken).digest("hex");
 const app=express();
 app.use(express.json({limit:"32kb"}));
 registerSaudiMarket(app);
 await new Promise<void>(resolve=>{
   server=app.listen(0,"127.0.0.1",resolve);
 });
 const a=server.address();
 if(!a||typeof a==="string")throw Error("Test server has no assigned port");
 base="http://127.0.0.1:"+a.port;
});
after(async()=>{
 if(server)await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 await pool.end();
});

test("Saudi vendor onboarding, draft isolation, invitation replay and revocation",async()=>{
 const seed=async(businessName:string,phone:string)=>{
  const lead=await post("/api/saudi/seller-enquiries",{
    businessName,city:"Jeddah",category:"Food",phone,consent:true
  });
  assert.equal(lead.res.status,201,JSON.stringify(lead.data));
  const r=await json("/api/saudi/admin/seller-enquiries?page=1",{
    headers:{Authorization:"Bearer "+adminToken}
  });
  assert.equal(r.res.status,200);
  const item=r.data.leads.find((v:any)=>v.businessName===businessName);
  assert.ok(item,"New Saudi lead must appear in admin pipeline");
  assert.equal(item.status,"NEW");
  const url="/api/saudi/admin/seller-enquiries/"+item.id;
  for(const [status,note] of [["CONTACTED","Called merchant and confirmed intent"],["UNDER_REVIEW","Reviewing merchant's documents"],["APPROVED","Valid eligible business documents verified"]] as const){
    const result=await patch(url,{
      status,note,checks:{phoneConfirmed:true,businessDocumentsChecked:true,complianceReviewed:true}
    },adminHeaders());
    assert.equal(result.res.status,200,JSON.stringify(result.data));
  }
  return item.id as string;
 };
 const a=await seed("Saudi Test A "+Date.now(),"0551234567");
 const b=await seed("Saudi Test B "+Date.now(),"0551234568");
 // Admin requires a valid private bearer even when seller is approved.
 const unauth=await post("/api/saudi/admin/vendor-invites",{enquiryId:a});
 assert.equal(unauth.res.status,401);
 const inviteA=await post("/api/saudi/admin/vendor-invites",{enquiryId:a},adminHeaders());
 assert.equal(inviteA.res.status,201,JSON.stringify(inviteA.data));
 assert.match(inviteA.data.inviteToken,/^[a-f0-9]{64}$/);
 const invB=await post("/api/saudi/admin/vendor-invites",{enquiryId:b},adminHeaders());
 assert.equal(invB.res.status,201);
 const pre=await json("/api/saudi/vendor/me");
 assert.equal(pre.res.status,401);
 const activation=await post("/api/saudi/vendor/activate",{inviteToken:inviteA.data.inviteToken});
 assert.equal(activation.res.status,200,JSON.stringify(activation.data));
 assert.equal(activation.data.sessionToken,undefined,"No JS-readable session token");
 const cookie=activation.res.headers.get("set-cookie")||"";
 assert.match(cookie,/__Host-go_saudi_vendor=/);
 assert.match(cookie,/httponly/i);
 assert.match(cookie,/secure/i);
 assert.match(cookie,/samesite=strict/i);
 const cookieA=cookie.split(";")[0];
 const reused=await post("/api/saudi/vendor/activate",{inviteToken:inviteA.data.inviteToken});
 assert.equal(reused.res.status,401,"One-time invitation cannot be replayed");
 const profileA=await json("/api/saudi/vendor/me",{headers:{Cookie:cookieA}});
 assert.equal(profileA.res.status,200);
 assert.equal(profileA.data.store.status,"DRAFT");
 assert.equal(profileA.data.paymentsEnabled,false);
 const categoryList=await json("/api/saudi/categories");
 assert.equal(categoryList.res.status,200);
 assert.equal(categoryList.data.groups.length,5);
 assert.equal(categoryList.data.subcategories.length,109);
 const item={title:"Saudi coffee",priceHalalas:1599,stock:4,subcategoryId:"sc5",description:"Premium local coffee"};
 const csrf=await json("/api/saudi/vendor/products",{
  method:"POST",headers:{Cookie:cookieA,"Content-Type":"application/json"},body:JSON.stringify(item)
 });
 assert.equal(csrf.res.status,403,"Cookie session mutation without Origin must be rejected");
 const add=await post("/api/saudi/vendor/products",item,{Cookie:cookieA});
 assert.equal(add.res.status,201,JSON.stringify(add.data));
 const prodId=add.data.product.id;
 const list=await json("/api/saudi/vendor/products",{headers:{Cookie:cookieA}});
 assert.equal(list.res.status,200);
 assert.ok(list.data.products.some((p:any)=>p.id===prodId&&p.status==="DRAFT"));
 const catalogBefore=await json("/api/saudi/catalog");
 assert.equal(catalogBefore.res.status,200);
 assert.equal(catalogBefore.data.available,false);
 assert.deepEqual(catalogBefore.data.products,[]);
 const submission=await post("/api/saudi/vendor/catalog-submissions",{draftId:prodId},{Cookie:cookieA});
 assert.equal(submission.res.status,201,JSON.stringify(submission.data));
 const submissionId=submission.data.submission.id as string;
 const catalogQueue=await json("/api/saudi/admin/catalog-submissions?status=PENDING",{
   headers:{Authorization:"Bearer "+adminToken}
 });
 assert.equal(catalogQueue.res.status,200);
 assert.ok(catalogQueue.data.submissions.some((p:any)=>p.id===submissionId));
 const blockedApproval=await patch("/api/saudi/admin/catalog-submissions/"+submissionId,{
   status:"APPROVED",note:"Reviewed product and shop documents"
 },adminHeaders());
 assert.equal(blockedApproval.res.status,423,"Approval forbidden without Saudi privacy and merchant checks");
 process.env.GO_SAUDI_PRIVACY_APPROVED="true";
 process.env.GO_SAUDI_MERCHANT_VERIFICATION_APPROVED="true";
 try{
   const approved=await patch("/api/saudi/admin/catalog-submissions/"+submissionId,{
     status:"APPROVED",note:"Merchant and catalog checks completed"
   },adminHeaders());
   assert.equal(approved.res.status,200,JSON.stringify(approved.data));
   assert.equal(approved.data.public,false);
   const stillClosed=await json("/api/saudi/catalog");
   assert.equal(stillClosed.data.available,false);
   process.env.GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED="true";
   process.env.GO_SAUDI_CATALOG_PUBLIC="true";
   const visible=await json("/api/saudi/catalog?city=Jeddah&category=Food");
   assert.equal(visible.res.status,200);
   assert.equal(visible.data.available,true);
   assert.equal(visible.data.checkoutEnabled,false);
   assert.ok(visible.data.products.some((p:any)=>p.id===submissionId&&p.priceHalalas===1599));
   assert.ok(visible.data.products.some((p:any)=>p.id===submissionId&&p.subcategoryId==="sc5"));
   const filtered=await json("/api/saudi/catalog?subcategory=sc5");
   assert.ok(filtered.data.products.some((p:any)=>p.id===submissionId));
   const noMatch=await json("/api/saudi/catalog?subcategory=sc6");
   assert.ok(noMatch.data.products.every((p:any)=>p.id!==submissionId));
   const invalidSubcategory=await json("/api/saudi/catalog?subcategory=../../etc/passwd");
   assert.equal(invalidSubcategory.res.status,400);
   assert.ok(visible.data.products.every((p:any)=>!p.phone&&!p.vendorId));
 }finally{
   delete process.env.GO_SAUDI_PRIVACY_APPROVED;
   delete process.env.GO_SAUDI_MERCHANT_VERIFICATION_APPROVED;
   delete process.env.GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED;
   delete process.env.GO_SAUDI_CATALOG_PUBLIC;
 }
 const bad=await post("/api/saudi/vendor/products",{...item,priceHalalas:1.15},{Cookie:cookieA});
 assert.equal(bad.res.status,400,"Fractional halalas invalid");
 const activateB=await post("/api/saudi/vendor/activate",{inviteToken:invB.data.inviteToken});
 assert.equal(activateB.res.status,200);
 const cookieB=(activateB.res.headers.get("set-cookie")||"").split(";")[0];
 const cross=await patch("/api/saudi/vendor/products/"+prodId,{...item,stock:999},{Cookie:cookieB});
 assert.equal(cross.res.status,404,"Vendor B cannot alter vendor A's product");
 const bList=await json("/api/saudi/vendor/products",{headers:{Cookie:cookieB}});
 assert.equal(bList.data.products.length,0,"Vendor B cannot see A's private drafts");
 const history=await json("/api/saudi/admin/seller-enquiries/"+a+"/events",{
   headers:{Authorization:"Bearer "+adminToken}
 });
 assert.equal(history.res.status,200);
 assert.equal(history.data.events.length,3);
 const revoked=await post("/api/saudi/admin/vendor-sessions/revoke",{enquiryId:a},adminHeaders());
 assert.equal(revoked.res.status,200);
 const expired=await json("/api/saudi/vendor/me",{headers:{Cookie:cookieA}});
 assert.equal(expired.res.status,401);
 const stillB=await json("/api/saudi/vendor/me",{headers:{Cookie:cookieB}});
 assert.equal(stillB.res.status,200);
 // Vendor can export only their own business information and draft catalog.
 const exportB=await json("/api/saudi/vendor/data-export",{headers:{Cookie:cookieB}});
 assert.equal(exportB.res.status,200);
 assert.equal(exportB.data.profile.businessName.includes("Saudi Test B"),true);
 assert.equal(exportB.data.profile.businessName.includes("Saudi Test A"),false);
 assert.equal(exportB.data.draftProducts.length,0);
 const exportUnauth=await json("/api/saudi/vendor/data-export");
 assert.equal(exportUnauth.res.status,401);
 const requestDelete=await post("/api/saudi/vendor/data-requests",{
   requestType:"DELETE_ACCOUNT",confirm:true
 },{Cookie:cookieB});
 assert.equal(requestDelete.res.status,201,JSON.stringify(requestDelete.data));
 const requestId=requestDelete.data.request.id as string;
 const duplicate=await post("/api/saudi/vendor/data-requests",{
   requestType:"DELETE_ACCOUNT",confirm:true
 },{Cookie:cookieB});
 assert.equal(duplicate.res.status,200);
 assert.equal(duplicate.data.request.id,requestId);
 const ownReq=await json("/api/saudi/vendor/data-requests",{headers:{Cookie:cookieB}});
 assert.equal(ownReq.res.status,200);
 assert.ok(ownReq.data.requests.some((r:any)=>r.id===requestId&&r.status==="PENDING"));
 const adminRequests=await json("/api/saudi/admin/data-requests",{
   headers:{Authorization:"Bearer "+adminToken}
 });
 assert.equal(adminRequests.res.status,200);
 assert.ok(adminRequests.data.requests.some((r:any)=>r.id===requestId));
 assert.equal(adminRequests.data.erasureEnabled,false);
 // Actual deletion is off by default; neither consent nor the admin key
 // alone permits irreversible removal.
 const locked=await post("/api/saudi/admin/data-requests/"+requestId+"/complete",{
   identityVerified:true,retentionReviewed:true,confirmation:requestId+":ERASE"
 },adminHeaders());
 assert.equal(locked.res.status,423);
 const remaining=await json("/api/saudi/vendor/me",{headers:{Cookie:cookieB}});
 assert.equal(remaining.res.status,200);
 process.env.GO_SAUDI_ACCOUNT_ERASURE_ENABLED="true";
 try{
   const unverified=await post("/api/saudi/admin/data-requests/"+requestId+"/complete",{
     identityVerified:false,retentionReviewed:true,confirmation:requestId+":ERASE"
   },adminHeaders());
   assert.equal(unverified.res.status,400);
   const completed=await post("/api/saudi/admin/data-requests/"+requestId+"/complete",{
     identityVerified:true,retentionReviewed:true,confirmation:requestId+":ERASE"
   },adminHeaders());
   assert.equal(completed.res.status,200,JSON.stringify(completed.data));
   assert.equal(completed.data.personalDataDeleted,true);
   const revokedB=await json("/api/saudi/vendor/me",{headers:{Cookie:cookieB}});
   assert.equal(revokedB.res.status,401);
   const completedReceipts=await json("/api/saudi/admin/data-requests?status=COMPLETED",{
     headers:{Authorization:"Bearer "+adminToken}
   });
   assert.equal(completedReceipts.res.status,200);
   const receipt=completedReceipts.data.requests.find((r:any)=>r.id===requestId);
   assert.ok(receipt);
   assert.equal(receipt.status,"COMPLETED");
   assert.equal(receipt.phone,null);
   assert.equal(receipt.businessName,null);
   const retry=await post("/api/saudi/admin/data-requests/"+requestId+"/complete",{
     identityVerified:true,retentionReviewed:true,confirmation:requestId+":ERASE"
   },adminHeaders());
   assert.equal(retry.res.status,409);
 }finally{delete process.env.GO_SAUDI_ACCOUNT_ERASURE_ENABLED}
});
test("unverified public commerce cannot create orders, bookings, OTPs or payments",async()=>{
 const readiness=await json("/api/saudi/commerce/readiness");
 assert.equal(readiness.res.status,200);
 assert.equal(readiness.data.liveOrders,false);
 assert.equal(readiness.data.livePayments,false);
 assert.equal(readiness.data.liveBookings,false);
 assert.ok(readiness.data.blockedBy.includes("GO_SAUDI_ESTORE_VERIFIED"));
 const productId="SVC_"+"a".repeat(30);
 const quote=await post("/api/saudi/checkout/quote",{
   items:[{productId,quantity:1}]
 });
 assert.equal(quote.res.status,423);
 const sendOtp=await post("/api/saudi/customer/otp/start",{
   phone:"0551234567",consent:true
 });
 assert.equal(sendOtp.res.status,423);
 const verifyOtp=await post("/api/saudi/customer/otp/verify",{
   phone:"0551234567",code:"123456"
 });
 assert.equal(verifyOtp.res.status,423);
 const order=await post("/api/saudi/orders",{
   items:[{productId,quantity:1}],idempotencyKey:"test_order_1234567890",
   fulfillment:"PICKUP"
 });
 assert.equal(order.res.status,401,"Orders require a verified customer cookie");
 const booking=await post("/api/saudi/bookings",{
   productId,requestedSlot:"2026-12-12T10:00:00Z"
 });
 assert.equal(booking.res.status,401,"Bookings require a verified customer cookie");
 const intent=await post("/api/saudi/orders/"+"SO_"+"b".repeat(30)+"/payment-intent",{});
 assert.equal(intent.res.status,401,"Payments require verified customer and order ownership");
});
test("concurrent same seller submissions deduplicate transactionally",async()=>{
 const businessName="Saudi Duplicate Race "+Date.now();
 const payload={businessName,city:"Jeddah",category:"Food",phone:"0551234569",consent:true};
 const [a,b]=await Promise.all([
   post("/api/saudi/seller-enquiries",payload),
   post("/api/saudi/seller-enquiries",payload)
 ]);
 assert.deepEqual([a.res.status,b.res.status].sort(),[200,201]);
 const leads=await json("/api/saudi/admin/seller-enquiries?page=1",{
   headers:{Authorization:"Bearer "+adminToken}
 });
 assert.equal(leads.res.status,200);
 assert.equal(leads.data.leads.filter((x:any)=>x.businessName===businessName).length,1);
});
test("CSP prevents arbitrary inline script injection",async()=>{
 for(const page of ["/","/saudi-admin","/vendor"]){
  const res=await fetch(base+page);
  assert.equal(res.status,200,page);
  const csp=res.headers.get("content-security-policy")||"";
  assert.match(csp,/script-src 'sha256-/);
  assert.doesNotMatch(csp,/script-src 'unsafe-inline'/);
  assert.match(csp,/frame-ancestors 'none'/);
 }
});

test("only admins can assign an available city to one franchise operator", async () => {
 const path="/api/saudi/admin/franchises";
 const operatorName="CI "+crypto.randomUUID();
 const application={city:"Jeddah",operatorName};
 assert.equal((await json(path)).res.status,401);
 assert.equal((await post(path,application)).res.status,401);
 assert.equal((await post(path,{...application,city:"Other"},adminHeaders())).res.status,400);
 assert.equal((await post(path,{...application,operatorName:" "},adminHeaders())).res.status,400);
 try {
   const results=await Promise.all([post(path,application,adminHeaders()),post(path,application,adminHeaders())]);
   assert.deepEqual(results.map(result=>result.res.status).sort(),[201,409]);
   const list=await json(path,{headers:adminHeaders()});
   assert.equal(list.res.status,200);
   assert.ok(list.data.cities.includes(application.city));
   assert.deepEqual(list.data.franchises.filter((row:any)=>row.city===application.city),[application]);
 } finally {
   await pool.query("DELETE FROM saudi_city_franchises WHERE city=$1 AND operator_name=$2",[application.city,operatorName]);
 }
});

test("franchise owners hire both roles within their own city and lose access on key rotation",async()=>{
 const owner=crypto.randomUUID(),team="/api/saudi/franchise/team",admin="/api/saudi/admin/franchises";
 const application={name:"Test member",role:"MARKETING_EXECUTIVE",mobile:"0551234567"};
 const ownerHeaders=(token:string)=>({Authorization:"Bearer "+token});
 try {
  const keys:string[]=[];
  for(const city of ["Jeddah","Riyadh"]){
   assert.equal((await post(admin,{city,operatorName:owner},adminHeaders())).res.status,201);
   const issue=admin+"/"+city+"/owner-key";
   assert.equal((await post(issue,{})).res.status,401);
   const key=await post(issue,{},adminHeaders());
   assert.equal(key.res.status,200);
   keys.push(key.data.token);
  }
  const first=ownerHeaders(keys[0]),second=ownerHeaders(keys[1]);
  assert.equal((await post(team,application)).res.status,401);
  assert.equal((await post(admin+"/Jeddah/owner-key",{},first)).res.status,401);
  assert.equal((await post(team,{...application,city:"Riyadh"},first)).res.status,400);
  assert.equal((await post(team,{...application,role:"ADMIN"},first)).res.status,400);
  for(const role of ["MARKETING_EXECUTIVE","DELIVERY_PARTNER"]){
   const created=await post(team,{...application,role},first);
   assert.equal(created.res.status,201);
   assert.equal(created.data.member.city,"Jeddah");
  }
  assert.equal((await post(team,{...application,mobile:"+966551234567"},first)).res.status,409);
  assert.equal((await json(team,{headers:first})).data.members.length,2);
  assert.deepEqual((await json(team+"?city=Jeddah",{headers:second})).data.members,[]);
  const next=await post(admin+"/Jeddah/owner-key",{},adminHeaders());
  assert.equal((await json(team,{headers:first})).res.status,401);
  assert.equal((await json(team,{headers:ownerHeaders(next.data.token)})).data.members.length,2);
 }finally{
  await pool.query("DELETE FROM saudi_franchise_team WHERE city IN (SELECT city FROM saudi_city_franchises WHERE operator_name=$1)",[owner]);
  await pool.query("DELETE FROM saudi_city_franchises WHERE operator_name=$1",[owner]);
 }
});

test("marketing executive submits a consented city-bound application to the admin queue",async()=>{
 const operator=crypto.randomUUID(),name="Executive Test",city="Jeddah";
 const businessName="Shop "+crypto.randomUUID();
 const team="/api/saudi/franchise/team",admin="/api/saudi/admin/franchises";
 const route="/api/saudi/marketing/seller-enquiries";
 const form={businessName,category:"Food",phone:"0558765432",consent:true,city:"Riyadh",status:"APPROVED",executiveName:"Other"};
 const headers=(key:string)=>({Authorization:"Bearer "+key});
 try{
  assert.equal((await post(admin,{city,operatorName:operator},adminHeaders())).res.status,201);
  const owner=headers((await post(admin+"/"+city+"/owner-key",{},adminHeaders())).data.token);
  for(const role of ["MARKETING_EXECUTIVE","DELIVERY_PARTNER"]){
   assert.equal((await post(team,{role,name,mobile:"0559876543"},owner)).res.status,201);
  }
  const members=(await json(team,{headers:owner})).data.members;
  const issue=(role:string)=>post(team+"/executive-key",{memberId:members.find((m:any)=>m.role===role).id},owner);
  assert.equal((await issue("DELIVERY_PARTNER")).res.status,404);
  const executive=headers((await issue("MARKETING_EXECUTIVE")).data.token);
  assert.equal((await post(route,form,owner)).res.status,401);
  assert.equal((await post(route,{...form,consent:false},executive)).res.status,400);
  assert.equal((await post(route,form,executive)).res.status,201);
  assert.equal((await post(route,form,executive)).data.deduplicated,true);
  const queue=(await json("/api/saudi/admin/seller-enquiries?status=NEW",{headers:adminHeaders()})).data.leads;
  const matches=queue.filter((row:any)=>row.businessName===businessName);
  assert.equal(matches.length,1);
  assert.equal(matches[0].city,city);
  assert.equal(matches[0].executiveName,name);
  assert.equal((await patch("/api/saudi/admin/seller-enquiries/"+matches[0].id,{status:"APPROVED"},executive)).res.status,401);
  await issue("MARKETING_EXECUTIVE");
  assert.equal((await post(route,form,executive)).res.status,401);
 }finally{
  await pool.query("DELETE FROM seller_enquiries WHERE business_name=$1",[businessName]);
  await pool.query("DELETE FROM saudi_franchise_team WHERE city IN (SELECT city FROM saudi_city_franchises WHERE operator_name=$1)",[operator]);
  await pool.query("DELETE FROM saudi_city_franchises WHERE operator_name=$1",[operator]);
 }
});

test("delivery request is offered only to the nearest fresh same-city partner and claimed once",async()=>{
 const id=crypto.randomBytes(15).toString("hex"),order="SO_"+id;
 const first=crypto.randomBytes(32).toString("hex"),second=crypto.randomBytes(32).toString("hex");
 const session=crypto.randomBytes(32).toString("hex");
 const hash=(s:string)=>crypto.createHash("sha256").update(s).digest("hex");
 const headers=(key:string)=>({Authorization:"Bearer "+key});
 const root="/api/saudi/delivery",city="Taif";
 try {
   await pool.query("INSERT INTO saudi_city_franchises(city,operator_name) VALUES($1,$2)",[city,id]);
   for(const [key,mobile] of [[first,"+966511111111"],[second,"+966522222222"]]){
     await pool.query("INSERT INTO saudi_franchise_team(city,name,mobile,role,delivery_key_hash) VALUES($1,'Partner',$2,'DELIVERY_PARTNER',$3)",[city,mobile,hash(key)]);
   }
   await pool.query("INSERT INTO seller_enquiries(id,business_name,city,category,phone,status) VALUES($1,'Test shop',$2,'Food','+966511111111','APPROVED')",[id,city]);
   await pool.query("INSERT INTO saudi_vendor_accounts(id,enquiry_id) VALUES($1,$1)",[id]);
   await pool.query("INSERT INTO saudi_vendor_sessions(id,vendor_id,token_hash,expires_at) VALUES($1,$1,$2,now()+interval '1 hour')",[id,hash(session)]);
   await pool.query("INSERT INTO saudi_customer_accounts(id,phone_hash,phone_encrypted) VALUES($1,$1,'fixture')",[id]);
   await pool.query("INSERT INTO saudi_orders(id,customer_id,vendor_id,idempotency_key,subtotal_halalas,expires_at) VALUES($1,$2,$2,$2,100,now())",[order,id]);
   const payload={orderId:order,latitude:21.27,longitude:40.41,requestedByCustomer:true};
   const vendor={Cookie:"__Host-go_saudi_vendor="+session};
   const dispatch=()=>post("/api/saudi/vendor/delivery-requests",payload,vendor);
   assert.equal((await dispatch()).res.status,409);
   await pool.query("UPDATE saudi_orders SET status='PAID' WHERE id=$1",[order]);
   assert.equal((await dispatch()).res.status,201);
   const location=(key:string,latitude:number)=>post(root+"/location",{latitude,longitude:40.41},headers(key));
   const offers=async(key:string)=>(await json(root+"/offers",{headers:headers(key)})).data.offers.map((r:any)=>r.order_id);
   assert.equal((await location(first,21.28)).res.status,200);
   assert.equal((await location(second,21.9)).res.status,200);
   const endpoint="https://fcm.googleapis.com/fcm/send/test-subscription";
   assert.equal((await post(root+"/push",{endpoint:"https://example.org"},headers(first))).res.status,400);
   assert.equal((await post(root+"/push",{endpoint},headers(first))).res.status,200);
   const notified:string[]=[];
   const send:typeof webpush.sendNotification=async(sub,payload,options)=>{
     const request=webpush.generateRequestDetails(sub,payload,options);
     assert.equal(request.endpoint,endpoint);
     assert.match(String(request.headers.Authorization),/^vapid /);
     notified.push(sub.endpoint);
     return {statusCode:201,headers:{},body:""};
   };
   await offers(first);
   await notifyDeliveryPartners(rankedDeliveries,send);
   await notifyDeliveryPartners(rankedDeliveries,send);
   assert.deepEqual(notified,[endpoint]);
   assert.deepEqual(await offers(first),[order]);assert.deepEqual(await offers(second),[]);
   await pool.query("UPDATE saudi_franchise_team SET located_at=now()-interval '2 minutes' WHERE delivery_key_hash=$1",[hash(first)]);
   assert.deepEqual(await offers(second),[order]);
   assert.equal((await post(root+"/accept",{orderId:order},headers(first))).res.status,409);
   const claim=()=>post(root+"/accept",{orderId:order},headers(second));
   assert.deepEqual((await Promise.all([claim(),claim()])).map(x=>x.res.status).sort(),[200,409]);
   assert.equal((await post(root+"/complete",{orderId:order},headers(first))).res.status,409);
   assert.equal((await post(root+"/complete",{orderId:order},headers(second))).res.status,200);
   const nextOrder="SO_"+crypto.randomBytes(15).toString("hex");
   await pool.query("INSERT INTO saudi_orders(id,customer_id,vendor_id,idempotency_key,subtotal_halalas,expires_at,status) VALUES($1,$2,$2,$1,100,now(),'PAID')",[nextOrder,id]);
   assert.equal((await location(first,21.28)).res.status,200);
   assert.equal((await post("/api/saudi/vendor/delivery-requests",{...payload,orderId:nextOrder},vendor)).res.status,201);
   assert.deepEqual(await offers(first),[nextOrder]);
   const decline=(key:string)=>post(root+"/decline",{orderId:nextOrder},headers(key));
   assert.equal((await decline(second)).res.status,409);
   assert.equal((await decline(first)).res.status,200);
   assert.deepEqual(await offers(second),[nextOrder]);
   await pool.query("UPDATE saudi_delivery_requests SET offer_until=now()-interval '1 second' WHERE order_id=$1",[nextOrder]);
   assert.equal((await post(root+"/accept",{orderId:nextOrder},headers(second))).res.status,409);
   assert.deepEqual(await offers(first),[]);
   assert.deepEqual(await offers(second),[]);
 } finally {
   await pool.query("DELETE FROM saudi_delivery_requests WHERE order_id IN (SELECT id FROM saudi_orders WHERE customer_id=$1)",[id]);
   await pool.query("DELETE FROM saudi_orders WHERE customer_id=$1",[id]);
   await pool.query("DELETE FROM saudi_customer_accounts WHERE id=$1",[id]);
   await pool.query("DELETE FROM seller_enquiries WHERE id=$1",[id]);
   await pool.query("DELETE FROM saudi_franchise_team WHERE delivery_key_hash IN ($1,$2)",[hash(first),hash(second)]);
   await pool.query("DELETE FROM saudi_city_franchises WHERE operator_name=$1",[id]);
 }
});

test("verified membership is credited once and renewal carries no onboarding commission",async()=>{
 const {SAUDI_COMMERCE_GATES}=await import("../saudiCommerceRules");
 const id="SL_"+crypto.randomBytes(15).toString("hex"),invoiceId=crypto.randomUUID(),paymentId=crypto.randomUUID();
 const path="/api/saudi/admin/seller-enquiries/"+id+"/membership";
 const env:Record<string,string>={...Object.fromEntries(SAUDI_COMMERCE_GATES.map(k=>[k,"true"])),GO_SAUDI_PAYMENTS_ENABLED:"true",
   MOYASAR_SECRET_KEY:"sk_live_"+"x".repeat(20),MOYASAR_PUBLISHABLE_KEY:"pk_live_"+"x".repeat(20),
   MOYASAR_WEBHOOK_SECRET_TOKEN:"x".repeat(32),APP_PUBLIC_URL:"https://example.test",TWILIO_VERIFY_SERVICE_SID:"VA"+"a".repeat(32),
   TWILIO_API_KEY:"SK"+"a".repeat(32),TWILIO_ACCOUNT_SID:"AC"+"a".repeat(32),TWILIO_API_SECRET:"test",GO_SAUDI_CUSTOMER_ENCRYPTION_KEY:"a".repeat(64)};
 const autoId="SL_"+crypto.randomBytes(15).toString("hex"),executive=crypto.randomUUID(),source=crypto.randomUUID();
 Object.assign(env,{GO_SAUDI_EXECUTIVE_PAYOUTS_ENABLED:"true",MOYASAR_PAYOUT_SOURCE_ID:source,
   GO_SAUDI_VERIFIED_BENEFICIARIES_JSON:JSON.stringify({[executive]:{iban:"SA"+"0".repeat(22),name:"Fixture",city:"Jeddah",mobile:"0551234567"}})});
 const original=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 const invoice={id:invoiceId,status:"paid",currency:"SAR",amount:99900,description:"",payments:[{id:paymentId,status:"paid",currency:"SAR",amount:99900,refunded:0,updated_at:new Date().toISOString()}]};
 try{
   await pool.query("INSERT INTO seller_enquiries(id,business_name,city,category,phone,status,executive_id) VALUES($1,'Test','Jeddah','Food','+966511111111','APPROVED',$2)",[id,crypto.randomUUID()]);
   Object.assign(process.env,env);
   globalThis.fetch=(input,init)=>String(input).startsWith("https://api.moyasar.com/v1/invoices/")
     ? Promise.resolve(Response.json(invoice)):originalFetch(input,init);
   const verify=(term:number)=>post(path,{invoiceId:invoice.id,term},adminHeaders());
   assert.equal((await verify(1)).res.status,409);
   invoice.description=(await json(path,{headers:adminHeaders()})).data.reference;
   const pair=await Promise.all([verify(1),verify(1)]);
   assert.deepEqual(pair.map(r=>r.res.status).sort(),[200,201]);
   assert.equal(pair[0].data.commission_halalas,14985);
   const firstUntil=pair[0].data.valid_until;
   invoice.id=crypto.randomUUID();invoice.payments[0].id=crypto.randomUUID();
   invoice.description=(await json(path,{headers:adminHeaders()})).data.reference;
   const renewal=await verify(2);
   assert.equal(renewal.res.status,201);assert.equal(renewal.data.commission_halalas,0);
   assert.ok(renewal.data.valid_until>firstUntil);
   await pool.query("INSERT INTO seller_enquiries(id,business_name,city,category,phone,status,executive_id) VALUES($1,'Auto Test','Jeddah','Food','+966511111111','APPROVED',$2)",[autoId,executive]);
   const invoices=new Map<string,any>(),payoutIds:string[]=[];
   globalThis.fetch=async(input,init)=>{
     const url=String(input),body=JSON.parse(String(init?.body||"{}"));
     if(url==="https://api.moyasar.com/v1/invoices"){
       const generated={...body,id:crypto.randomUUID(),status:"paid",url:"https://moyasar.com/test-invoice",payments:[{...invoice.payments[0],id:crypto.randomUUID()}]};
       invoices.set(generated.id,generated);return Response.json(generated);
     }
     if(url.startsWith("https://api.moyasar.com/v1/invoices/"))return Response.json(invoices.get(url.split("/").pop()!)||invoice);
     if(url==="https://api.moyasar.com/v1/payouts"){
       payoutIds.push(body.given_id);
       if(payoutIds.length===1)throw Error("Simulated lost response");
       return Response.json({id:body.given_id,source_id:source,amount:body.amount,currency:"SAR",status:"paid"});
     }
     return originalFetch(input,init);
   };
   const {runMembershipAutomation}=await import("../saudiMembershipAutomation");
   await runMembershipAutomation();await runMembershipAutomation();await runMembershipAutomation();
   assert.equal([...invoices.values()].filter(i=>i.description.includes(autoId)).length,1);
   assert.equal(payoutIds.length,2);assert.equal(new Set(payoutIds).size,1);
   const autoReceipt=await pool.query("SELECT term,commission_halalas,payout_state FROM saudi_membership_receipts WHERE enquiry_id=$1",[autoId]);
   assert.deepEqual(autoReceipt.rows,[{term:1,commission_halalas:14985,payout_state:"paid"}]);
 }finally{
   globalThis.fetch=originalFetch;
   for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
   await pool.query("DELETE FROM saudi_vendor_invoices WHERE enquiry_id=$1",[autoId]);
   await pool.query("DELETE FROM saudi_membership_receipts WHERE enquiry_id IN ($1,$2)",[id,autoId]);
   await pool.query("DELETE FROM seller_enquiries WHERE id=$1",[autoId]);
   await pool.query("DELETE FROM seller_enquiries WHERE id=$1",[id]);
 }
});
