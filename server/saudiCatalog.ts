import type {Express,Response} from "express";
import crypto from "node:crypto";
import {and,eq,desc,sql} from "drizzle-orm";
import {db} from "./db";
import {saudiCatalogSubmissions,saudiVendorDraftProducts,saudiVendorAccounts,sellerEnquiries} from "@shared/schema";
import {logSaudiError} from "./saudiLog";
import {saudiMainCategories,saudiSubcategories,isSaudiSubcategory} from "../lib/saudiCategories";

const seller=(res:Response)=>res.locals.saudiVendor as {id:string;enquiryId:string};
const noStore=(res:Response)=>res.setHeader("Cache-Control","no-store");
const idOK=(v:unknown)=>typeof v==="string"&&/^SVC_[a-f0-9]{30}$/.test(v);
const draftOK=(v:unknown)=>typeof v==="string"&&/^SVP_[a-f0-9]{30}$/.test(v);
const catalogOpen=()=>process.env.GO_SAUDI_CATALOG_PUBLIC==="true" &&
 process.env.GO_SAUDI_PRIVACY_APPROVED==="true" &&
 process.env.GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED==="true";

// Guard the actual catalog in addition to restricting database rows to
// approved merchants and individually moderated products.
export function registerSaudiCatalog(app:Express):void {
 app.get("/api/saudi/categories",(_req,res)=>{
  res.setHeader("Cache-Control","public, max-age=3600");
  return res.json({country:"SA",groups:saudiMainCategories,subcategories:saudiSubcategories,
   note:"Browse only; no regulated purchases or bookings enabled."});
 });
 app.get("/api/saudi/catalog",async(req,res)=>{
  noStore(res);
  if(!catalogOpen())return res.json({
   country:"SA",currency:"SAR",available:false,products:[],
   mode:"PRELAUNCH",checkoutEnabled:false
  });
  const city=typeof req.query.city==="string"?req.query.city:"";
  const category=typeof req.query.category==="string"?req.query.category:"";
  const subcategory=typeof req.query.subcategory==="string"?req.query.subcategory:"";
  const allowedCities=new Set(["Riyadh","Jeddah","Makkah","Madinah","Dammam","Khobar","Taif","Tabuk","Abha","Jazan","Other"]);
  const allowedCategories=new Set(["Grocery","Fashion","Food","Electronics","Home","Beauty","Services","Wholesale"]);
  if(city&&!allowedCities.has(city)||category&&!allowedCategories.has(category)||subcategory&&!isSaudiSubcategory(subcategory))
   return res.status(400).json({error:"Unsupported Saudi catalog filter"});
  try{
   const filters=[eq(saudiCatalogSubmissions.status,"APPROVED"),eq(sellerEnquiries.status,"APPROVED"),eq(sellerEnquiries.source,"SAUDI_LANDING")];
   if(city)filters.push(eq(sellerEnquiries.city,city));
   if(category)filters.push(eq(sellerEnquiries.category,category));
   if(subcategory)filters.push(eq(saudiCatalogSubmissions.subcategoryId,subcategory));
   const rows=await db.select({
    id:saudiCatalogSubmissions.id,subcategoryId:saudiCatalogSubmissions.subcategoryId,title:saudiCatalogSubmissions.title,
    description:saudiCatalogSubmissions.description,
    priceHalalas:saudiCatalogSubmissions.priceHalalas,
    stock:saudiCatalogSubmissions.stock,
    businessName:sellerEnquiries.businessName,
    city:sellerEnquiries.city,category:sellerEnquiries.category
   }).from(saudiCatalogSubmissions)
    .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiCatalogSubmissions.vendorId))
    .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
    .where(and(...filters)).orderBy(desc(saudiCatalogSubmissions.reviewedAt)).limit(100);
   // Product listing is not an order, payment, inventory reservation, or offer
   // to take payment. Checkout is a separate legally reviewed implementation.
   return res.json({country:"SA",currency:"SAR",available:true,
    products:rows,checkoutEnabled:false});
  }catch(err){logSaudiError("SAUDI_CATALOG",err);
   return res.status(503).json({error:"Catalog temporarily unavailable"});}
 });

 // Under the vendor-cookie auth installed by registerSaudiVendor() above.
 app.get("/api/saudi/vendor/catalog-submissions",async(_req,res)=>{
  noStore(res);
  try{
   const rows=await db.select({
    id:saudiCatalogSubmissions.id,draftId:saudiCatalogSubmissions.draftId,
    subcategoryId:saudiCatalogSubmissions.subcategoryId,
    title:saudiCatalogSubmissions.title,status:saudiCatalogSubmissions.status,
    reviewNote:saudiCatalogSubmissions.reviewNote,
    requestedAt:saudiCatalogSubmissions.requestedAt
   }).from(saudiCatalogSubmissions)
   .where(eq(saudiCatalogSubmissions.vendorId,seller(res).id))
   .orderBy(desc(saudiCatalogSubmissions.requestedAt)).limit(200);
   return res.json({submissions:rows,publicCatalogEnabled:catalogOpen()});
  }catch(err){logSaudiError("SAUDI_CATALOG",err);
   return res.status(503).json({error:"Could not load submissions"});}
 });
 app.post("/api/saudi/vendor/catalog-submissions",async(req,res)=>{
  noStore(res);
  const draftId=req.body?.draftId;
  if(!draftOK(draftId))return res.status(400).json({error:"Valid draft product id required"});
  try{
   const vendorId=seller(res).id;
   const result=await db.transaction(async tx=>{
    const [draft]=await tx.select({
      id:saudiVendorDraftProducts.id,subcategoryId:saudiVendorDraftProducts.subcategoryId,title:saudiVendorDraftProducts.title,
      description:saudiVendorDraftProducts.description,priceHalalas:saudiVendorDraftProducts.priceHalalas,
      stock:saudiVendorDraftProducts.stock
    }).from(saudiVendorDraftProducts)
     .where(and(eq(saudiVendorDraftProducts.id,draftId),
       eq(saudiVendorDraftProducts.vendorId,vendorId),
       eq(saudiVendorDraftProducts.status,"DRAFT"))).limit(1);
    if(!draft)return null;
    if(!draft.subcategoryId||!isSaudiSubcategory(draft.subcategoryId))return "missing_subcategory";
    const [created]=await tx.insert(saudiCatalogSubmissions).values({
      id:"SVC_"+crypto.randomBytes(15).toString("hex"),
      vendorId,draftId,subcategoryId:draft.subcategoryId,title:draft.title,description:draft.description,
      priceHalalas:draft.priceHalalas,stock:draft.stock,status:"PENDING"
    }).onConflictDoNothing({target:saudiCatalogSubmissions.draftId}).returning({
      id:saudiCatalogSubmissions.id,status:saudiCatalogSubmissions.status
    });
    return created||"already_exists";
   });
   if(!result)return res.status(404).json({error:"Your draft product was not found"});
   if(result==="missing_subcategory")return res.status(400).json({error:"Select a valid product subcategory before submitting for review"});
   if(result==="already_exists")return res.status(409).json({error:"Product already submitted for catalog review"});
   return res.status(201).json({submission:result,public:false,
     note:"Admin review required. Submission does not create a public product."});
  }catch(err){logSaudiError("SAUDI_CATALOG",err);
   return res.status(503).json({error:"Catalog submission unavailable"});}
 });

 // Under the admin bearer auth installed by registerSaudiAdmin() above.
 app.get("/api/saudi/admin/catalog-submissions",async(req,res)=>{
  noStore(res);
  const raw=typeof req.query.status==="string"?req.query.status:"PENDING";
  if(!["PENDING","APPROVED","REJECTED"].includes(raw))
   return res.status(400).json({error:"Unsupported status"});
  try{
   const rows=await db.select({
    id:saudiCatalogSubmissions.id,title:saudiCatalogSubmissions.title,
    status:saudiCatalogSubmissions.status,stock:saudiCatalogSubmissions.stock,
    priceHalalas:saudiCatalogSubmissions.priceHalalas,
    reviewNote:saudiCatalogSubmissions.reviewNote,
    businessName:sellerEnquiries.businessName,city:sellerEnquiries.city,
    requestedAt:saudiCatalogSubmissions.requestedAt,
   }).from(saudiCatalogSubmissions)
    .innerJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiCatalogSubmissions.vendorId))
    .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
    .where(and(eq(saudiCatalogSubmissions.status,raw),eq(sellerEnquiries.source,"SAUDI_LANDING")))
    .orderBy(desc(saudiCatalogSubmissions.requestedAt)).limit(100);
   return res.json({submissions:rows,publicCatalogEnabled:catalogOpen()});
  }catch(err){logSaudiError("SAUDI_CATALOG",err);
   return res.status(503).json({error:"Cannot load moderation queue"});}
 });
 app.patch("/api/saudi/admin/catalog-submissions/:id",async(req,res)=>{
  noStore(res);
  const id=String(req.params.id||"");
  const status=req.body?.status;
  const note=typeof req.body?.note==="string"?req.body.note.trim():"";
  if(!idOK(id)||!["APPROVED","REJECTED"].includes(status)||
    note.length<10||note.length>500)
    return res.status(400).json({error:"Valid review ID, decision and 10–500-character note required"});
  if(status==="APPROVED" && (process.env.GO_SAUDI_PRIVACY_APPROVED!=="true" ||
     process.env.GO_SAUDI_MERCHANT_VERIFICATION_APPROVED!=="true"))
    return res.status(423).json({error:"Merchant and privacy verification required before approval"});
  try{
   const [result]=await db.update(saudiCatalogSubmissions)
    .set({status,reviewNote:note,reviewedAt:new Date()})
    .where(and(eq(saudiCatalogSubmissions.id,id),eq(saudiCatalogSubmissions.status,"PENDING")))
    .returning({id:saudiCatalogSubmissions.id,status:saudiCatalogSubmissions.status});
   if(!result)return res.status(409).json({error:"Submission not pending or not found"});
   return res.json({submission:result,public:catalogOpen(),
    note:"Review is not a payment or checkout authorization."});
  }catch(err){logSaudiError("SAUDI_CATALOG",err);
   return res.status(503).json({error:"Moderation unavailable"});}
 });
}
