import crypto from "node:crypto";
import {pool} from "./db";
import {saudiPaymentsReady} from "./saudiCommerceRules";
import {fee,description,verifiedMembershipPayment,recordMembership} from "./saudiMembership";
import {membershipProvider} from "./saudiPaymentProviders";
import {logSaudiError} from "./saudiLog";

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export async function runMembershipAutomation(){
 if(!saudiPaymentsReady(process.env))return;
 const lock=await pool.connect();
 try{
   if(!(await lock.query("SELECT pg_try_advisory_lock(8206143) AS acquired")).rows[0].acquired)return;
   // A previous worker may have exited after submitting a provider request.
   await pool.query("UPDATE saudi_vendor_invoices SET state='needs_review' WHERE state='creating'");
   const newInvoices=await pool.query(`WITH due AS (
     SELECT e.id,COALESCE(max(r.term),0)+1 AS term FROM seller_enquiries e
     LEFT JOIN saudi_membership_receipts r ON r.enquiry_id=e.id
     WHERE e.source='SAUDI_LANDING' AND e.status='APPROVED' GROUP BY e.id
     HAVING max(r.valid_until) IS NULL OR max(r.valid_until)<=now())
     SELECT due.* FROM due LEFT JOIN saudi_vendor_invoices i ON i.enquiry_id=due.id AND i.term=due.term
     WHERE i.enquiry_id IS NULL ORDER BY due.id LIMIT 10`);
   for(const row of newInvoices.rows){
     const reserved=await pool.query("INSERT INTO saudi_vendor_invoices(enquiry_id,term) VALUES($1,$2) ON CONFLICT DO NOTHING",[row.id,row.term]);
     if(!reserved.rowCount)continue;
     try{
       const ref=description(row.id,row.term);
       const invoice=await membershipProvider("invoices",{amount:fee,currency:"SAR",description:ref,
         success_url:new URL("/vendor",process.env.APP_PUBLIC_URL).href});
       const link=new URL(String(invoice.url));
       if(!uuid.test(String(invoice.id)) || invoice.amount!==fee || invoice.currency!=="SAR" || invoice.description!==ref ||
         link.protocol!=="https:" || !/(^|\.)moyasar\.com$/.test(link.hostname) || link.username || link.password)
         throw Error("Unexpected provider invoice");
       await pool.query("UPDATE saudi_vendor_invoices SET invoice_id=$3,checkout_url=$4,state='open' WHERE enquiry_id=$1 AND term=$2",[row.id,row.term,invoice.id,link.href]);
     }catch(err){
       // The provider might already have created it. Never repeat an ambiguous invoice POST.
       await pool.query("UPDATE saudi_vendor_invoices SET state='needs_review' WHERE enquiry_id=$1 AND term=$2",[row.id,row.term]);
       logSaudiError("SAUDI_AUTO_INVOICE",err);
     }
   }
   const open=await pool.query("SELECT * FROM saudi_vendor_invoices WHERE state='open' ORDER BY checked_at LIMIT 20");
   for(const row of open.rows){
     await pool.query("UPDATE saudi_vendor_invoices SET checked_at=now() WHERE invoice_id=$1",[row.invoice_id]);
     try{
       const i=await membershipProvider("invoices/"+row.invoice_id);
       const payment=verifiedMembershipPayment(i,row.invoice_id,description(row.enquiry_id,row.term));
       if(payment){
         const recorded=await recordMembership(row.enquiry_id,row.term,row.invoice_id,payment);
         await pool.query("UPDATE saudi_vendor_invoices SET state=$2 WHERE invoice_id=$1",[row.invoice_id,recorded.status<300?"paid":"needs_review"]);
       }else if(!["initiated","on_hold"].includes(String(i.status)))
         await pool.query("UPDATE saudi_vendor_invoices SET state='needs_review' WHERE invoice_id=$1",[row.invoice_id]);
     }catch(err){logSaudiError("SAUDI_AUTO_VERIFY",err);}
   }
   if(process.env.GO_SAUDI_EXECUTIVE_PAYOUTS_ENABLED==="true")await processPayouts();
 }finally{try{await lock.query("SELECT pg_advisory_unlock(8206143)");}finally{lock.release();}}
}

// Operator-provisioned, verified beneficiaries. Bank details never enter client responses or logs.
async function processPayouts(){
 const source=process.env.MOYASAR_PAYOUT_SOURCE_ID;
 if(!source||!uuid.test(source))return;
 const beneficiaries=JSON.parse(process.env.GO_SAUDI_VERIFIED_BENEFICIARIES_JSON||"{}");
 const rows=await pool.query(`SELECT * FROM saudi_membership_receipts WHERE commission_halalas>0 AND executive_id IS NOT NULL
   AND (payout_state IS NULL OR payout_state IN ('sending','queued','initiated'))
   ORDER BY payout_checked_at NULLS FIRST,paid_at LIMIT 20`);
 for(const r of rows.rows){
   await pool.query("UPDATE saudi_membership_receipts SET payout_checked_at=now() WHERE payout_id=$1",[r.payout_id]);
   try{
     let paid;
     if(r.payout_state==="queued"||r.payout_state==="initiated"){
       paid=await membershipProvider("payouts/"+r.payout_id);
     }else{
       const b=beneficiaries[r.executive_id];
       if(!b||!/^SA[0-9]{2}[A-Z0-9]{20}$/.test(b.iban)||!b.name||!b.city||!b.mobile)continue;
       const destination={type:"bank",iban:b.iban,name:b.name,city:b.city,mobile:b.mobile,country:"SA"};
       const hash=crypto.createHash("sha256").update(JSON.stringify([source,destination])).digest("hex");
       const invoice=await membershipProvider("invoices/"+r.invoice_id);
       const payment=verifiedMembershipPayment(invoice,r.invoice_id,description(r.enquiry_id,r.term));
       if(!payment||payment.id!==r.payment_id)continue;
       const reserved=await pool.query("UPDATE saudi_membership_receipts SET payout_state='sending',payout_target_hash=$2 WHERE payout_id=$1 AND (payout_target_hash IS NULL OR payout_target_hash=$2)",[r.payout_id,hash]);
       if(!reserved.rowCount)continue;
       paid=await membershipProvider("payouts",{given_id:r.payout_id,source_id:source,amount:r.commission_halalas,purpose:"expenses_services",destination});
     }
     if(paid.id!==r.payout_id || paid.source_id!==source || paid.amount!==r.commission_halalas || paid.currency!=="SAR" ||
       !["queued","initiated","paid","failed","canceled","returned"].includes(String(paid.status)))throw Error("Payout response mismatch");
     await pool.query("UPDATE saudi_membership_receipts SET payout_state=$2 WHERE payout_id=$1",[r.payout_id,paid.status]);
   }catch(err){logSaudiError("SAUDI_AUTO_PAYOUT",err);}
 }
}
