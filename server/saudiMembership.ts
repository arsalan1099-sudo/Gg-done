import type {Express} from "express";
import {pool} from "./db";
import {fetchSaudiInvoice} from "./saudiPaymentProviders";
import {ANNUAL_VENDOR_FEE_SAR,referralHalalas} from "./saudiRules";
import {saudiPaymentsReady} from "./saudiCommerceRules";
import {logSaudiError} from "./saudiLog";

export const fee=ANNUAL_VENDOR_FEE_SAR*100;
export const description=(id:string,term:number)=>`Go Saudi annual vendor membership / ${id} / ${term}`;
const leadPattern=/^SL_[a-f0-9]{30}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function verifiedMembershipPayment(raw:unknown,invoiceId:string,reference:string){
 const invoice=raw as Record<string,unknown>|null;
 if(!invoice || invoice.id!==invoiceId || invoice.description!==reference || invoice.status!=="paid" ||
    invoice.currency!=="SAR" || invoice.amount!==fee || !Array.isArray(invoice.payments))return null;
 const payments=invoice.payments.filter(p=>p && (p.status==="paid" || p.status==="captured"));
 if(payments.length!==1)return null;
 const p=payments[0];
 if(typeof p.id!=="string" || !uuid.test(p.id) || p.amount!==fee || p.currency!=="SAR" || p.refunded!==0 ||
    (p.status==="captured" && p.captured!==fee))return null;
 const paidAt=new Date(p.captured_at||p.updated_at);
 if(!Number.isFinite(paidAt.getTime()) || paidAt.getTime()>Date.now()+60_000)return null;
 return {id:p.id,paidAt};
}

export async function recordMembership(id:string,term:number,invoiceId:string,payment:{id:string;paidAt:Date}){
     const client=await pool.connect();
     try{
       await client.query("BEGIN");
       const lead=await client.query("SELECT executive_id FROM seller_enquiries WHERE id=$1 AND status='APPROVED' AND source='SAUDI_LANDING' FOR UPDATE",[id]);
       if(!lead.rowCount){await client.query("ROLLBACK");return {status:404,body:{error:"Approved Saudi application required"}};}
       const result=await client.query(`INSERT INTO saudi_membership_receipts
         (enquiry_id,term,invoice_id,payment_id,amount_halalas,paid_at,valid_until,executive_id,commission_halalas)
         SELECT $1::varchar,$2::integer,$3::uuid,$4::uuid,$5::integer,$6::timestamptz,GREATEST($6::timestamptz,max(valid_until))+interval '1 year',$7,$8
         FROM saudi_membership_receipts WHERE enquiry_id=$1 HAVING COALESCE(max(term),0)+1=$2
         ON CONFLICT DO NOTHING RETURNING term`,[id,term,invoiceId,payment.id,fee,payment.paidAt,
         term===1?lead.rows[0].executive_id:null,term===1&&lead.rows[0].executive_id?referralHalalas(fee):0]);
       const receipt=await client.query("SELECT term,valid_until,commission_halalas FROM saudi_membership_receipts WHERE enquiry_id=$1 AND term=$2 AND invoice_id=$3 AND payment_id=$4",[id,term,invoiceId,payment.id]);
       await client.query("COMMIT");
       if(!receipt.rowCount)return {status:409,body:{error:"Duplicate payment or unexpected membership term"}};
       return {status:result.rowCount?201:200,body:receipt.rows[0]};
     }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
}

export function registerSaudiMembership(app:Express){
 const path="/api/saudi/admin/seller-enquiries/:id/membership";
 app.get(path,async(req,res)=>{
   const id=req.params.id;
   if(!leadPattern.test(id))return res.status(400).json({error:"Invalid application"});
   const lead=await pool.query("SELECT 1 FROM seller_enquiries WHERE id=$1 AND status='APPROVED' AND source='SAUDI_LANDING'",[id]);
   if(!lead.rowCount)return res.status(404).json({error:"Approved Saudi application required"});
   const history=await pool.query("SELECT term,valid_until,commission_halalas,payout_state FROM saudi_membership_receipts WHERE enquiry_id=$1 ORDER BY term DESC LIMIT 1",[id]);
   const latest=history.rows[0],term=(latest?.term||0)+1;
   const invoice=await pool.query("SELECT state FROM saudi_vendor_invoices WHERE enquiry_id=$1 AND term=$2",[id,term]);
   return res.json({term,reference:description(id,term),invoiceState:invoice.rows[0]?.state||null,latest:latest||null});
 });
 app.post(path,async(req,res)=>{
   const id=req.params.id,{invoiceId,term}=req.body||{};
   if(!leadPattern.test(id)||typeof invoiceId!=="string"||!uuid.test(invoiceId)||!Number.isSafeInteger(term)||term<1)
     return res.status(400).json({error:"Valid invoice, application and membership term required"});
   if(!saudiPaymentsReady(process.env))return res.status(423).json({error:"Live payment verification is closed"});
   try{
     const payment=verifiedMembershipPayment(await fetchSaudiInvoice(invoiceId),invoiceId,description(id,term));
     if(!payment)return res.status(409).json({error:"Invoice, captured amount or seller reference does not match"});
     const result=await recordMembership(id,term,invoiceId,payment);
     return res.status(result.status).json(result.body);
   }catch(err){logSaudiError("SAUDI_MEMBERSHIP",err);return res.status(503).json({error:"Membership verification unavailable"});}
 });
}
