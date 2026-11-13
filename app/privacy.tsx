import React from "react";
import {View,Text,ScrollView,Pressable,StyleSheet} from "react-native";
import {router} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";

// This is a factual prelaunch disclosure. Legal approval, contact details,
// retention terms and applicable Saudi notices are release blockers.
const disclosures=[
 {en:"Current features",ar:"الميزات الحالية",
  body:"Go Saudi is a PRELAUNCH marketplace preview. You can browse categories without an account. Shopping, paid orders, shipping and payments are not enabled. Saved items, the local cart and any clearly marked test-only receipts can remain on this device.",
  arabic:"جو سعودي في مرحلة ما قبل الإطلاق. يمكن استعراض الفئات دون حساب. لا تتوفر طلبات الشراء أو الشحن أو المدفوعات الحقيقية. قد تبقى المفضلة والسلة وإيصالات الاختبار على الجهاز."},
 {en:"Personal information",ar:"المعلومات الشخصية",
  body:"Seller enquiry collection is currently disabled pending privacy approval. If enabled later, a seller may choose to submit a business name, Saudi city, category, +966 phone and explicit consent. Real customer SMS login also remains unavailable until the service and privacy safeguards are approved. Do not send identity documents or payment information through the preview.",
  arabic:"استقبال طلبات البائعين مغلق حالياً بانتظار الموافقة على الخصوصية. عند تفعيله قد يرسل البائع اسم النشاط والمدينة والفئة ورقم الهاتف السعودي بموافقته. تسجيل الدخول برمز SMS غير متاح بعد. لا ترسل مستندات الهوية أو بيانات الدفع."},
 {en:"Device and service data",ar:"بيانات الجهاز والخدمة",
  body:"The preview can access its dedicated Go Saudi API for catalogue availability and service status. Network requests may expose normal connection information such as an IP address and request time to the hosting service. On-device saved items and cart entries are not live purchases.",
  arabic:"قد يتصل التطبيق بواجهة جو سعودي للتحقق من حالة الخدمة والمنتجات. قد تظهر معلومات الاتصال المعتادة مثل عنوان الإنترنت ووقت الطلب لخدمة الاستضافة. السلة والمفضلة ليست مشتريات حقيقية."},
 {en:"Hosting and providers",ar:"الاستضافة ومزودو الخدمة",
  body:"The dedicated prelaunch web service currently runs on Render in Singapore. Saudi data-residency and cross-border transfer review is not complete. Twilio SMS and Moyasar payments are planned integrations, not active customer services in this preview.",
  arabic:"خدمة الويب التجريبية مستضافة حالياً لدى Render في سنغافورة. مراجعة استضافة البيانات ونقلها لم تكتمل. خدمات الرسائل والمدفوعات المخطط لها ليست مفعلة للعملاء."},
 {en:"Access, deletion and contact",ar:"الوصول والحذف والتواصل",
  body:"Before personal-data collection is enabled, the operator must publish a verified privacy contact and request/deletion process, including retention periods. This notice is a technical prelaunch disclosure, NOT a legally approved Saudi privacy policy. External publishing and customer registration remain blocked until review.",
  arabic:"قبل تفعيل جمع البيانات الشخصية يجب نشر جهة اتصال موثقة وإجراءات الوصول والحذف وفترات الاحتفاظ. هذا إشعار تقني تجريبي وليس سياسة خصوصية سعودية معتمدة. النشر التجاري والتسجيل مغلقان حتى المراجعة."}
] as const;

export default function SaudiPrivacyScreen(){
 const {top,bottom}=useSafeAreaInsets();
 return <View style={styles.page}>
  <View style={[styles.header,{paddingTop:top+12}]}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()}>
    <Text style={styles.back}>← Back / رجوع</Text>
   </Pressable>
   <Text style={styles.title}>Go Saudi — Privacy / الخصوصية</Text>
   <Text style={styles.status}>PRELAUNCH · Updated 12 November 2026</Text>
  </View>
  <ScrollView contentContainerStyle={{padding:18,paddingBottom:bottom+35}}>
   {disclosures.map(section=><View key={section.en} style={styles.card}>
    <Text style={styles.heading}>{section.en}</Text>
    <Text style={styles.body}>{section.body}</Text>
    <Text style={styles.arTitle}>{section.ar}</Text>
    <Text style={styles.arBody}>{section.arabic}</Text>
   </View>)}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:"#F8F6EF"},
 header:{backgroundColor:"#063F32",paddingHorizontal:20,paddingBottom:17},
 back:{color:"#F1D090",fontWeight:"700",fontSize:14,marginBottom:12},
 title:{color:"#FFFFFF",fontWeight:"800",fontSize:20},
 status:{color:"#F1D090",fontSize:12,marginTop:8},
 card:{backgroundColor:"#FFFFFF",borderRadius:14,padding:18,marginBottom:13,borderWidth:1,borderColor:"#E9E4D7"},
 heading:{color:"#063F32",fontWeight:"800",fontSize:16,marginBottom:8},
 body:{color:"#253F36",fontSize:14,lineHeight:22},
 arTitle:{color:"#063F32",fontWeight:"800",fontSize:16,marginTop:16,textAlign:"right"},
 arBody:{color:"#253F36",fontSize:14,lineHeight:24,textAlign:"right"}
});
