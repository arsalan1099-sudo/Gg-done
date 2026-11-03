import crypto from "node:crypto";
import type {Express} from "express";
import rateLimit from "express-rate-limit";
import {and,desc,eq,gt,gte,inArray,sql} from "drizzle-orm";
import {db} from "./db";
import {saudiCustomerAuthorized} from "./saudiCustomerAuth";
import {saudiOrdersReady,saudiPaymentsReady,validateSaudiCartRequest,calculateSaudiQuote} from "./saudiCommerceRules";
import {createSaudiPaymentIntent,fetchAndVerifySaudiPayment} from "./saudiPaymentProviders";
import {saudiOrders,saudiOrderLines,saudiCatalogSubmissions,saudiVendorAccounts,sellerEnquiries} from "@shared/schema";
import {logSaudiError} from "./saudiLog";

const orderIdRegex=/^SO_[a-f0-9]{30}$/;
const newId=(prefix:string)=>prefix+crypto.randomBytes(15).toString("hex");
const limiter=rateLimit({windowMs:60*60*1000,limit:25,standardHeaders:true,legacyHeaders:false});
const noStore=(res:any)=>res.setHeader("Cache-Control","private, no-store");
const enabled=()=>saudiOrdersReady(process.env)&&saudiPaymentsReady(process.env);
const owner=(res:any)=>res.locals.saudiCustomer.id as string;
const resultFields={
 id:saudiOrders.id,status:saudiOrders.status,
 currency:saudiOrders.currency,subtotalHalalas:saudiOrders.subtotalHalalas,
 fulfillment:saudiOrders.fulfillment,expiresAt:saudiOrders.expiresAt,
 createdAt:saudiOrders.createdAt,paidAt:saudiOrders.paidAt
};

