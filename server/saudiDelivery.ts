import {allowedPushEndpoint,deliveryPushKeys} from "./saudiDeliveryPush";
import crypto from "node:crypto";
import type {Express} from "express";
import rateLimit from "express-rate-limit";
import {pool} from "./db";
import {sendSaudiPage} from "./saudiCsp";
import {logSaudiError} from "./saudiLog";

const pointValid=(lat:unknown,lon:unknown)=>typeof lat==="number" && Number.isFinite(lat) && Math.abs(lat)<=90 &&
  typeof lon==="number" && Number.isFinite(lon) && Math.abs(lon)<=180;

// Great-circle distance is monotonic in the haversine term, so ranking needs no inverse trig.
const eligiblePartner=`p.city=d.city AND p.role='DELIVERY_PARTNER'
   AND (p.located_at > now()-interval '90 seconds' OR p.parked_until>now())
   AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM saudi_delivery_requests busy WHERE busy.partner_id=p.member_id AND busy.completed_at IS NULL)`;

// Lock the pending orders before choosing a recipient. A concurrent poll, accept
// or decline cannot overwrite a newer offer calculated for the same order.
export async function refreshDeliveryOffers(){
  await pool.query(`WITH pending AS MATERIALIZED (
    SELECT d.* FROM saudi_delivery_requests d JOIN saudi_orders o ON o.id=d.order_id
    WHERE d.partner_id IS NULL AND o.status='PAID' AND
      (d.offered_to IS NULL OR d.offer_until<=now() OR NOT EXISTS (
        SELECT 1 FROM saudi_franchise_team p WHERE p.member_id=d.offered_to AND ${eligiblePartner}))
    ORDER BY d.order_id FOR UPDATE OF d
  ), choices AS (
    SELECT d.order_id,d.skipped,nearest.member_id FROM (
      SELECT pending.*,CASE WHEN offer_until<=now() AND offered_to IS NOT NULL
        THEN array_append(skipped_partners,offered_to) ELSE skipped_partners END AS skipped FROM pending
    ) d LEFT JOIN LATERAL (
      SELECT p.member_id FROM saudi_franchise_team p WHERE ${eligiblePartner}
      AND NOT(p.member_id=ANY(d.skipped))
      ORDER BY power(sin(radians(p.latitude-d.pickup_lat)/2),2)
        +cos(radians(d.pickup_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-d.pickup_lon)/2),2),p.member_id LIMIT 1
    ) nearest ON true
  )
  UPDATE saudi_delivery_requests d SET offered_to=c.member_id,skipped_partners=c.skipped,
    offer_until=CASE WHEN c.member_id IS NOT NULL THEN now()+interval '45 seconds' END,
    notified_partner=NULL,push_retry_at=NULL FROM choices c WHERE d.order_id=c.order_id
    AND (d.offered_to IS DISTINCT FROM c.member_id OR d.skipped_partners<>c.skipped)`);
}
export const rankedDeliveries=`SELECT d.offered_to AS recipient,d.offer_until,d.order_id,d.pickup_lat,d.pickup_lon,e.business_name
 FROM saudi_delivery_requests d JOIN saudi_orders o ON o.id=d.order_id
 JOIN saudi_vendor_accounts v ON v.id=o.vendor_id JOIN seller_enquiries e ON e.id=v.enquiry_id
 WHERE d.partner_id IS NULL AND d.offer_until>now() AND o.status='PAID'`;
const offers=rankedDeliveries+" AND d.offered_to=$1";

