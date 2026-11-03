// Offline QA only. Never transmit these records or represent them as
// merchant orders, inventory reservations, fulfilment commitments or payments.
import {SaudiProduct,CartLine,safeSaudiCart,saudiCartTotal} from "./saudiCart";

export type SaudiDemoOrderLine={
 id:string;title:string;quantity:number;unitPriceHalalas:number;lineTotalHalalas:number;
};
export type SaudiDemoOrder={
 id:string;createdAt:string;status:"TEST_ONLY";currency:"SAR";
 totalHalalas:number;items:SaudiDemoOrderLine[];paymentCaptured:false;
 serverOrderId:null;deliveryScheduled:false;
};
export function makeSaudiDemoOrder(
 rawCart:CartLine[],products:SaudiProduct[],id:string,createdAt:string
):SaudiDemoOrder|null{
 const cart=safeSaudiCart(rawCart,products);
 if(!cart.length||cart.length!==rawCart.length||cart.length>50||
  !/^DEMO-SA-[A-Za-z0-9-]{10,42}$/.test(id)||!Number.isFinite(Date.parse(createdAt)))return null;
 const items:SaudiDemoOrderLine[]=cart.map(c=>{
  const p=products.find(p=>p.id===c.id)!;
  return {id:p.id,title:p.title,quantity:c.quantity,
   unitPriceHalalas:p.priceHalalas,lineTotalHalalas:p.priceHalalas*c.quantity};
 });
 const totalHalalas=saudiCartTotal(cart,products);
 if(!Number.isSafeInteger(totalHalalas)||totalHalalas<1||totalHalalas>100000000)return null;
 return {id,createdAt,status:"TEST_ONLY",currency:"SAR",totalHalalas,items,
  paymentCaptured:false,serverOrderId:null,deliveryScheduled:false};
}
export function safeSaudiDemoOrderHistory(value:unknown):SaudiDemoOrder[]{
 if(!Array.isArray(value))return [];
 const out:SaudiDemoOrder[]=[];
 for(const item of value.slice(0,30)){
  if(!item||typeof item!=="object")continue;
  const o=item as Record<string,unknown>;
  if(typeof o.id!=="string"||!/^DEMO-SA-[A-Za-z0-9-]{10,42}$/.test(o.id)||
   typeof o.createdAt!=="string"||!Number.isFinite(Date.parse(o.createdAt))||
   o.status!=="TEST_ONLY"||o.currency!=="SAR"||o.paymentCaptured!==false||
   o.serverOrderId!==null||o.deliveryScheduled!==false||
   !Array.isArray(o.items)||!o.items.length||o.items.length>50||
   !Number.isSafeInteger(o.totalHalalas)||Number(o.totalHalalas)<1)continue;
  const lines=o.items as Record<string,unknown>[];
  if(!lines.every(x=>x&&typeof x.id==="string"&&typeof x.title==="string"&&
   x.title.length<=120&&Number.isSafeInteger(x.quantity)&&Number(x.quantity)>0&&
   Number.isSafeInteger(x.unitPriceHalalas)&&Number(x.unitPriceHalalas)>0&&
   Number.isSafeInteger(x.lineTotalHalalas)&&
   Number(x.lineTotalHalalas)===Number(x.unitPriceHalalas)*Number(x.quantity)))continue;
  if(lines.reduce((sum,l)=>sum+Number(l.lineTotalHalalas),0)!==o.totalHalalas)continue;
  if(out.some(x=>x.id===o.id))continue;
  out.push(o as SaudiDemoOrder);
 }
 return out;
}
