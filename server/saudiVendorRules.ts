import crypto from "node:crypto";
export const SAUDI_VENDOR_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const SAUDI_DRAFT_LIMIT = 200;
export function sha256Token(token: string): string {
  return crypto.createHash("sha256").update(token,"utf8").digest("hex");
}
export function safeVendorToken(raw: unknown): raw is string {
  return typeof raw==="string" && SAUDI_VENDOR_TOKEN_PATTERN.test(raw);
}
export function draftProduct(input: unknown): 
  | {ok:true;value:{title:string;description:string;priceHalalas:number;stock:number}}
  | {ok:false;error:string} {
  if (!input || typeof input!=="object" || Array.isArray(input)) return {ok:false,error:"Invalid product"};
  const v=input as Record<string,unknown>;
  const title=typeof v.title==="string"?v.title.trim():"";
  const description=typeof v.description==="string"?v.description.trim():"";
  if(title.length<2||title.length>120)return {ok:false,error:"Title must be 2–120 characters"};
  if(description.length>1500)return {ok:false,error:"Description too long"};
  // All price inputs are integer halalas; do not accept floats or converted INR.
  if(!Number.isSafeInteger(v.priceHalalas)||Number(v.priceHalalas)<1||Number(v.priceHalalas)>100000000)
    return {ok:false,error:"Price must be 1–100000000 halalas"};
  if(!Number.isSafeInteger(v.stock)||Number(v.stock)<0||Number(v.stock)>1000000)
    return {ok:false,error:"Stock must be 0–1000000"};
  return {ok:true,value:{title,description,priceHalalas:Number(v.priceHalalas),stock:Number(v.stock)}};
}
export function safeShopDescription(value: unknown): string|null {
  if(typeof value!=="string")return null;
  const s=value.trim();
  return s.length<=600?s:null;
}