export function registerSaudiDelivery(app:Express){
  app.get("/delivery",(_req,res)=>sendSaudiPage(res,"go-saudi-delivery.html"));
  // registerSaudiVendor has already installed its session and same-origin checks.
  app.post("/api/saudi/vendor/delivery-requests",async(req,res)=>{
    const {orderId,latitude,longitude,requestedByCustomer}=req.body||{};
    if(!pointValid(latitude,longitude)||typeof orderId!=="string"||!/^SO_[a-f0-9]{30}$/.test(orderId)||requestedByCustomer!==true)
      return res.status(400).json({error:"A valid order, pickup location and customer delivery request are required"});
    try{
      const saved=await pool.query(`INSERT INTO saudi_delivery_requests(order_id,city,pickup_lat,pickup_lon)
        SELECT o.id,e.city,$3,$4 FROM saudi_orders o JOIN saudi_vendor_accounts v ON v.id=o.vendor_id
        JOIN seller_enquiries e ON e.id=v.enquiry_id WHERE o.id=$1 AND o.vendor_id=$2 AND o.status='PAID'
        ON CONFLICT DO NOTHING RETURNING order_id`,[orderId,res.locals.saudiVendor.id,latitude,longitude]);
      if(!saved.rowCount)return res.status(409).json({error:"Order already requested or unavailable for dispatch"});
      res.status(201).json({queued:true});
    }catch(err){logSaudiError("DELIVERY_REQUEST",err);res.status(503).json({error:"Dispatch unavailable"});}
  });
  const base="/api/saudi/delivery";
  app.use(base,rateLimit({windowMs:60000,max:90,standardHeaders:true,legacyHeaders:false}),async(req,res,next)=>{
    res.setHeader("Cache-Control","private, no-store");
    const match=/^Bearer ([a-f0-9]{64})$/.exec(req.get("Authorization")||"");
    if(!match)return res.status(401).json({error:"Delivery partner key required"});
    try{
      const partner=await pool.query("SELECT member_id FROM saudi_franchise_team WHERE delivery_key_hash=$1 AND role='DELIVERY_PARTNER'",
        [crypto.createHash("sha256").update(match[1]).digest("hex")]);
      if(!partner.rowCount)return res.status(401).json({error:"Invalid delivery partner key"});
      res.locals.partner=partner.rows[0].member_id;
      next();
    }catch(err){logSaudiError("DELIVERY_AUTH",err);res.status(503).json({error:"Partner login unavailable"});}
  });
  app.get(base+"/push-key",async(_req,res)=>{
    res.json({publicKey:(await deliveryPushKeys()).public_key});
  });
  app.post(base+"/push",async(req,res)=>{
    const endpoint=req.body?.endpoint;
    if(!allowedPushEndpoint(endpoint))return res.status(400).json({error:"Unsupported push provider"});
    const linked=await pool.query("UPDATE saudi_franchise_team SET push_endpoint=$2 WHERE member_id=$1",[res.locals.partner,endpoint]).catch(err=>{
      if(err.code==="23505")return null;
      throw err;
    });
    if(!linked)return res.status(409).json({error:"This notification subscription belongs to another partner"});
    return res.json({subscribed:true});
  });
  app.post(base+"/location",async(req,res)=>{
    const {latitude,longitude,offline}=req.body||{};
    if(offline!==true && !pointValid(latitude,longitude))return res.status(400).json({error:"Current GPS position required"});
    if(offline!==true && process.env.NODE_ENV==="production" && process.env.GO_SAUDI_PRIVACY_APPROVED!=="true")
      return res.status(503).json({error:"Location sharing is closed pending privacy approval"});
    await pool.query("UPDATE saudi_franchise_team SET latitude=$2, longitude=$3, located_at=CASE WHEN $2::float8 IS NULL THEN NULL ELSE now() END, parked_until=CASE WHEN $4 THEN now()+interval '30 minutes' ELSE NULL END, push_endpoint=CASE WHEN $2::float8 IS NULL THEN NULL ELSE push_endpoint END WHERE member_id=$1",
      [res.locals.partner,offline===true?null:latitude,offline===true?null:longitude,offline!==true && req.body?.parked===true]);
    res.json({online:offline!==true});
  });
  app.get(base+"/offers",async(_req,res)=>{
    const id=res.locals.partner;
    await refreshDeliveryOffers();
    const available=await pool.query(offers+" ORDER BY d.created_at",[id]);
    const active=await pool.query("SELECT order_id,pickup_lat,pickup_lon FROM saudi_delivery_requests WHERE partner_id=$1 AND completed_at IS NULL",[id]);
    res.json({offers:available.rows,active:active.rows});
  });
  app.post(base+"/decline",async(req,res)=>{
    const result=await pool.query(`UPDATE saudi_delivery_requests SET skipped_partners=array_append(skipped_partners,offered_to),
      offered_to=NULL,offer_until=NULL,notified_partner=NULL,push_retry_at=NULL WHERE order_id=$1 AND offered_to=$2
      AND partner_id IS NULL AND offer_until>now() RETURNING order_id`,[req.body?.orderId,res.locals.partner]);
    if(!result.rowCount)return res.status(409).json({error:"Offer no longer available"});
    await refreshDeliveryOffers();
    res.json({declined:true});
  });
  app.post(base+"/accept",async(req,res)=>{
    try{
      await refreshDeliveryOffers();
      const result=await pool.query(`UPDATE saudi_delivery_requests SET partner_id=$1 WHERE order_id=$2 AND partner_id IS NULL AND offered_to=$1 AND offer_until>clock_timestamp()
        AND order_id IN (SELECT order_id FROM (${offers} AND d.order_id=$2) eligible) RETURNING order_id`,[res.locals.partner,req.body?.orderId]);
      if(!result.rowCount)return res.status(409).json({error:"Offer no longer available"});
      res.json({accepted:true});
    }catch(err){if((err as {code?:string}).code==="23505")return res.status(409).json({error:"Finish your current delivery first"});
      logSaudiError("DELIVERY_ACCEPT",err);res.status(503).json({error:"Could not accept offer"});}
  });
  app.post(base+"/complete",async(req,res)=>{
    const result=await pool.query("UPDATE saudi_delivery_requests SET completed_at=now() WHERE partner_id=$1 AND order_id=$2 AND completed_at IS NULL RETURNING order_id",
      [res.locals.partner,req.body?.orderId]);
    if(!result.rowCount)return res.status(409).json({error:"No matching active delivery"});
    res.json({completed:true});
  });
}