// Only PICKUP orders from ONE merchant. No unverified prices, shipping, COD,
// partial payments, Indian UPI, seller split payouts or tax calculation.
export function registerSaudiOrders(app:Express):void{
 app.post("/api/saudi/orders",limiter,saudiCustomerAuthorized,async(req,res)=>{
  noStore(res);
  if(!enabled())return res.status(423).json({error:"Live Saudi checkout is blocked pending verified merchant/PSP/tax/operations readiness"});
  const parsed=validateSaudiCartRequest(req.body?.items);
  if(!parsed.ok)return res.status(400).json({error:parsed.error});
  if(req.body?.fulfillment!=="PICKUP"||
    typeof req.body?.idempotencyKey!=="string"||
    !/^[A-Za-z0-9_-]{16,80}$/.test(req.body.idempotencyKey))
   return res.status(400).json({error:"Pickup checkout and a strong idempotency key required"});
  try{
   const customerId=owner(res);
   const created=await db.transaction(async tx=>{
    const [existing]=await tx.select(resultFields).from(saudiOrders)
      .where(and(eq(saudiOrders.customerId,customerId),
        eq(saudiOrders.idempotencyKey,req.body.idempotencyKey))).limit(1);
    if(existing)return {order:existing,existing:true};
    const ids=parsed.lines.map(x=>x.productId);
    const rows=await tx.select({
      id:saudiCatalogSubmissions.id,vendorId:saudiCatalogSubmissions.vendorId,
      title:saudiCatalogSubmissions.title,priceHalalas:saudiCatalogSubmissions.priceHalalas,
      stock:saudiCatalogSubmissions.stock,status:saudiCatalogSubmissions.status,
      merchantStatus:sellerEnquiries.status
    }).from(saudiCatalogSubmissions)
      .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiCatalogSubmissions.vendorId))
      .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
      .where(and(inArray(saudiCatalogSubmissions.id,ids),eq(sellerEnquiries.source,"SAUDI_LANDING")));
    const quote=calculateSaudiQuote(parsed.lines,rows);
    if(!quote.ok)return {error:quote.error};
    const [order]=await tx.insert(saudiOrders).values({
      id:newId("SO_"),customerId,vendorId:quote.vendorId,
      idempotencyKey:req.body.idempotencyKey,currency:"SAR",
      subtotalHalalas:quote.subtotalHalalas,fulfillment:"PICKUP",
      status:"PENDING_PAYMENT",expiresAt:new Date(Date.now()+20*60*1000)
    }).onConflictDoNothing().returning(resultFields);
    if(!order){
      // A concurrent identical request won the uniqueness race.
      const [winner]=await tx.select(resultFields).from(saudiOrders)
       .where(and(eq(saudiOrders.customerId,customerId),
         eq(saudiOrders.idempotencyKey,req.body.idempotencyKey))).limit(1);
      return winner?{order:winner,existing:true}:{error:"Order conflict"};
    }
    await tx.insert(saudiOrderLines).values(quote.items.map(item=>({
      id:newId("SOL_"),orderId:order.id,
      productId:item.productId,title:item.title,quantity:item.quantity,
      unitHalalas:item.unitHalalas,lineHalalas:item.lineHalalas
    })));
    return {order,existing:false};
   });
   if("error" in created)return res.status(409).json({error:created.error});
   return res.status(created.existing?200:201).json({
    order:created.order,reused:created.existing,stockReserved:false,
    next:"Request hosted payment intent only after confirming the final amount."
   });
  }catch(err){logSaudiError("SAUDI_ORDER_CREATE",err);
   return res.status(503).json({error:"Cannot create Saudi order"});}
 });

 app.post("/api/saudi/orders/:id/payment-intent",limiter,saudiCustomerAuthorized,async(req,res)=>{
  noStore(res);
  const id=String(req.params.id||"");
  if(!orderIdRegex.test(id))return res.status(400).json({error:"Invalid Saudi order"});
  if(!enabled())return res.status(423).json({error:"Live Saudi payment processing disabled"});
  try{
   // Compare-and-set permits only ONE payment intent creation per order.
   const [claimed]=await db.update(saudiOrders).set({status:"CREATING_INTENT"})
    .where(and(eq(saudiOrders.id,id),eq(saudiOrders.customerId,owner(res)),
      eq(saudiOrders.status,"PENDING_PAYMENT"),gt(saudiOrders.expiresAt,new Date())))
    .returning({id:saudiOrders.id,subtotalHalalas:saudiOrders.subtotalHalalas});
   if(!claimed)return res.status(409).json({error:"Order already has a payment intent or is expired"});
   try{
    const origin=new URL(process.env.APP_PUBLIC_URL||"");
    if(origin.protocol!=="https:")throw Error("Invalid payment callback");
    const intent=await createSaudiPaymentIntent(id,claimed.subtotalHalalas,
      new URL("/payment-result",origin).toString());
    const [saved]=await db.update(saudiOrders)
     .set({status:"READY_FOR_PAYMENT",paymentIntentId:intent.id})
     .where(and(eq(saudiOrders.id,id),
       eq(saudiOrders.customerId,owner(res)),eq(saudiOrders.status,"CREATING_INTENT")))
     .returning({id:saudiOrders.id});
    if(!saved)throw Error("Unable to bind payment intent to order");
    return res.json({
      orderId:id,paymentIntentId:intent.id,clientSecret:intent.clientSecret,
      publishableKey:process.env.MOYASAR_PUBLISHABLE_KEY,
      amountHalalas:intent.amount,currency:"SAR",
      note:"Use the hosted Moyasar card form; never send PAN/CVV to Go Saudi."
    });
   }catch(err){
    // A provider timeout can leave an orphan intent; do not mark anything paid.
    await db.update(saudiOrders).set({status:"PENDING_PAYMENT"})
     .where(and(eq(saudiOrders.id,id),eq(saudiOrders.customerId,owner(res)),
       eq(saudiOrders.status,"CREATING_INTENT")));
    logSaudiError("SAUDI_PAYMENT_INTENT",err);
    return res.status(503).json({error:"Payment provider unavailable. No order was paid."});
   }
  }catch(err){logSaudiError("SAUDI_PAYMENT_INTENT",err);
   return res.status(503).json({error:"Unable to begin payment"});}
 });

 app.post("/api/saudi/orders/:id/reconcile",limiter,saudiCustomerAuthorized,async(req,res)=>{
  noStore(res);
  const id=String(req.params.id||"");
  if(!orderIdRegex.test(id)||typeof req.body?.paymentId!=="string"||
    !/^[a-f0-9-]{20,64}$/i.test(req.body.paymentId))
    return res.status(400).json({error:"Valid order and payment reference required"});
  if(!enabled())return res.status(423).json({error:"Payment verification disabled"});
  try{
   const [before]=await db.select({
    id:saudiOrders.id,status:saudiOrders.status,
    subtotalHalalas:saudiOrders.subtotalHalalas,
    paymentIntentId:saudiOrders.paymentIntentId
   }).from(saudiOrders).where(and(eq(saudiOrders.id,id),
      eq(saudiOrders.customerId,owner(res)))).limit(1);
   if(!before)return res.status(404).json({error:"Order not found"});
   if(before.status==="PAID")return res.json({status:"PAID",verified:true});
   if(before.status!=="READY_FOR_PAYMENT"||!before.paymentIntentId)
     return res.status(409).json({error:"Order not ready for payment verification"});
   const paid=await fetchAndVerifySaudiPayment(req.body.paymentId,{
    orderId:id,amount:before.subtotalHalalas
   });
   if(!paid)return res.status(202).json({status:"PENDING_VERIFICATION",verified:false});
   const result=await db.transaction(async tx=>{
    const [order]=await tx.select({
      id:saudiOrders.id,status:saudiOrders.status,vendorId:saudiOrders.vendorId,
      expiresAt:saudiOrders.expiresAt
    }).from(saudiOrders)
     .where(and(eq(saudiOrders.id,id),eq(saudiOrders.customerId,owner(res))))
     .for("update").limit(1);
    if(!order||order.status!=="READY_FOR_PAYMENT")return "CONFLICT";
    if(order.expiresAt<=new Date())return "REFUND_PENDING";
    const [merchant]=await tx.select({status:sellerEnquiries.status})
     .from(saudiVendorAccounts)
     .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
     .where(and(eq(saudiVendorAccounts.id,order.vendorId),
      eq(sellerEnquiries.source,"SAUDI_LANDING"))).limit(1);
    if(!merchant||merchant.status!=="APPROVED")return "REFUND_PENDING";
    const lines=await tx.select({
      productId:saudiOrderLines.productId,quantity:saudiOrderLines.quantity
    }).from(saudiOrderLines).where(eq(saudiOrderLines.orderId,id));
    if(!lines.length)return "REFUND_PENDING";
    // Lock-and-decrement rows in a stable order to reduce deadlocks.
    // Rolling back this transaction also rolls back all decrements.
    for(const line of lines.sort((a,b)=>a.productId.localeCompare(b.productId))){
      const [stock]=await tx.update(saudiCatalogSubmissions)
       .set({stock:sql`${saudiCatalogSubmissions.stock} - ${line.quantity}`})
       .where(and(eq(saudiCatalogSubmissions.id,line.productId),
        eq(saudiCatalogSubmissions.vendorId,order.vendorId),
        eq(saudiCatalogSubmissions.status,"APPROVED"),
        gte(saudiCatalogSubmissions.stock,line.quantity)))
       .returning({id:saudiCatalogSubmissions.id});
      if(!stock)throw Error("STOCK_CONFLICT");
    }
    const [updated]=await tx.update(saudiOrders).set({
      status:"PAID",paymentId:req.body.paymentId,paidAt:new Date()
    }).where(and(eq(saudiOrders.id,id),eq(saudiOrders.status,"READY_FOR_PAYMENT")))
     .returning({id:saudiOrders.id});
    if(!updated)throw Error("ORDER_CONFLICT");
    return "PAID";
   }).catch(async err=>{
     if(err instanceof Error&&(err.message==="STOCK_CONFLICT"||err.message==="ORDER_CONFLICT"))
       return "REFUND_PENDING";
     throw err;
   });
   if(result==="REFUND_PENDING"){
    await db.update(saudiOrders).set({
      status:"REFUND_PENDING",paymentId:req.body.paymentId
    }).where(and(eq(saudiOrders.id,id),eq(saudiOrders.customerId,owner(res)),
     eq(saudiOrders.status,"READY_FOR_PAYMENT")));
    return res.status(409).json({status:"REFUND_PENDING",
      error:"Payment requires manual refund/reconciliation; fulfillment is blocked"});
   }
   if(result==="CONFLICT")return res.status(409).json({error:"Order already reconciled"});
   return res.json({status:"PAID",verified:true,
     note:"Payment verified directly with Saudi payment provider. No delivery was scheduled."});
  }catch(err){logSaudiError("SAUDI_PAYMENT_VERIFY",err);
   return res.status(503).json({error:"Payment reconciliation unavailable"});}
 });

 app.get("/api/saudi/orders",saudiCustomerAuthorized,async(_req,res)=>{
  noStore(res);
  try{
   const rows=await db.select(resultFields).from(saudiOrders)
    .where(eq(saudiOrders.customerId,owner(res)))
    .orderBy(desc(saudiOrders.createdAt)).limit(50);
   return res.json({orders:rows});
  }catch(err){logSaudiError("SAUDI_ORDER_READ",err);
   return res.status(503).json({error:"Order history unavailable"});}
 });
 app.get("/api/saudi/vendor/orders",async(_req,res)=>{
  noStore(res);
  try{
   const rows=await db.select(resultFields).from(saudiOrders)
    .where(eq(saudiOrders.vendorId,res.locals.saudiVendor.id))
    .orderBy(desc(saudiOrders.createdAt)).limit(50);
   return res.json({orders:rows,
    note:"Fulfilment and refund operations require operational controls."});
  }catch(err){logSaudiError("SAUDI_ORDER_READ",err);
   return res.status(503).json({error:"Vendor order queue unavailable"});}
 });
}
