import {verifyMoyasarPayment,safeSaudiPhone,isSaudiOtpCode} from "./saudiCommerceRules";

// Direct documented providers only; never accept card PAN/CVV in Go Saudi.
// No network calls occur unless checkout/OTP readiness is explicitly enabled.
// API secrets must be kept in server environment and never returned to clients.
const timeoutMs=9000;
function moyasarKey():string{
 const key=process.env.MOYASAR_SECRET_KEY||"";
 if(!/^sk_(test|live)_[A-Za-z0-9_-]{12,}$/.test(key))
  throw Error("Moyasar secret unavailable");
 return key;
}
function twilioConfig(){
 const sid=process.env.TWILIO_VERIFY_SERVICE_SID||"";
 const key=process.env.TWILIO_API_KEY||"";
 const secret=process.env.TWILIO_API_SECRET||"";
 if(!/^VA[a-f0-9]{32}$/i.test(sid)||!/^SK[a-f0-9]{32}$/i.test(key)||!secret)
  throw Error("Twilio Verify not configured");
 return {sid,key,secret};
}
async function providerFetch(url:string,init:RequestInit):Promise<unknown>{
 const response=await fetch(url,{...init,redirect:"error",signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw Error("Payment/identity provider returned HTTP "+response.status);
 const data:unknown=await response.json();
 if(!data||typeof data!=="object")throw Error("Invalid payment provider response");
 return data;
}
export async function requestSaudiOtp(phone:unknown):Promise<boolean>{
 const normalized=safeSaudiPhone(phone);
 if(!normalized)throw Error("Valid Saudi mobile required");
 const {sid,key,secret}=twilioConfig();
 const basic=Buffer.from(key+":"+secret).toString("base64");
 const p=await providerFetch(
  "https://verify.twilio.com/v2/Services/"+sid+"/Verifications",{
   method:"POST",headers:{Authorization:"Basic "+basic,
    "Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({To:normalized,Channel:"sms"}).toString()
  }) as Record<string,unknown>;
 return p.status==="pending";
}
export async function checkSaudiOtp(phone:unknown,code:unknown):Promise<boolean>{
 const normalized=safeSaudiPhone(phone);
 if(!normalized||!isSaudiOtpCode(code))return false;
 const {sid,key,secret}=twilioConfig();
 const p=await providerFetch(
  "https://verify.twilio.com/v2/Services/"+sid+"/VerificationCheck",{
   method:"POST",headers:{Authorization:"Basic "+Buffer.from(key+":"+secret).toString("base64"),
    "Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({To:normalized,Code:code}).toString()
  }) as Record<string,unknown>;
 return p.status==="approved";
}
export type SaudiMoyasarIntent={id:string;clientSecret:string;amount:number;currency:"SAR"};
export async function createSaudiPaymentIntent(
 orderId:string,amountHalalas:number,callbackUrl:string
):Promise<SaudiMoyasarIntent>{
 if(!/^SO_[a-f0-9]{30}$/.test(orderId)||!Number.isSafeInteger(amountHalalas)||
  amountHalalas<1||amountHalalas>100000000)throw Error("Invalid Saudi order/amount");
 const url=new URL(callbackUrl);
 if(url.protocol!=="https:"||url.username||url.password)throw Error("HTTPS callback required");
 const p=await providerFetch("https://api.moyasar.com/v1/payment_intents",{
   method:"POST",
   headers:{Authorization:"Basic "+Buffer.from(moyasarKey()+":").toString("base64"),
    "Content-Type":"application/json"},
   body:JSON.stringify({
    amount:amountHalalas,currency:"SAR",description:"Go Saudi order "+orderId,
    callback_url:url.toString(),metadata:{order_id:orderId}
   })
 }) as Record<string,unknown>;
 if(typeof p.id!=="string"||typeof p.client_secret!=="string"||
  p.amount!==amountHalalas||p.currency!=="SAR")
   throw Error("Moyasar payment intent mismatch");
 return {id:p.id,clientSecret:p.client_secret,amount:amountHalalas,currency:"SAR"};
}
export async function fetchAndVerifySaudiPayment(
 paymentId:string,expected:{amount:number;orderId:string}
):Promise<boolean>{
 if(!/^[a-f0-9-]{20,64}$/i.test(paymentId))return false;
 const p=await providerFetch(
  "https://api.moyasar.com/v1/payments/"+encodeURIComponent(paymentId),{
   method:"GET",headers:{
    Authorization:"Basic "+Buffer.from(moyasarKey()+":").toString("base64"),
    Accept:"application/json"
   }
  });
 return verifyMoyasarPayment(p,{id:paymentId,amount:expected.amount,currency:"SAR",orderId:expected.orderId});
}
