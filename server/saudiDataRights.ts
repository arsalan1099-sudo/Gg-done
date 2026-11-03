import crypto from "node:crypto";
import type {Express} from "express";
import {and, desc, eq, isNotNull, sql} from "drizzle-orm";
import {db} from "./db";
import {
  sellerEnquiries, saudiVendorAccounts,saudiVendorSessions,
  saudiVendorDraftProducts,saudiVendorDataRequests
} from "@shared/schema";
import {logSaudiError} from "./saudiLog";

// All data-rights routes are registered AFTER their respective authentication
// middleware in registerSaudiAdmin() and registerSaudiVendor(). Never mount them
// outside those authenticated /api/saudi/admin and /api/saudi/vendor prefixes.
const requestIdPattern=/^SDR_[a-f0-9]{30}$/;
const noCache=(res:any)=>{
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("Pragma","no-cache");
};
const newRequestId=()=>"SDR_"+crypto.randomBytes(15).toString("hex");
const merchantContext=(res:any)=>res.locals.saudiVendor as {id:string;enquiryId:string;sessionId:string};

export function registerSaudiDataRights(app:Express):void {
  app.get("/api/saudi/vendor/data-export",async(_req,res)=>{
    noCache(res);
    const v=merchantContext(res);
    try {
      const [profile]=await db.select({
        businessName:sellerEnquiries.businessName,
        city:sellerEnquiries.city,
        category:sellerEnquiries.category,
        phone:sellerEnquiries.phone,
        consent:sellerEnquiries.consent,
        status:sellerEnquiries.status,
        createdAt:sellerEnquiries.createdAt,
        description:saudiVendorAccounts.description,
      }).from(saudiVendorAccounts)
        .innerJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
        .where(eq(saudiVendorAccounts.id,v.id)).limit(1);
      if(!profile)return res.status(404).json({error:"Merchant profile unavailable"});
      const drafts=await db.select({
        subcategoryId:saudiVendorDraftProducts.subcategoryId,
        title:saudiVendorDraftProducts.title,
        description:saudiVendorDraftProducts.description,
        priceHalalas:saudiVendorDraftProducts.priceHalalas,
        stock:saudiVendorDraftProducts.stock,
        status:saudiVendorDraftProducts.status,
        createdAt:saudiVendorDraftProducts.createdAt,
        updatedAt:saudiVendorDraftProducts.updatedAt,
      }).from(saudiVendorDraftProducts)
        .where(eq(saudiVendorDraftProducts.vendorId,v.id))
        .orderBy(desc(saudiVendorDraftProducts.createdAt)).limit(200);
      // Response contains personal data: never include in access logs or caches.
      return res.json({
        format:"go-saudi-merchant-export-v1",generatedAt:new Date().toISOString(),
        profile,draftProducts:drafts,orders:[],payments:[],
        notes:"This export contains draft data only. No purchase/order history is active."
      });
    }catch(err){logSaudiError("SAUDI_EXPORT",err);
      return res.status(503).json({error:"Merchant export unavailable"});}
  });

  app.get("/api/saudi/vendor/data-requests",async(_req,res)=>{
    noCache(res);
    try{
      const rows=await db.select({
        id:saudiVendorDataRequests.id,status:saudiVendorDataRequests.status,
        requestedAt:saudiVendorDataRequests.requestedAt,
        processedAt:saudiVendorDataRequests.processedAt
      }).from(saudiVendorDataRequests)
        .where(eq(saudiVendorDataRequests.vendorId,merchantContext(res).id))
        .orderBy(desc(saudiVendorDataRequests.requestedAt)).limit(10);
      return res.json({requests:rows});
    }catch(err){logSaudiError("SAUDI_DATA_REQUEST",err);
      return res.status(503).json({error:"Request history unavailable"});}
  });

  app.post("/api/saudi/vendor/data-requests",async(req,res)=>{
    noCache(res);
    if(req.body?.requestType!=="DELETE_ACCOUNT"||req.body?.confirm!==true)
      return res.status(400).json({error:"Explicit account deletion confirmation required"});
    try{
      const v=merchantContext(res);
      const [existing]=await db.select({
        id:saudiVendorDataRequests.id,status:saudiVendorDataRequests.status
      }).from(saudiVendorDataRequests)
        .where(and(eq(saudiVendorDataRequests.vendorId,v.id),
          eq(saudiVendorDataRequests.status,"PENDING"))).limit(1);
      if(existing)return res.json({request:existing,alreadyPending:true});
      const [created]=await db.insert(saudiVendorDataRequests).values({
        id:newRequestId(),vendorId:v.id,requestType:"DELETE_ACCOUNT",status:"PENDING"
      }).onConflictDoNothing().returning({
        id:saudiVendorDataRequests.id,status:saudiVendorDataRequests.status
      });
      if(!created) {
        const [again]=await db.select({
          id:saudiVendorDataRequests.id,status:saudiVendorDataRequests.status
        }).from(saudiVendorDataRequests)
          .where(and(eq(saudiVendorDataRequests.vendorId,v.id),
            eq(saudiVendorDataRequests.status,"PENDING"))).limit(1);
        return res.status(200).json({request:again,alreadyPending:true});
      }
      return res.status(201).json({request:created,automaticDeletion:false,
        note:"Deletion requested, not yet executed. Admin must verify identity and applicable retention obligations."});
    }catch(err){logSaudiError("SAUDI_DATA_REQUEST",err);
      return res.status(503).json({error:"Unable to submit deletion request"});}
  });

  app.get("/api/saudi/admin/data-requests",async(req,res)=>{
    noCache(res);
    try{
      const status=req.query.status==="COMPLETED"?"COMPLETED":"PENDING";
      const rows=await db.select({
        id:saudiVendorDataRequests.id,
        status:saudiVendorDataRequests.status,
        requestedAt:saudiVendorDataRequests.requestedAt,
        processedAt:saudiVendorDataRequests.processedAt,
        businessName:sellerEnquiries.businessName,
        phone:sellerEnquiries.phone,
        city:sellerEnquiries.city,
      }).from(saudiVendorDataRequests)
        .leftJoin(saudiVendorAccounts,eq(saudiVendorAccounts.id,saudiVendorDataRequests.vendorId))
        .leftJoin(sellerEnquiries,eq(sellerEnquiries.id,saudiVendorAccounts.enquiryId))
        .where(eq(saudiVendorDataRequests.status,status))
        .orderBy(desc(saudiVendorDataRequests.requestedAt)).limit(100);
      return res.json({requests:rows,erasureEnabled:process.env.GO_SAUDI_ACCOUNT_ERASURE_ENABLED==="true"});
    }catch(err){logSaudiError("SAUDI_DATA_ADMIN",err);
      return res.status(503).json({error:"Cannot retrieve deletion requests"});}
  });

  app.post("/api/saudi/admin/data-requests/:id/complete",async(req,res)=>{
    noCache(res);
    const id=String(req.params.id||"");
    if(!requestIdPattern.test(id))return res.status(400).json({error:"Invalid request"});
    if(process.env.GO_SAUDI_ACCOUNT_ERASURE_ENABLED!=="true")
      return res.status(423).json({error:"Erasure disabled pending approved retention/privacy procedure"});
    if(req.body?.confirmation!==id+":ERASE"||
      req.body?.identityVerified!==true||req.body?.retentionReviewed!==true)
      return res.status(400).json({error:"Confirmed identity, lawful retention review and exact erasure phrase required"});
    try{
      const done=await db.transaction(async tx=>{
        // Lock both request and account, so only the verified active request can
        // trigger account erasure. FK cascade removes drafts, sessions, invites.
        const [dataRequest]=await tx.select({
          id:saudiVendorDataRequests.id,vendorId:saudiVendorDataRequests.vendorId,
          status:saudiVendorDataRequests.status
        }).from(saudiVendorDataRequests).where(eq(saudiVendorDataRequests.id,id)).for("update").limit(1);
        if(!dataRequest||dataRequest.status!=="PENDING"||!dataRequest.vendorId)return false;
        const [account]=await tx.select({
          id:saudiVendorAccounts.id,enquiryId:saudiVendorAccounts.enquiryId
        }).from(saudiVendorAccounts).where(eq(saudiVendorAccounts.id,dataRequest.vendorId)).for("update").limit(1);
        if(!account)return false;
        await tx.update(saudiVendorDataRequests)
          .set({status:"COMPLETED",processedAt:new Date()})
          .where(eq(saudiVendorDataRequests.id,id));
        const [removed]=await tx.delete(sellerEnquiries)
          .where(and(eq(sellerEnquiries.id,account.enquiryId),
                     eq(sellerEnquiries.source,"SAUDI_LANDING")))
          .returning({id:sellerEnquiries.id});
        if(!removed)throw Error("Deletion target missing");
        return true;
      });
      if(!done)return res.status(409).json({error:"Request already handled or account missing"});
      return res.json({completed:true,personalDataDeleted:true,
        note:"Saudi account, lead, associated drafts, sessions, invitations and review history removed; anonymous deletion receipt retained."});
    }catch(err){logSaudiError("SAUDI_DATA_ADMIN",err);
      return res.status(503).json({error:"Deletion could not be completed"});}
  });
}
