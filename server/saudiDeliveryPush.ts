import webpush from "web-push";
import {pool} from "./db";
import {logSaudiError} from "./saudiLog";

export function allowedPushEndpoint(value:unknown):value is string {
  if(typeof value!=="string" || value.length>2048)return false;
  try{
    const url=new URL(value);
    return url.protocol==="https:" && !url.port && !url.username && !url.password && !url.hash &&
      ["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com"].includes(url.hostname);
  }catch{return false;}
}

// A private VAPID key stays with this dedicated installation across deploys.
let storedKeys:Promise<{public_key:string;private_key:string}>|undefined;
export function deliveryPushKeys(){
  if(!storedKeys)storedKeys=(async()=>{
    const query="SELECT public_key,private_key FROM saudi_delivery_push_identity WHERE singleton=true";
    const existing=await pool.query(query);
    if(existing.rowCount)return existing.rows[0];
    const pair=webpush.generateVAPIDKeys();
    await pool.query("INSERT INTO saudi_delivery_push_identity(singleton,public_key,private_key) VALUES(true,$1,$2) ON CONFLICT DO NOTHING",[pair.publicKey,pair.privateKey]);
    return (await pool.query(query)).rows[0];
  })().catch(err=>{storedKeys=undefined;throw err;});
  return storedKeys!;
}

export async function notifyDeliveryPartners(ranking:string,send=webpush.sendNotification){
  const requests=await pool.query(`SELECT eligible.order_id,eligible.recipient,p.push_endpoint
    FROM (${ranking}) eligible JOIN saudi_franchise_team p ON p.member_id=eligible.recipient
    JOIN saudi_delivery_requests d ON d.order_id=eligible.order_id
    WHERE p.push_endpoint IS NOT NULL AND d.notified_partner IS DISTINCT FROM eligible.recipient
    AND (d.push_retry_at IS NULL OR d.push_retry_at<=now())
    ORDER BY d.created_at LIMIT 30`);
  for(const row of requests.rows){
    if(!allowedPushEndpoint(row.push_endpoint))continue;
    const lease=await pool.query(`UPDATE saudi_delivery_requests SET push_retry_at=now()+interval '30 seconds'
      WHERE order_id=$1 AND offered_to=$2 AND offer_until>now() AND partner_id IS NULL AND notified_partner IS DISTINCT FROM $2::uuid
      AND (push_retry_at IS NULL OR push_retry_at<=now())`,[row.order_id,row.recipient]);
    if(!lease.rowCount)continue;
    try{
      const keys=await deliveryPushKeys();
      await send({endpoint:row.push_endpoint, keys:{p256dh:"",auth:""}},null,{
        TTL:30,urgency:"high",timeout:6000,vapidDetails:{
          subject:process.env.APP_PUBLIC_URL||"https://go-saudi-prelaunch.onrender.com",
          publicKey:keys.public_key,privateKey:keys.private_key
        }
      });
      await pool.query("UPDATE saudi_delivery_requests SET notified_partner=$2,push_retry_at=NULL WHERE order_id=$1 AND offered_to=$2",[row.order_id,row.recipient]);
    }catch(err){
      const status=(err as {statusCode?:number}).statusCode;
      if(status===404||status===410)await pool.query("UPDATE saudi_franchise_team SET push_endpoint=NULL WHERE member_id=$1 AND push_endpoint=$2",[row.recipient,row.push_endpoint]);
      else logSaudiError("DELIVERY_PUSH_SEND",err);
    }
  }
}
