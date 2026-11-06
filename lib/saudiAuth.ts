// Saudi customer phone number normalization for the mobile form.
// The country-code prefix is shown separately; never append it twice.
// The server remains authoritative and revalidates every submitted number.
export function normalizeSaudiMobile(value:string):string|null{
 if(typeof value!=="string")return null;
 const v=value.trim().replace(/[\s()-]/g,"");
 if(/^5\d{8}$/.test(v))return "+966"+v;
 if(/^05\d{8}$/.test(v))return "+966"+v.slice(1);
 if(/^\+9665\d{8}$/.test(v))return v;
 return null;
}
export function validateSaudiOtpInput(value:string):boolean{
 return /^\d{4,10}$/.test(value.trim());
}
