import type {Express} from "express";
import rateLimit from "express-rate-limit";
import {and,eq,inArray} from "drizzle-orm";
import {db} from "./db";
import {saudiCatalogSubmissions,saudiVendorAccounts,sellerEnquiries} from "@shared/schema";
import {saudiCommerceBlockers,saudiOrdersReady,saudiBookingsReady,saudiPaymentsReady,
 validateSaudiCartRequest,calculateSaudiQuote} from "./saudiCommerceRules";
import {logSaudiError} from "./saudiLog";

// Quoting is READ-ONLY: no payment, commitment, reservation, PII or order.
const quoteLimiter=rateLimit({windowMs:60000,limit:30,standardHeaders:true,legacyHeaders:false});
const catalogIsOpen=()=>process.env.GO_SAUDI_CATALOG_PUBLIC==="true"&&
 process.env.GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED==="true"&&
 process.env.GO_SAUDI_PRIVACY_APPROVED==="true";
const noStore=(res:any)=>res.setHeader("Cache-Control","private, no-store");
export function registerSaudiCommerce(app:Express):void{
 app.get("/api/saudi/commerce/readiness",(_req,res)=>{
  noStore(res);
  const gates=saudiCommerceBlockers(process.env);
  return res.json({
   country:"SA",currency:"SAR",mode:"PRELAUNCH",
   liveOrders:saudiOrdersReady(process.env),
   liveBookings:saudiBookingsReady(process.env),
   livePayments:saudiPaymentsReady(process.env),
   catalogEnabled:catalogIsOpen(),
   eligibleForLiveActivation:gates.length===0,
   blockedBy:gates,
   note:"Provider keys and flags alone are not legal or operational verification. Live launch requires actual signoff."
  });
 });
 app.post("/api/saudi/checkout/quote",quoteLimiter,async(req,res)=>{
  noStore(res);
  if(!catalogIsOpen())return res.status(423).json({
   error:"Saudi seller/catalog verification pending; checkout quotes are disabled."
  });
  const parsed=validateSaudiCartRequest(req.body?.items);
  if(!parsed.ok)return res.status(400).json({error:parsed.error});
  try{
   const ids=parsed.lines.map(x=>x.productId);
   const rows=await db.select({
    id:saudiCatalogSubmissions.id,
    vendorId:saudiCatalogSubmissions.vendorId,
    title:saudiCatalogSubmissions.title,
    priceHalalas:saudiCatalogSubmissions.priceHalalas,
    stock:saudiCatalogSubmissions.stock,
    status:saudiCatalogSubmissions.status,
    merchantStatus:sellerEnquiries.status
   }).from(saudiCatalogSubmissions)
    .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiCatalogSubmissions.vendorId))
    .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
    .where(and(inArray(saudiCatalogSubmissions.id,ids),eq(sellerEnquiries.source,"SAUDI_LANDING")));
   const quote=calculateSaudiQuote(parsed.lines,rows);
   if(!quote.ok)return res.status(409).json({error:quote.error});
   return res.json({
    ...quote,orderCreated:false,stockReserved:false,
    checkoutEnabled:saudiOrdersReady(process.env)&&saudiPaymentsReady(process.env),
    fulfillment:"PICKUP",deliveryChargeHalalas:null,
    vatInvoiceReady:process.env.GO_SAUDI_ZATCA_READY==="true",
    note:"Estimate only. Final total/tax and stock are rechecked before taking any real payment."
   });
  }catch(err){logSaudiError("SAUDI_QUOTE",err);
   return res.status(503).json({error:"Saudi checkout quote unavailable"});}
 });
}
