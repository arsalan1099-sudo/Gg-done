import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {Ionicons} from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

type Lang="ar"|"en";
type Props={lang:Lang;origin:string|null};
type Phase="phone"|"otp";
const STORE_KEY="go-saudi-customer-native-session-v1";
const GREEN="#063F32",GOLD="#D6AB60",CREAM="#FFF9EE";
const headers={"Accept":"application/json","Content-Type":"application/json",
 "X-Go-Saudi-Client":"native","X-Go-Saudi-Platform":Platform.OS==="ios"?"ios":"android"};
const labels={
 ar:{
  title:"حسابي",subtitle:"حسابك الآمن في جو سعودي",hello:"أهلاً بك",phone:"رقم الجوال السعودي",
  phoneHint:"05XXXXXXXX",login:"الدخول أو إنشاء حساب",signIn:"أرسل رمز التحقق",
  otp:"رمز التحقق",otpHint:"أدخل رمز الرسالة النصية",verify:"تأكيد الرمز",
  sendAgain:"إعادة إرسال الرمز",change:"تغيير الرقم",consent:"أوافق على معالجة رقم جوالي لأغراض تسجيل الدخول والتحقق وفق سياسة الخصوصية.",
  awaiting:"تحقق من رسالة SMS وأدخل الرمز المستلم",signedIn:"تم تسجيل الدخول بنجاح",
  secured:"تم التحقق من هويتك عبر رسالة نصية حقيقية",account:"معرّف الحساب",
  logout:"تسجيل الخروج",unavailable:"تسجيل الدخول غير متاح حالياً",
  setup:"سيتم تفعيل تسجيل الدخول بعد إعداد خادم السعودية والتحقق من مزود الرسائل ومراجعة الخصوصية.",
  missing:"أدخل رقماً سعودياً صحيحاً يبدأ بـ 05 أو +9665.",consentError:"يجب الموافقة على معالجة بيانات التحقق.",
  invalidCode:"الرجاء إدخال رمز التحقق المستلم.",notReady:"خدمة تسجيل الدخول لم تُفعّل بعد.",
  otpFailed:"تعذّر إرسال الرمز. تحقّق من الرقم وحاول مجدداً.",verifyFailed:"الرمز غير صحيح أو انتهت صلاحيته.",
  network:"تعذر الاتصال بالخادم الآمن. حاول مرة أخرى.",later:"يرجى المحاولة لاحقاً.",
  privacy:"لن نطلب كلمة مرور أو بيانات بنكية. لا تشارك رمز SMS مع أي شخص.",
  expired:"انتهت الجلسة. سجّل الدخول مرة أخرى.",restore:"التحقق من الجلسة المحفوظة...",
  success:"أُرسل رمز التحقق إلى جوالك",remaining:"صلاحية الجلسة: ١٢ ساعة",
 },
 en:{
  title:"My account",subtitle:"Your secure Go Saudi account",hello:"Welcome back",
  phone:"Saudi mobile number",phoneHint:"05XXXXXXXX",login:"Sign in or create an account",
  signIn:"Send verification code",otp:"Verification code",otpHint:"Enter SMS verification code",
  verify:"Verify and sign in",sendAgain:"Resend code",change:"Change number",
  consent:"I agree to the processing of my mobile number for authentication and verification under the privacy policy.",
  awaiting:"Enter the code sent to you by SMS",signedIn:"You are signed in",
  secured:"Your identity was verified using a real SMS code",account:"Account ID",
  logout:"Sign out",unavailable:"Sign in is not available yet",
  setup:"Saudi HTTPS service, SMS provider and privacy approvals must be configured before account access opens.",
  missing:"Enter a valid Saudi mobile number starting 05 or +9665.",
  consentError:"Please agree to phone verification data processing.",
  invalidCode:"Please enter your SMS verification code.",
  notReady:"Verified customer sign-in has not been activated yet.",
  otpFailed:"SMS delivery failed. Check the number and try again.",
  verifyFailed:"Incorrect or expired verification code.",network:"Cannot connect to the secure server.",
  later:"Please try again later.",privacy:"We never ask for bank details or a password. Never share your SMS code.",
  expired:"Your session expired. Please sign in again.",restore:"Checking your saved session...",
  success:"Verification code sent to your mobile",remaining:"Session expires after 12 hours",
 }};
