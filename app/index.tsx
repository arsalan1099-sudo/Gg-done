import React, { useEffect, useState } from "react";
import SaudiShop from "@/components/saudi/SaudiPremiumShop";
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";


type Lang = "ar" | "en";
// No fallback to Go Bharat/INR APIs. Mobile seller registration fails closed
// until a separately deployed, reviewed Saudi HTTPS backend is configured.
const configuredSaudiOrigin=(process.env.EXPO_PUBLIC_SAUDI_API_URL || "").trim();
function getSaudiOrigin(): string | null {
  if(!configuredSaudiOrigin) return null;
  try {
    const url=new URL(configuredSaudiOrigin);
    if(url.protocol!=="https:" || url.username || url.password || url.search || url.hash ||
      url.pathname!=="/" || /go[-_]?bharat|gg[-_]?done/i.test(url.hostname)) return null;
    return url.origin;
  }catch{return null;}
}
const saudiOrigin=getSaudiOrigin();
const cities = [
  ["Riyadh","الرياض"],["Jeddah","جدة"],["Makkah","مكة"],["Madinah","المدينة"],
  ["Dammam","الدمام"],["Khobar","الخبر"],["Taif","الطائف"],["Tabuk","تبوك"],
  ["Abha","أبها"],["Jazan","جازان"],["Other","أخرى"]
] as const;
const categories = [
  ["Grocery","🛒","البقالة"],["Fashion","👗","الأزياء"],["Food","🥘","الطعام"],
  ["Electronics","📱","الإلكترونيات"],["Home","🏠","المنزل"],["Beauty","🌷","الجمال"],
  ["Services","🧰","الخدمات"],["Wholesale","📦","الجملة"]
] as const;
const strings = {
  ar: {
    status:"🇸🇦 إصدار سعودي · المرحلة التجريبية",
    headline:"مدينتك، متاجرك، في مكان واحد",
    subtitle:"اكتشف فئات السوق المحلي وسجّل اهتمامك بفتح متجر إلكتروني على جو سعودي.",
    warning:"المنصة قيد الإعداد. لا تتوفر طلبات الشراء أو المدفوعات الآن.",
    categories:"فئات السوق", prelaunch:"قريباً في مدينتك",
    seller:"سجّل اهتمام متجرك", details:"التسجيل الأولي مجاني ولا يمثل عضوية مدفوعة.",
    business:"اسم المتجر", nameHint:"اسم نشاطك التجاري", phone:"رقم الجوال السعودي",phoneHint:"05XXXXXXXX",
    city:"اختر المدينة",category:"نوع النشاط",consent:"أوافق على حفظ بياناتي والتواصل معي بشأن انضمام المتجر.",
    closed:"التسجيل مغلق حتى اكتمال مراجعة الخصوصية",submit:"إرسال الطلب",sending:"جار الإرسال…",success:"تم تسجيل اهتمامك بنجاح.",
    error:"تعذر حفظ الطلب. حاول مرة أخرى.",invalid:"راجع البيانات، رقم الجوال والموافقة.",
    coming:"التسوق والمدفوعات سيتم تفعيلها بعد اعتماد الشروط والتحقق.", powered:"GO SAUDI · AASAA"
  },
  en: {
    status:"🇸🇦 Saudi edition · Prelaunch",
    headline:"Your city. Your stores. All together.",
    subtitle:"Explore planned local marketplace categories and register interest in opening a Go Saudi shop.",
    warning:"The platform is in prelaunch. Orders and payments are not available.",
    categories:"Marketplace categories",prelaunch:"Coming to your city",
    seller:"Register your store interest",details:"Seller enquiries are free, not paid memberships.",
    business:"Business name",nameHint:"Your store name",phone:"Saudi mobile",phoneHint:"05XXXXXXXX",
    city:"Select city",category:"Business category",consent:"I agree to store my details and be contacted about seller onboarding.",
    closed:"Registration unavailable pending privacy approval",submit:"Send enquiry",sending:"Submitting…",success:"Your enquiry has been recorded.",
    error:"Could not save your enquiry. Try again.",invalid:"Check the details, Saudi phone and consent.",
    coming:"Shopping and payments will be enabled after verification and compliance review.",powered:"GO SAUDI · AASAA"
  }
} as const;

