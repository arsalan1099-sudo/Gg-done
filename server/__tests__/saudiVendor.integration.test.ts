import {test,after,before} from "node:test";
import {strict as assert} from "node:assert";
import crypto from "node:crypto";
import express from "express";
import type {Server} from "node:http";
import {pool} from "../db";
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
 const item={title:"Saudi coffee",priceHalalas:1599,stock:4,description:"Premium local coffee"};
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
