import crypto from "node:crypto";
import type {Express} from "express";
import rateLimit from "express-rate-limit";
import {and,desc,eq} from "drizzle-orm";
import {db} from "./db";
import {saudiBookingsReady} from "./saudiCommerceRules";
import {saudiCustomerAuthorized} from "./saudiCustomerAuth";
import {saudiBookingRequests,saudiCatalogSubmissions,saudiVendorAccounts,sellerEnquiries} from "@shared/schema";
import {logSaudiError} from "./saudiLog";

// Only low-risk local services with manual vendor verification; travel, Hajj/
// Umrah, employment, regulated medical, insurance and legal services excluded.
const permittedServiceSubcategories=new Set([
 "sc69","sc70","sc71","sc72","sc73","sc74","sc75","sc76",
 "sc78","sc83","sc84","sc85","sc86","sc87"
]);
const limit=rateLimit({windowMs:60*60*1000,limit:8,standardHeaders:true,legacyHeaders:false});
const bookingId=(s:unknown)=>typeof s==="string"&&/^SB_[a-f0-9]{30}$/.test(s);
const productId=(s:unknown)=>typeof s==="string"&&/^SVC_[a-f0-9]{30}$/.test(s);
export function validateSaudiBookingRequest(body:unknown,now=Date.now()):
 |{ok:true;productId:string;slot:Date;note:string}
 |{ok:false;error:string}{
 if(!body||typeof body!=="object"||Array.isArray(body))return {ok:false,error:"Invalid booking request"};
 const v=body as Record<string,unknown>;
 if(!productId(v.productId))return {ok:false,error:"Valid service catalog ID required"};
 if(typeof v.requestedSlot!=="string"||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v.requestedSlot))
   return {ok:false,error:"UTC requested slot required"};
 const parsed=Date.parse(v.requestedSlot);
 if(!Number.isFinite(parsed)||parsed<now+60*60*1000||parsed>now+90*86400000)
   return {ok:false,error:"Choose a future slot within 90 days"};
 const note=typeof v.note==="string"?v.note.trim():"";
 if(note.length>500)return {ok:false,error:"Note too long"};
 return {ok:true,productId:v.productId,slot:new Date(parsed),note};
}
export function registerSaudiBookings(app:Express):void{
 app.post("/api/saudi/bookings",limit,saudiCustomerAuthorized,async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(!saudiBookingsReady(process.env)||
     process.env.GO_SAUDI_SERVICE_BOOKINGS_LICENSED!=="true")
    return res.status(423).json({error:"Saudi merchant bookings are not yet legally or operationally enabled"});
  const parsed=validateSaudiBookingRequest(req.body);
  if(!parsed.ok)return res.status(400).json({error:parsed.error});
  try{
   const [item]=await db.select({
    id:saudiCatalogSubmissions.id,vendorId:saudiCatalogSubmissions.vendorId,
    subcategoryId:saudiCatalogSubmissions.subcategoryId,
    merchantStatus:sellerEnquiries.status
   }).from(saudiCatalogSubmissions)
    .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiCatalogSubmissions.vendorId))
    .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
    .where(and(eq(saudiCatalogSubmissions.id,parsed.productId),
      eq(saudiCatalogSubmissions.status,"APPROVED"),
      eq(sellerEnquiries.source,"SAUDI_LANDING"),eq(sellerEnquiries.status,"APPROVED")))
    .limit(1);
   if(!item||!item.subcategoryId||!permittedServiceSubcategories.has(item.subcategoryId))
    return res.status(409).json({error:"Service unavailable or not eligible for booking"});
   const customerId=res.locals.saudiCustomer.id as string;
   const [booking]=await db.insert(saudiBookingRequests).values({
    id:"SB_"+crypto.randomBytes(15).toString("hex"),
    customerId,vendorId:item.vendorId,productId:item.id,
    requestedSlot:parsed.slot,note:parsed.note,status:"REQUESTED"
   }).returning({id:saudiBookingRequests.id,status:saudiBookingRequests.status,
     requestedSlot:saudiBookingRequests.requestedSlot});
   return res.status(201).json({booking,confirmed:false,paymentTaken:false,
    note:"Request only. Merchant must accept manually after checking actual availability."});
  }catch(err){logSaudiError("SAUDI_BOOKING",err);
   return res.status(503).json({error:"Booking request could not be saved"});}
 });
 app.get("/api/saudi/bookings",saudiCustomerAuthorized,async(_req,res)=>{
  res.setHeader("Cache-Control","private, no-store");
  try{
   const list=await db.select({
    id:saudiBookingRequests.id,productId:saudiBookingRequests.productId,
    status:saudiBookingRequests.status,requestedSlot:saudiBookingRequests.requestedSlot,
    createdAt:saudiBookingRequests.createdAt
   }).from(saudiBookingRequests)
    .where(eq(saudiBookingRequests.customerId,res.locals.saudiCustomer.id))
    .orderBy(desc(saudiBookingRequests.createdAt)).limit(50);
   return res.json({requests:list});
  }catch(err){logSaudiError("SAUDI_BOOKING",err);return res.status(503).json({error:"Bookings unavailable"});}
 });
 // The vendor prefix is already protected by registerSaudiVendor's cookie
 // middleware. This cannot be called by a different vendor's account.
 app.get("/api/saudi/vendor/bookings",async(_req,res)=>{
  res.setHeader("Cache-Control","private, no-store");
  try{
   const list=await db.select({
    id:saudiBookingRequests.id,productId:saudiBookingRequests.productId,
    requestedSlot:saudiBookingRequests.requestedSlot,status:saudiBookingRequests.status,
    note:saudiBookingRequests.note,createdAt:saudiBookingRequests.createdAt
   }).from(saudiBookingRequests)
    .where(eq(saudiBookingRequests.vendorId,res.locals.saudiVendor.id))
    .orderBy(desc(saudiBookingRequests.createdAt)).limit(50);
   return res.json({requests:list,manualConfirmationRequired:true});
  }catch(err){logSaudiError("SAUDI_BOOKING",err);return res.status(503).json({error:"Vendor bookings unavailable"});}
 });
 app.patch("/api/saudi/vendor/bookings/:id",async(req,res)=>{
  res.setHeader("Cache-Control","private, no-store");
  if(!bookingId(req.params.id)||!["ACCEPTED","DECLINED"].includes(req.body?.status))
   return res.status(400).json({error:"Valid booking and decision required"});
  try{
   const [row]=await db.update(saudiBookingRequests)
    .set({status:req.body.status,reviewedAt:new Date()})
    .where(and(eq(saudiBookingRequests.id,String(req.params.id)),
     eq(saudiBookingRequests.vendorId,res.locals.saudiVendor.id),
     eq(saudiBookingRequests.status,"REQUESTED")))
    .returning({id:saudiBookingRequests.id,status:saudiBookingRequests.status});
   if(!row)return res.status(409).json({error:"Booking missing or already handled"});
   return res.json({booking:row,paymentTaken:false});
  }catch(err){logSaudiError("SAUDI_BOOKING",err);return res.status(503).json({error:"Booking decision unavailable"});}
 });
}