export default function GoSaudiPreview() {
  const [lang,setLang] = useState<Lang>("ar");
  const [screen,setScreen] = useState<"shop"|"seller">("shop");
  const [businessName,setBusinessName]=useState("");
  const [phone,setPhone]=useState("");
  const [city,setCity]=useState("");
  const [category,setCategory]=useState("");
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [sellerOpen,setSellerOpen]=useState(false);
  const [notice,setNotice]=useState<"success"|"error"|"invalid"|"closed"|null>(null);
  useEffect(()=>{
    let active=true;
    if(!saudiOrigin)return;
    fetch(saudiOrigin+"/api/saudi/market",{headers:{Accept:"application/json"}})
      .then(res=>res.ok?res.json():Promise.reject(new Error("Saudi API unavailable")))
      .then(data=>{
        if(active)setSellerOpen(data?.country==="SA" && data?.currency==="SAR" &&
          data?.status==="PRELAUNCH" && data?.sellerEnquiriesOpen===true &&
          data?.paymentsEnabled===false);
      }).catch(()=>{if(active)setSellerOpen(false)});
    return ()=>{active=false;};
  },[]);
  const tr=strings[lang];
  const ar=lang==="ar";
  const textAlign=ar?"right" as const:"left" as const;

  const submit=async()=>{
    if(busy)return;
    if(!saudiOrigin||!sellerOpen){setNotice("closed");return;}
    const cleaned=phone.replace(/[\s()+-]/g,"");
    if(businessName.trim().length < 2 || !city || !category || !consent || !/^(?:0?5[0-9]{8}|9665[0-9]{8})$/.test(cleaned)){
      setNotice("invalid");return;
    }
    setNotice(null);setBusy(true);
    try {
      const response=await fetch(saudiOrigin+"/api/saudi/seller-enquiries",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({businessName:businessName.trim(),phone,city,category,consent:true})
      });
      if(!response.ok)throw new Error("Saudi seller enquiry unavailable");
      setBusinessName("");setPhone("");setCity("");setCategory("");setConsent(false);setNotice("success");
    }catch(_error){setNotice("error");}finally{setBusy(false);}
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor="#054634"/>
      {screen==="shop"?(
        <SaudiShop lang={lang} setLang={setLang} origin={saudiOrigin} onSell={()=>setScreen("seller")}/>
      ):<>
      <View style={{backgroundColor:"#064b3a",paddingHorizontal:20,paddingTop:14,paddingBottom:9}}>
        <Pressable onPress={()=>setScreen("shop")} accessibilityRole="button">
          <Text style={{color:"#e0f2e8",fontWeight:"900",fontSize:15}}>{lang==="ar"?"← العودة إلى السوق":"← Back to marketplace"}</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.nav}>
            <View style={styles.brandRow}><View style={styles.brandIcon}><Text style={styles.brandMark}>✦</Text></View><Text style={styles.brand}>GO SAUDI</Text></View>
            <Pressable onPress={()=>setLang(ar?"en":"ar")} style={styles.lang} accessibilityRole="button">
              <Text style={styles.langText}>{ar?"English":"العربية"}</Text>
            </Pressable>
          </View>
          <Text style={[styles.kicker,{textAlign}]}>{tr.status}</Text>
          <Text style={[styles.heading,{textAlign}]}>{tr.headline}</Text>
          <Text style={[styles.heroDesc,{textAlign}]}>{tr.subtitle}</Text>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{tr.prelaunch}  •  SAR</Text></View>
        </View>

        <View style={styles.body}>
          <View style={styles.warning}><Text style={[styles.warningText,{textAlign}]}>{tr.warning}</Text></View>
          <Text style={[styles.sectionTitle,{textAlign}]}>{tr.categories}</Text>
          <View style={styles.categories}>
            {categories.map(([id,emoji,arabic])=>(
              <Pressable key={id} accessibilityRole="button"
                onPress={()=>{setCategory(id);setNotice(null);}}
                style={[styles.category,category===id&&styles.categorySelected]}>
                <Text style={styles.catEmoji}>{emoji}</Text>
                <Text style={styles.categoryLabel}>{ar?arabic:id}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.form}>
            <Text style={[styles.sectionTitle,{textAlign}]}>{tr.seller}</Text>
            <Text style={[styles.help,{textAlign}]}>{tr.details}</Text>
            <Text style={[styles.fieldLabel,{textAlign}]}>{tr.business}</Text>
            <TextInput value={businessName} onChangeText={setBusinessName} maxLength={100}
              placeholder={tr.nameHint} style={[styles.input,{textAlign}]} placeholderTextColor="#829389"/>
            <Text style={[styles.fieldLabel,{textAlign}]}>{tr.phone}</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20}
              placeholder={tr.phoneHint} style={[styles.input,{textAlign:"left"}]} placeholderTextColor="#829389"/>
            <Text style={[styles.fieldLabel,{textAlign}]}>{tr.city}</Text>
            <View style={styles.options}>
              {cities.map(([id,arLabel])=>(
                <Pressable key={id} onPress={()=>setCity(id)} style={[styles.chip,city===id&&styles.chipSelected]}>
                  <Text style={[styles.chipText,city===id&&styles.chipTextSelected]}>{ar?arLabel:id}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.fieldLabel,{textAlign}]}>{tr.category}</Text>
            <View style={styles.options}>
              {categories.map(([id,,arLabel])=>(
                <Pressable key={id} onPress={()=>setCategory(id)} style={[styles.chip,category===id&&styles.chipSelected]}>
                  <Text style={[styles.chipText,category===id&&styles.chipTextSelected]}>{ar?arLabel:id}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={()=>setConsent(!consent)} style={[styles.consentRow,{flexDirection:ar?"row-reverse":"row"}]}
              accessibilityRole="checkbox" accessibilityState={{checked:consent}}>
              <View style={[styles.checkbox,consent&&styles.checkboxChecked]}>{consent&&<Text style={styles.checkmark}>✓</Text>}</View>
              <Text style={[styles.consentText,{textAlign}]}>{tr.consent}</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={busy||!sellerOpen} style={[styles.submit,!sellerOpen&&{opacity:0.55}]} accessibilityRole="button">
              {busy?<ActivityIndicator color="#fff"/>:<Text style={styles.submitText}>{sellerOpen?tr.submit:tr.closed}</Text>}
            </Pressable>
            {notice&&<Text accessibilityRole="alert" style={[styles.feedback,{color:notice==="success"?"#067146":"#a92b30",textAlign}]}>{tr[notice]}</Text>}
          </View>
          <Text style={[styles.coming,{textAlign}]}>{tr.coming}</Text>
          <Text style={styles.footer}>{tr.powered}</Text>
        </View>
      </ScrollView>
      </>}
    </View>
  );
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:"#f6faf7"},
  container:{paddingBottom:35},
  hero:{backgroundColor:"#064b3a",paddingTop:Platform.OS==="web"?34:48,paddingHorizontal:23,paddingBottom:41},
  nav:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:35},
  brandRow:{flexDirection:"row",alignItems:"center",gap:9},
  brandIcon:{backgroundColor:"#258568",borderRadius:13,width:41,height:41,alignItems:"center",justifyContent:"center"},
  brandMark:{fontSize:24,color:"#fff"},brand:{fontSize:20,fontWeight:"900",color:"#fff",letterSpacing:.5},
  lang:{paddingVertical:10,paddingHorizontal:13,backgroundColor:"#ffffff19",borderRadius:12,borderWidth:1,borderColor:"#ffffff44"},
  langText:{color:"#fff",fontSize:13,fontWeight:"800"},
  kicker:{color:"#d9bb80",fontSize:13,fontWeight:"800",marginBottom:17},
  heading:{color:"#fff",fontSize:34,fontWeight:"900",lineHeight:45,marginBottom:17},
  heroDesc:{color:"#d5ebe0",fontSize:16,lineHeight:27,marginBottom:21},
  heroBadge:{backgroundColor:"#ffffff19",alignSelf:"flex-start",paddingVertical:10,paddingHorizontal:15,borderRadius:20},
  heroBadgeText:{color:"#fff",fontSize:13,fontWeight:"700"},
  body:{paddingHorizontal:20,paddingTop:22,maxWidth:660,width:"100%",alignSelf:"center"},
  warning:{backgroundColor:"#fff7e6",borderColor:"#f2dfad",borderWidth:1,padding:16,borderRadius:14,marginBottom:22},
  warningText:{color:"#665127",fontSize:13,lineHeight:23},
  sectionTitle:{fontSize:24,fontWeight:"900",color:"#193b2e",marginBottom:15},
  categories:{flexDirection:"row",flexWrap:"wrap",gap:9,marginBottom:26},
  category:{width:"48%",backgroundColor:"#fff",borderWidth:1,borderColor:"#e0ebe4",padding:21,borderRadius:17,alignItems:"center",gap:8},
  categorySelected:{borderColor:"#08784d",borderWidth:2,backgroundColor:"#e8f7ee"},
  catEmoji:{fontSize:31},categoryLabel:{fontSize:13,fontWeight:"800",color:"#284c3b"},
  form:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e4eee7",borderRadius:22,padding:20},
  help:{color:"#61746a",fontSize:13,lineHeight:22,marginBottom:20},
  fieldLabel:{color:"#2a4637",fontSize:13,fontWeight:"800",marginTop:10,marginBottom:8},
  input:{borderRadius:12,borderWidth:1,borderColor:"#cadbd0",backgroundColor:"#fcfefc",paddingHorizontal:15,paddingVertical:12,fontSize:15,color:"#142f24",minHeight:49},
  options:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:10},
  chip:{paddingVertical:9,paddingHorizontal:12,backgroundColor:"#f4f8f5",borderRadius:20,borderWidth:1,borderColor:"#dfe9e2"},
  chipSelected:{backgroundColor:"#0b7650",borderColor:"#0b7650"},
  chipText:{color:"#3c5548",fontWeight:"600",fontSize:12},
  chipTextSelected:{color:"#fff"},
  consentRow:{gap:10,alignItems:"center",marginVertical:19},
  checkbox:{width:22,height:22,borderWidth:1.5,borderColor:"#6c9d80",borderRadius:6,alignItems:"center",justifyContent:"center"},
  checkboxChecked:{backgroundColor:"#09744f",borderColor:"#09744f"},checkmark:{color:"#fff",fontWeight:"900"},
  consentText:{flex:1,fontSize:12,color:"#536658",lineHeight:20},
  submit:{backgroundColor:"#0a704d",padding:17,borderRadius:13,alignItems:"center",justifyContent:"center"},
  submitText:{color:"#fff",fontSize:15,fontWeight:"900"},
  feedback:{fontSize:13,marginTop:13,fontWeight:"700"},
  coming:{textAlign:"center",marginTop:25,color:"#6e7d73",fontSize:13,lineHeight:21},
  footer:{textAlign:"center",marginTop:23,color:"#0b704c",fontSize:13,fontWeight:"900"}
});
