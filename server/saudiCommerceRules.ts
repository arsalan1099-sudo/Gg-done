/** Saudi commerce is closed unless every independently verified release gate is set.
 * Presence of secrets alone NEVER authorizes taking real payments. */
export type SaudiCommerceFlags=Record<string,string|undefined>;
export const SAUDI_COMMERCE_GATES=[
 "GO_SAUDI_MODE","GO_SAUDI_PRIVACY_APPROVED","GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED",
 "GO_SAUDI_CATALOG_PUBLIC","GO_SAUDI_MERCHANT_VERIFICATION_APPROVED",
 "GO_SAUDI_ESTORE_VERIFIED","GO_SAUDI_CUSTOMER_OTP_ENABLED",
 "GO_SAUDI_FULFILLMENT_READY","GO_SAUDI_ZATCA_READY",
 "GO_SAUDI_REFUNDS_READY","GO_SAUDI_SETTLEMENT_RECONCILIATION_READY",
 "GO_SAUDI_LIVE_CHARGES_APPROVED"
] as const;
export type CommerceGate=(typeof SAUDI_COMMERCE_GATES)[number];
export function saudiCommerceBlockers(env:SaudiCommerceFlags):string[]{
 const pending:string[]=[];
 for(const key of SAUDI_COMMERCE_GATES) if(env[key]!=="true")pending.push(key);
 if(!env.APP_PUBLIC_URL||!/^https:\/\/[^\s/?#]+\/?$/.test(env.APP_PUBLIC_URL))
  pending.push("APP_PUBLIC_URL");
 if(!env.DATABASE_URL)pending.push("DATABASE_URL");
 if(!/^sk_live_[A-Za-z0-9_-]{12,}$/.test(env.MOYASAR_SECRET_KEY||""))
  pending.push("MOYASAR_SECRET_KEY");
 if(!/^pk_live_[A-Za-z0-9_-]{12,}$/.test(env.MOYASAR_PUBLISHABLE_KEY||""))
  pending.push("MOYASAR_PUBLISHABLE_KEY");
 if(!/^VA[a-f0-9]{32}$/i.test(env.TWILIO_VERIFY_SERVICE_SID||"")||
    !/^SK[a-f0-9]{32}$/i.test(env.TWILIO_API_KEY||"")||
    !env.TWILIO_API_SECRET||!/^AC[a-f0-9]{32}$/i.test(env.TWILIO_ACCOUNT_SID||""))
  pending.push("TWILIO_VERIFY");
 if(!env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY||
   !/^[0-9a-f]{64}$/i.test(env.GO_SAUDI_CUSTOMER_ENCRYPTION_KEY))
  pending.push("GO_SAUDI_CUSTOMER_ENCRYPTION_KEY");
 return pending;
}
export function saudiOrdersReady(env:SaudiCommerceFlags):boolean{
 return saudiCommerceBlockers(env).length===0&&env.GO_SAUDI_ORDERS_ENABLED==="true";
}
export function saudiBookingsReady(env:SaudiCommerceFlags):boolean{
 return saudiCommerceBlockers(env).length===0&&env.GO_SAUDI_BOOKINGS_ENABLED==="true";
}
export function saudiPaymentsReady(env:SaudiCommerceFlags):boolean{
 return saudiCommerceBlockers(env).length===0&&env.GO_SAUDI_PAYMENTS_ENABLED==="true";
}
export type SaudiCartRequestLine={productId:string;quantity:number};
export function validateSaudiCartRequest(raw:unknown):
 |{ok:true;lines:SaudiCartRequestLine[]}
 |{ok:false;error:string}{
 if(!Array.isArray(raw)||raw.length<1||raw.length>20)
  return {ok:false,error:"Cart must contain 1–20 items"};
 const seen=new Set<string>();
 const lines:SaudiCartRequestLine[]=[];
 for(const item of raw){
  if(!item||typeof item!=="object"||Array.isArray(item))
   return {ok:false,error:"Invalid item"};
  const v=item as Record<string,unknown>;
  if(typeof v.productId!=="string"||!/^SVC_[a-f0-9]{30}$/.test(v.productId))
   return {ok:false,error:"Invalid Saudi catalog item ID"};
  if(!Number.isSafeInteger(v.quantity)||Number(v.quantity)<1||Number(v.quantity)>20)
   return {ok:false,error:"Invalid quantity"};
  if(seen.has(v.productId))return {ok:false,error:"Duplicate catalog item"};
  seen.add(v.productId);lines.push({productId:v.productId,quantity:Number(v.quantity)});
 }
 return {ok:true,lines};
}
export type SaudiQuoteProduct={
 id:string;vendorId:string;title:string;stock:number;priceHalalas:number;
 status:string;merchantStatus:string;
};
export function calculateSaudiQuote(
 lines:SaudiCartRequestLine[],products:SaudiQuoteProduct[]
):{ok:true;items:{productId:string;quantity:number;unitHalalas:number;lineHalalas:number;title:string}[];
 subtotalHalalas:number;currency:"SAR";vendorId:string}
 |{ok:false;error:string}{
 if(!lines.length||lines.length!==products.length)return {ok:false,error:"Missing catalog products"};
 const vendor=products[0]?.vendorId;
 let total=0;
 const items=[];
 for(const line of lines){
  const p=products.find(x=>x.id===line.productId);
  if(!p||p.vendorId!==vendor||p.status!=="APPROVED"||
     p.merchantStatus!=="APPROVED"||
     !Number.isSafeInteger(p.priceHalalas)||p.priceHalalas<1||
     !Number.isSafeInteger(p.stock)||p.stock<line.quantity)
    return {ok:false,error:"Item unavailable, insufficient stock or multiple merchants"};
  const amount=p.priceHalalas*line.quantity;
  if(!Number.isSafeInteger(amount))return {ok:false,error:"Invalid amount"};
  total+=amount;
  if(total>100000000)return {ok:false,error:"Maximum cart amount exceeded"};
  items.push({productId:p.id,quantity:line.quantity,unitHalalas:p.priceHalalas,
   lineHalalas:amount,title:p.title});
 }
 return {ok:true,items,subtotalHalalas:total,currency:"SAR",vendorId:vendor};
}
export function safeSaudiPhone(phone:unknown):string|null{
 if(typeof phone!=="string")return null;
 const value=phone.replace(/[ ()-]/g,"");
 if(/^05[0-9]{8}$/.test(value))return "+966"+value.slice(1);
 if(/^\+9665[0-9]{8}$/.test(value))return value;
 return null;
}
export function isSaudiOtpCode(value:unknown):value is string{
 return typeof value==="string"&&/^\d{4,10}$/.test(value);
}
export function verifyMoyasarPayment(
 payment:unknown,expected:{id:string;amount:number;currency:"SAR";orderId:string}
):boolean{
 if(!payment||typeof payment!=="object")return false;
 const p=payment as Record<string,unknown>;
 const meta=p.metadata;
 return p.id===expected.id&&p.status==="paid"&&p.amount===expected.amount&&
  p.currency===expected.currency&&meta!==null&&typeof meta==="object"&&
  (meta as Record<string,unknown>).order_id===expected.orderId;
}
