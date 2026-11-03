import {isSaudiSubcategory} from "./saudiCategories";
export type SaudiProduct={
 id:string;title:string;description:string;priceHalalas:number;stock:number;
 category:string;city:string;businessName:string;subcategoryId?:string|null;
};
export type CartLine={id:string;quantity:number};
export function safeSaudiProduct(v:unknown):v is SaudiProduct{
 if(!v||typeof v!=="object")return false;
 const p=v as Record<string,unknown>;
 return typeof p.id==="string"&&/^(SVC_[a-f0-9]{30}|demo-[a-z0-9-]{2,40})$/.test(p.id) &&
  typeof p.title==="string"&&p.title.length>0&&p.title.length<=120 &&
  typeof p.description==="string"&&p.description.length<=1500 &&
  Number.isSafeInteger(p.priceHalalas)&&Number(p.priceHalalas)>0&&Number(p.priceHalalas)<=100000000 &&
  Number.isSafeInteger(p.stock)&&Number(p.stock)>=0&&Number(p.stock)<=1000000 &&
  typeof p.category==="string"&&typeof p.city==="string"&&typeof p.businessName==="string"&&
  (p.subcategoryId===undefined||p.subcategoryId===null||isSaudiSubcategory(p.subcategoryId));
}
export function changeSaudiCart(cart:CartLine[],p:SaudiProduct,delta:number):CartLine[]{
 if(!Number.isSafeInteger(delta)||Math.abs(delta)!==1)return cart;
 const current=cart.find(x=>x.id===p.id)?.quantity||0;
 const next=Math.max(0,Math.min(20,p.stock,current+delta));
 return next===0?cart.filter(x=>x.id!==p.id):
  [...cart.filter(x=>x.id!==p.id),{id:p.id,quantity:next}];
}
export function safeSaudiCart(raw:unknown,products:SaudiProduct[]):CartLine[]{
 if(!Array.isArray(raw))return [];
 const out:CartLine[]=[];
 for(const line of raw.slice(0,100)){
  if(!line||typeof line!=="object")continue;
  const x=line as Record<string,unknown>;
  const product=products.find(p=>p.id===x.id);
  if(!product||!Number.isSafeInteger(x.quantity)||Number(x.quantity)<1||out.some(y=>y.id===x.id))continue;
  out.push({id:product.id,quantity:Math.min(20,product.stock,Number(x.quantity))});
 }
 return out.filter(x=>x.quantity>0);
}
export function saudiCartTotal(cart:CartLine[],products:SaudiProduct[]){
 return cart.reduce((sum,line)=>{
  const p=products.find(x=>x.id===line.id);
  return sum+(p? p.priceHalalas*line.quantity:0);
 },0);
}
export const sar=(halalas:number)=>"SAR "+(halalas/100).toFixed(2);
