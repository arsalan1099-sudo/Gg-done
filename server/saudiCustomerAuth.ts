import crypto from "node:crypto";
import type {Express,Request,Response,NextFunction} from "express";
import rateLimit from "express-rate-limit";
import {and,eq,gt,isNull} from "drizzle-orm";
import {db} from "./db";
import {saudiCustomerAccounts,saudiCustomerSessions} from "@shared/schema";
import {logSaudiError} from "./saudiLog";
import {safeSaudiPhone,isSaudiOtpCode} from "./saudiCommerceRules";
import {requestSaudiOtp,checkSaudiOtp} from "./saudiPaymentProviders";

const NAME="__Host-go_saudi_customer";
const cookieFlags="Path=/; Secure; HttpOnly; SameSite=Strict";
const uid=(prefix:string)=>prefix+crypto.randomBytes(15).toString("hex");
const hexHash=(s:string)=>crypto.createHash("sha256").update(s,"utf8").digest("hex");
const noStore=(res:Response)=>{
 res.setHeader("Cache-Control","private, no-store");
 res.setHeader("Pragma","no-cache");
};
function key():Buffer{
 const v=process.env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY||"";
 if(!/^[0-9a-f]{64}$/i.test(v))throw Error("Customer encryption secret missing");
 return Buffer.from(v,"hex");
}
export function encryptSaudiCustomerPhone(phone:string):string{
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);
 const encrypted=Buffer.concat([cipher.update(phone,"utf8"),cipher.final()]);
 return [iv,cipher.getAuthTag(),encrypted].map(x=>x.toString("base64url")).join(".");
}
function phoneDigest(phone:string):string{
 return crypto.createHmac("sha256",key()).update("go-saudi-customer-phone:"+phone).digest("hex");
}
function otpOpen():boolean{
 return process.env.GO_SAUDI_PRIVACY_APPROVED==="true"&&
  process.env.GO_SAUDI_CUSTOMER_OTP_ENABLED==="true"&&
  process.env.GO_SAUDI_ESTORE_VERIFIED==="true"&&
  process.env.GO_SAUDI_CUSTOMER_DATA_RIGHTS_READY==="true";
}
function expectedOrigin(req:Request):string{
 return process.env.NODE_ENV==="production"?
  new URL(process.env.APP_PUBLIC_URL||"https://invalid.invalid").origin:
  "http://"+req.get("host");
}
function sameOrigin(req:Request):boolean{
 return req.header("Origin")===expectedOrigin(req);
}
// Transport selection is not identity: provider-side SMS approval is still
// mandatory before an Android/iOS bearer token can be issued.
function nativeClient(req:Request):boolean{
 return !req.header("Origin")&&req.header("X-Go-Saudi-Client")==="native"&&
  /^(android|ios)$/.test(req.header("X-Go-Saudi-Platform")||"");
}
function permittedOtpRequest(req:Request):boolean{
 return sameOrigin(req)||nativeClient(req);
}
function otpProviderConfigured():boolean{
 return /^VA[a-f0-9]{32}$/i.test(process.env.TWILIO_VERIFY_SERVICE_SID||"")&&
  /^SK[a-f0-9]{32}$/i.test(process.env.TWILIO_API_KEY||"")&&
  !!process.env.TWILIO_API_SECRET;
}
const verifyLimiter=rateLimit({
 windowMs:15*60*1000,limit:5,standardHeaders:true,legacyHeaders:false,
 message:{error:"Too many OTP attempts"}
});

