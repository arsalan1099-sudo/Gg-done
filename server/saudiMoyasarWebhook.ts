import crypto from "node:crypto";
import type {Express} from "express";
import rateLimit from "express-rate-limit";
import {db} from "./db";
import {saudiMoyasarWebhookEvents} from "@shared/schema";
import {logSaudiError} from "./saudiLog";

// An authenticated webhook inbox, NOT an automated payment reconciliation worker.
// Only the customer's verified /reconcile flow may currently mark an order PAID.
// No card data, addresses, raw payloads or secret tokens are ever stored.
const allowedEvents=new Set([
  "payment_paid","payment_failed","payment_faild","payment_refunded",
  "payment_voided","payment_authorized","payment_captured","payment_verified"
]);
export type SaudiMoyasarEvent={
  id:string;type:string;live:boolean;paymentId:string;orderId:string|null
};
export function validateSaudiMoyasarEvent(input:unknown,configuredSecret:string|null):
  |{ok:true;event:SaudiMoyasarEvent}
  |{ok:false;reason:string}{
 if(!configuredSecret||configuredSecret.length<32)
   return {ok:false,reason:"Webhook not configured"};
 if(!input||typeof input!=="object"||Array.isArray(input))
   return {ok:false,reason:"Invalid webhook event"};
 const body=input as Record<string,unknown>;
 if(typeof body.secret_token!=="string")return {ok:false,reason:"Webhook authentication required"};
 const got=Buffer.from(body.secret_token,"utf8");
 const expected=Buffer.from(configuredSecret,"utf8");
 if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))
   return {ok:false,reason:"Webhook authentication failed"};
 const data=body.data;
 if(!data||typeof data!=="object"||Array.isArray(data))
   return {ok:false,reason:"Invalid payment event"};
 const payment=data as Record<string,unknown>;
 if(typeof body.id!=="string"||!/^[a-f0-9-]{20,64}$/i.test(body.id)||
    typeof body.type!=="string"||!allowedEvents.has(body.type)||
    typeof payment.id!=="string"||!/^[a-f0-9-]{20,64}$/i.test(payment.id)||
    typeof body.live!=="boolean")return {ok:false,reason:"Invalid webhook fields"};
 // A live event can be accepted into the inbox while checkout is OFF. This
 // helps investigate orphan notifications without trusting the payload as paid.
 if(body.live!==true && !(process.env.NODE_ENV!=="production"&&
     process.env.GO_SAUDI_WEBHOOK_TEST_MODE==="true"))
    return {ok:false,reason:"Non-live payment ignored"};
 const metadata=payment.metadata;
 const candidate=metadata&&typeof metadata==="object"&&!Array.isArray(metadata)
   ?(metadata as Record<string,unknown>).order_id:null;
 const orderId=typeof candidate==="string"&&/^SO_[a-f0-9]{30}$/.test(candidate)?candidate:null;
 return {ok:true,event:{
   id:body.id,type:body.type,live:body.live,paymentId:payment.id,orderId
 }};
}
export function registerSaudiMoyasarWebhook(app:Express):void{
 app.post("/api/saudi/payments/webhook",
  rateLimit({windowMs:60_000,limit:180,standardHeaders:true,legacyHeaders:false}),
  async(req,res)=>{
   res.setHeader("Cache-Control","no-store");
   const secret=process.env.MOYASAR_WEBHOOK_SECRET_TOKEN||null;
   const parsed=validateSaudiMoyasarEvent(req.body,secret);
   if(!parsed.ok)return res.status(parsed.reason.startsWith("Webhook")?403:400)
     .json({error:parsed.reason});
   try{
    const v=parsed.event;
    const [created]=await db.insert(saudiMoyasarWebhookEvents).values({
      id:v.id,eventType:v.type,paymentId:v.paymentId,
      orderId:v.orderId,isLive:v.live,status:"RECEIVED"
    }).onConflictDoNothing().returning({id:saudiMoyasarWebhookEvents.id});
    // The event id is unique; Moyasar retries cannot create duplicate rows.
    return res.status(created?202:200).json({received:true,duplicate:!created,
      processed:false,paymentConfirmed:false});
   }catch(err){
    logSaudiError("SAUDI_WEBHOOK_INBOX",err);
    // Moyasar will retry non-2xx. Never acknowledge events that were not persisted.
    return res.status(503).json({error:"Webhook receipt unavailable"});
   }
  });
}