type ServerStatus={available?:boolean;country?:string;method?:string};
type VerifyResponse={authenticated?:boolean;sessionToken?:string;tokenType?:string;customerId?:string};
const validSaudiPhone=(value:string)=>/^(?:05[0-9]{8}|\+9665[0-9]{8})$/.test(value.replace(/[ ()-]/g,""));
function ErrorBanner({value}:{value:string}){
 return value?<View style={styles.errorBox}><Ionicons name="alert-circle-outline" color="#9A4D32" size={18}/>
   <Text style={styles.errorText}>{value}</Text></View>:null;
}
export default function SaudiCustomerAuth({lang,origin}:Props){
 const t=labels[lang],arabic=lang==="ar";
 const [checking,setChecking]=useState(true),[available,setAvailable]=useState(false);
 const [phase,setPhase]=useState<Phase>("phone"),[busy,setBusy]=useState(false);
 const [phone,setPhone]=useState(""),[code,setCode]=useState("");
 const [consent,setConsent]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [session,setSession]=useState<string|null>(null),[customerId,setCustomerId]=useState("");
 const request=useCallback(async(path:string,options:RequestInit={})=>{
  if(!origin)throw new Error("no-origin");
  const result=await fetch(origin+path,{
    ...options,headers:{...headers,...(options.headers as Record<string,string>|undefined)},
  });
  let json:Record<string,unknown>={};
  try{json=await result.json() as Record<string,unknown>;}catch{}
  return {status:result.status,ok:result.ok,json};
 },[origin]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   if(!origin){if(active){setAvailable(false);setChecking(false)}return;}
   try{
    const [readiness,stored]=await Promise.all([
      request("/api/saudi/customer/auth/status"),SecureStore.getItemAsync(STORE_KEY)
    ]);
    if(!active)return;
    setAvailable(readiness.ok&&readiness.json.country==="SA"&&readiness.json.method==="sms_otp"&&readiness.json.available===true);
    if(stored&&/^[a-f0-9]{64}$/.test(stored)){
     const check=await request("/api/saudi/customer/me",{headers:{Authorization:"Bearer "+stored}});
     if(!active)return;
     if(check.ok&&check.json.authenticated===true&&typeof check.json.customerId==="string"){
      setSession(stored);setCustomerId(check.json.customerId);setError("");
     }else if(check.status===401){
      await SecureStore.deleteItemAsync(STORE_KEY);
      if(active)setMessage(labels[lang].expired);
     }else if(active)setError(labels[lang].network);
    }
   }catch{
    if(active)setAvailable(false);
   }finally{if(active)setChecking(false)}
  })();
  return()=>{active=false};
 },[origin,request]); // Do not reinitialize when switching language.
 const start=async()=>{
  setError("");setMessage("");
  if(!available){setError(t.notReady);return;}
  if(!validSaudiPhone(phone)){setError(t.missing);return;}
  if(!consent){setError(t.consentError);return;}
  setBusy(true);
  try{
   const r=await request("/api/saudi/customer/otp/start",{
    method:"POST",body:JSON.stringify({phone:phone.trim(),consent:true})
   });
   if(r.ok&&r.json.sent===true){setPhase("otp");setCode("");setMessage(t.success);}
   else setError(r.status===423?t.notReady:r.status===429?t.later:t.otpFailed);
  }catch{setError(t.network);}finally{setBusy(false);}
 };
 const verify=async()=>{
  setError("");setMessage("");
  if(!/^[0-9]{4,10}$/.test(code.trim())){setError(t.invalidCode);return;}
  setBusy(true);
  try{
   const r=await request("/api/saudi/customer/otp/verify",{
    method:"POST",body:JSON.stringify({phone:phone.trim(),code:code.trim()})
   });
   const result=r.json as VerifyResponse;
   if(r.ok&&result.authenticated===true&&result.tokenType==="Bearer"&&
      typeof result.sessionToken==="string"&&/^[a-f0-9]{64}$/.test(result.sessionToken)){
    // Persist only in the OS encrypted keystore/keychain, never AsyncStorage.
    await SecureStore.setItemAsync(STORE_KEY,result.sessionToken);
    const check=await request("/api/saudi/customer/me",{
     headers:{Authorization:"Bearer "+result.sessionToken}
    });
    if(check.ok&&check.json.authenticated===true&&typeof check.json.customerId==="string"){
     setSession(result.sessionToken);setCustomerId(check.json.customerId);setCode("");setMessage(t.signedIn);
    }else{
     await SecureStore.deleteItemAsync(STORE_KEY);
     setError(t.network);
    }
   }else setError(r.status===423?t.notReady:r.status===429?t.later:t.verifyFailed);
  }catch{setError(t.network);}finally{setBusy(false);}
 };
 const logout=async()=>{
  if(!session)return;
  setBusy(true);setError("");
  try{
   const r=await request("/api/saudi/customer/logout",{
    method:"POST",headers:{Authorization:"Bearer "+session},body:"{}"
   });
   if(!r.ok&&r.status!==401){setError(t.network);return;}
   await SecureStore.deleteItemAsync(STORE_KEY);
   setSession(null);setCustomerId("");setPhase("phone");setCode("");setMessage("");
  }catch{setError(t.network);}finally{setBusy(false);}
 };
 return <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.base}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}>
   <LinearGradient colors={["#073D31","#0A6B4D"]} style={styles.hero}>
    <View style={styles.heroSymbol}><Ionicons name="shield-checkmark-outline" color="#E5B96E" size={34}/></View>
    <Text style={styles.heroTitle}>{t.title}</Text>
    <Text style={styles.heroSub}>{t.subtitle}</Text>
   </LinearGradient>
   <View style={styles.panel}>
    {checking?<View style={styles.loading}><ActivityIndicator color={GOLD}/>
       <Text style={styles.muted}>{t.restore}</Text></View>:
    session?<>
     <Ionicons name="checkmark-circle" color="#14865D" size={54} style={styles.center}/>
     <Text style={styles.title}>{t.hello}</Text>
     <Text style={styles.mutedCenter}>{t.secured}</Text>
     <View style={styles.identity}>
      <Text style={styles.identityLabel}>{t.account}</Text>
      <Text style={styles.identityValue} selectable>{customerId}</Text>
     </View>
     <View style={styles.secureNotice}><Ionicons name="lock-closed-outline" size={17} color="#94713A"/>
      <Text style={styles.noticeText}>{t.remaining}</Text></View>
     <Pressable accessibilityRole="button" disabled={busy} onPress={logout} style={styles.logout}>
      {busy?<ActivityIndicator color={GREEN}/>:<Ionicons name="log-out-outline" color={GREEN} size={19}/>}
      <Text style={styles.logoutText}>{t.logout}</Text>
     </Pressable>
    </>:
    !available?<View style={styles.notReady}>
      <Ionicons name="time-outline" color="#B08846" size={42}/>
      <Text style={styles.title}>{t.unavailable}</Text>
      <Text style={styles.mutedCenter}>{t.setup}</Text>
     </View>:
    <>
     <Text style={[styles.title,{textAlign:arabic?"right":"left"}]}>{t.login}</Text>
     <Text style={[styles.label,{textAlign:arabic?"right":"left"}]}>{t.phone}</Text>
     <View style={styles.phoneRow}>
      <View style={styles.dial}><Text style={styles.dialText}>🇸🇦  +966</Text></View>
      <TextInput style={styles.phoneInput} keyboardType="phone-pad" autoComplete="tel"
       textContentType="telephoneNumber" value={phone} editable={!busy&&phase==="phone"}
       placeholder={t.phoneHint} placeholderTextColor="#9DAE9D" maxLength={16}
       onChangeText={setPhone} textAlign="left" accessibilityLabel={t.phone}/>
     </View>
     {phase==="phone"?<>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
        onPress={()=>setConsent(v=>!v)} disabled={busy} style={styles.consentRow}>
       <Ionicons name={consent?"checkbox":"square-outline"} color={consent?"#0E7757":"#A9A38F"} size={25}/>
       <Text style={[styles.consentText,{textAlign:arabic?"right":"left"}]}>{t.consent}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={start} style={styles.primary}>
       {busy?<ActivityIndicator color="#FFF"/>:<Ionicons name="chatbubble-ellipses-outline" color="#FFF" size={19}/>}
       <Text style={styles.primaryText}>{t.signIn}</Text>
      </Pressable>
     </>:<>
      <Text style={styles.muted}>{t.awaiting}</Text>
      <Text style={[styles.label,{textAlign:arabic?"right":"left"}]}>{t.otp}</Text>
      <TextInput style={styles.otpInput} keyboardType="number-pad" textAlign="center"
       autoComplete="sms-otp" textContentType="oneTimeCode" value={code}
       onChangeText={setCode} secureTextEntry maxLength={10} editable={!busy}
       placeholder="••••••" placeholderTextColor="#ABAB9B" accessibilityLabel={t.otp}/>
      <Pressable disabled={busy} onPress={verify} style={styles.primary}>
       {busy?<ActivityIndicator color="#FFF"/>:<Ionicons name="shield-checkmark-outline" color="#FFF" size={19}/>}
       <Text style={styles.primaryText}>{t.verify}</Text>
      </Pressable>
      <View style={styles.actions}>
       <Pressable disabled={busy} onPress={()=>{setPhase("phone");setCode("");setError("");}}>
         <Text style={styles.link}>{t.change}</Text>
       </Pressable>
       <Pressable disabled={busy} onPress={start}>
         <Text style={styles.link}>{t.sendAgain}</Text>
       </Pressable>
      </View>
     </>}
    </>}
    <ErrorBanner value={error}/>
    {message?<Text style={styles.success}>{message}</Text>:null}
   </View>
   <View style={styles.footer}><Ionicons name="information-circle-outline" color="#9A7A46" size={19}/>
    <Text style={styles.footerText}>{t.privacy}</Text></View>
  </ScrollView>
 </KeyboardAvoidingView>;
}
const styles=StyleSheet.create({
 base:{flex:1,backgroundColor:CREAM},wrap:{paddingBottom:28},
 hero:{padding:25,borderRadius:23,alignItems:"center",marginBottom:16},
 heroSymbol:{height:67,width:67,alignItems:"center",justifyContent:"center",
  borderWidth:1.5,borderColor:GOLD,borderRadius:19,marginBottom:10},
 heroTitle:{fontSize:27,color:"#FFFFFF",fontWeight:"900"},
 heroSub:{fontSize:13,color:"#DFEDE5",marginTop:7},
 panel:{backgroundColor:"#FFFDF8",padding:21,borderRadius:22,borderWidth:1,borderColor:"#E6D9BC"},
 title:{fontSize:19,fontWeight:"900",color:GREEN,textAlign:"center",marginVertical:14},
 label:{color:GREEN,fontWeight:"800",fontSize:13,marginTop:15,marginBottom:8},
 phoneRow:{minHeight:55,borderColor:"#DEC79D",borderWidth:1,borderRadius:15,
  flexDirection:"row",alignItems:"center",paddingLeft:12,backgroundColor:"#FFFFFF"},
 dial:{paddingRight:10,borderRightWidth:1,borderRightColor:"#E9DAC0"},
 dialText:{color:GREEN,fontWeight:"700",fontSize:13},
 phoneInput:{flex:1,padding:12,color:GREEN,fontSize:16},
 consentRow:{flexDirection:"row",alignItems:"flex-start",gap:10,marginVertical:22},
 consentText:{flex:1,color:"#4E6557",fontSize:12,lineHeight:21},
 primary:{marginTop:12,backgroundColor:GREEN,borderRadius:15,padding:16,
  flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9},
 primaryText:{color:"#FFF9E8",fontWeight:"900",fontSize:14},
 muted:{fontSize:12,color:"#758876",marginVertical:11},
 mutedCenter:{color:"#718274",fontSize:13,textAlign:"center",lineHeight:22,marginBottom:17},
 notReady:{alignItems:"center",paddingVertical:24},
 loading:{alignItems:"center",padding:30,gap:12},
 otpInput:{height:62,letterSpacing:10,fontSize:22,fontWeight:"800",color:GREEN,
  borderColor:"#DCC394",borderWidth:1,borderRadius:14,backgroundColor:"#FFFFFF"},
 actions:{flexDirection:"row",justifyContent:"space-between",marginTop:18},
 link:{color:"#94733D",fontSize:13,fontWeight:"800"},
 errorBox:{flexDirection:"row",alignItems:"center",gap:9,padding:11,borderRadius:12,
  backgroundColor:"#FCE9DF",marginTop:16},
 errorText:{color:"#9A4D32",fontSize:12,flex:1},
 success:{fontSize:12,color:"#128353",textAlign:"center",marginTop:16},
 center:{alignSelf:"center"},
 identity:{backgroundColor:"#F3F8F3",borderRadius:12,padding:14,marginTop:10},
 identityLabel:{fontSize:12,color:"#647568"},identityValue:{fontSize:12,color:GREEN,fontWeight:"800",marginTop:5},
 secureNotice:{backgroundColor:"#FFF3DA",borderRadius:12,padding:12,marginTop:18,
  flexDirection:"row",alignItems:"center",gap:9},
 noticeText:{color:"#886A34",flex:1,fontSize:12},
 logout:{borderColor:GREEN,borderWidth:1.5,borderRadius:13,marginTop:18,
  padding:15,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:8},
 logoutText:{color:GREEN,fontSize:14,fontWeight:"800"},
 footer:{flexDirection:"row",gap:11,marginTop:20,padding:13,alignItems:"flex-start"},
 footerText:{fontSize:12,color:"#897753",lineHeight:19,flex:1}
});