export async function saudiCustomerAuthorized(req:Request,res:Response,next:NextFunction){
 noStore(res);
 if(req.header("Origin")&&!sameOrigin(req))
  return res.status(403).json({error:"Untrusted request origin"});
 const authorization=req.header("Authorization");
 let token:string;
 let bearer=false;
 if(authorization){
  if(!/^Bearer [a-f0-9]{64}$/.test(authorization))
   return res.status(401).json({error:"Invalid session credentials"});
  token=authorization.slice(7);
  bearer=true;
 }else{
  const raw=req.header("Cookie")||"";
  if(raw.length>4096)return res.status(401).json({error:"Customer login required"});
  const re=/(?:^|;\\s*)__Host-go_saudi_customer=([a-f0-9]{64})(?=;|$)/g;
  const tokens=[...raw.matchAll(re)];
  if(tokens.length!==1)return res.status(401).json({error:"Customer login required"});
  if(["POST","PUT","PATCH","DELETE"].includes(req.method)&&!sameOrigin(req))
   return res.status(403).json({error:"Same-origin customer request required"});
  token=tokens[0][1];
 }
 try{
  const [session]=await db.select({
   id:saudiCustomerSessions.id,customerId:saudiCustomerSessions.customerId
  }).from(saudiCustomerSessions)
   .innerJoin(saudiCustomerAccounts,eq(saudiCustomerAccounts.id,saudiCustomerSessions.customerId))
   .where(and(
    eq(saudiCustomerSessions.tokenHash,hexHash(token)),
    isNull(saudiCustomerSessions.revokedAt),
    gt(saudiCustomerSessions.expiresAt,new Date())
   )).limit(1);
  if(!session)return res.status(401).json({error:"Customer session expired"});
  res.locals.saudiCustomer={id:session.customerId,sessionId:session.id,bearer};
  next();
 }catch(err){logSaudiError("SAUDI_CUSTOMER_AUTH",err);
  return res.status(503).json({error:"Customer login unavailable"});}
}
export function registerSaudiCustomerAuth(app:Express):void{
 app.get("/api/saudi/customer/auth/status",(_req,res)=>{
  noStore(res);
  return res.json({country:"SA",method:"sms_otp",available:otpOpen()&&otpProviderConfigured(),
    note:"Real provider-verified Saudi phone login; no local/fake OTP."});
 });
 app.post("/api/saudi/customer/otp/start",verifyLimiter,async(req,res)=>{
  noStore(res);
  if(!otpOpen())return res.status(423).json({error:"Verified Saudi customer registration not yet available"});
  if(!permittedOtpRequest(req))return res.status(403).json({error:"Verified web origin or native client required"});
  const phone=safeSaudiPhone(req.body?.phone);
  if(!phone||req.body?.consent!==true)
   return res.status(400).json({error:"Saudi mobile and explicit data-processing consent required"});
  try{
   const pending=await requestSaudiOtp(phone);
   if(!pending)return res.status(503).json({error:"OTP provider unavailable"});
   return res.status(202).json({sent:true,provider:"sms",expiresMinutes:10});
  }catch(err){logSaudiError("SAUDI_CUSTOMER_OTP",err);
   return res.status(503).json({error:"OTP service temporarily unavailable"});}
 });
 app.post("/api/saudi/customer/otp/verify",verifyLimiter,async(req,res)=>{
  noStore(res);
  if(!otpOpen())return res.status(423).json({error:"Verified Saudi customer login not yet available"});
  if(!permittedOtpRequest(req))return res.status(403).json({error:"Verified web origin or native client required"});
  const phone=safeSaudiPhone(req.body?.phone),code=req.body?.code;
  if(!phone||!isSaudiOtpCode(code))return res.status(400).json({error:"Valid Saudi mobile and verification code required"});
  try{
   const approved=await checkSaudiOtp(phone,code);
   if(!approved)return res.status(401).json({error:"Verification failed"});
   const token=crypto.randomBytes(32).toString("hex"),digest=phoneDigest(phone);
   const customer=await db.transaction(async tx=>{
    const [existing]=await tx.select({id:saudiCustomerAccounts.id})
     .from(saudiCustomerAccounts).where(eq(saudiCustomerAccounts.phoneHash,digest)).limit(1);
    if(existing)return existing;
    await tx.insert(saudiCustomerAccounts).values({
     id:uid("SCU_"),phoneHash:digest,phoneEncrypted:encryptSaudiCustomerPhone(phone)
    }).onConflictDoNothing();
    const [record]=await tx.select({id:saudiCustomerAccounts.id}).from(saudiCustomerAccounts)
      .where(eq(saudiCustomerAccounts.phoneHash,digest)).limit(1);
    if(!record)throw Error("Customer creation incomplete");
    return record;
   });
   await db.insert(saudiCustomerSessions).values({
    id:uid("SCS_"),customerId:customer.id,tokenHash:hexHash(token),
    expiresAt:new Date(Date.now()+12*60*60*1000)
   });
   if(nativeClient(req)){
    // Return raw bearer token only after Twilio approved SMS verification.
    // It is stored as a hash server-side and must not enter logs.
    return res.json({authenticated:true,sessionToken:token,tokenType:"Bearer",expiresHours:12});
   }
   res.setHeader("Set-Cookie",NAME+"="+token+"; "+cookieFlags+"; Max-Age=43200");
   return res.json({authenticated:true,expiresHours:12});
  }catch(err){logSaudiError("SAUDI_CUSTOMER_OTP",err);
   return res.status(503).json({error:"Verification could not be completed"});}
 });
 app.use("/api/saudi/customer/me",saudiCustomerAuthorized);
 app.get("/api/saudi/customer/me",(_req,res)=>res.json({
  authenticated:true,country:"SA",currency:"SAR",customerId:res.locals.saudiCustomer.id
 }));
 app.post("/api/saudi/customer/logout",saudiCustomerAuthorized,async(_req,res)=>{
  noStore(res);
  try{
   await db.update(saudiCustomerSessions).set({revokedAt:new Date()})
    .where(eq(saudiCustomerSessions.id,res.locals.saudiCustomer.sessionId));
   if(!res.locals.saudiCustomer.bearer)
    res.setHeader("Set-Cookie",NAME+"=; "+cookieFlags+"; Max-Age=0");
   return res.json({loggedOut:true});
  }catch(err){logSaudiError("SAUDI_CUSTOMER_AUTH",err);
   return res.status(503).json({error:"Logout unavailable"});}
 });
}
