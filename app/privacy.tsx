import React from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const policyUrl = "https://github.com/arsalan1099-sudo/Gg-done/blob/go-saudi/docs/go-saudi/legal/privacy.md";
const paragraphs = [
  "Go Saudi Privacy Policy | سياسة خصوصية Go Saudi",
  "22 November 2026 · Android preview 0.2.2 (build 4)",
  "Operator and data controller: AASAA Pvt Ltd. Privacy contact: aasaa.pvt.ltd@gmail.com. This notice covers browsing, phone sign-in and seller enquiries in the Go Saudi preview. This version does not take orders or process payments.",
  "What happens when you use the app",
  "Browse or save an item\nThe app keeps shopping selections, including favourites and cart contents, on your device. If it retrieves a catalogue online, the server receives the request and the connection information needed to respond, including the network IP address.",
  "Choose phone sign-in, where available\nYour mobile number and verification request go to the sign-in service. An SMS provider needs the number to deliver a code. The app sends the number and the code you enter for verification and stores the resulting session token in secure device storage. This allows the service to recognise your signed-in session.",
  "Ask about becoming a seller, where available\nYou provide a business name, mobile number, city selected by you, business category and permission to contact you. These details are used to respond and follow up about onboarding. Without the requested details we may be unable to process the enquiry.",
  "Email support or exercise a right\nWe receive your email address, message and any details you choose to include. We use them to respond, verify the request where necessary and document its resolution. Never send a password, one-time code or payment card details.",
  "Build 4 does not request Android precise or approximate location permission, display ads or use the Android advertising ID. You can browse the preview without submitting a seller enquiry.",
  "Purposes, recipients and retention",
  "We use information needed to provide features you request, rely on your permission for seller follow-up, and process information where required to meet legal obligations. Hosting, authentication, SMS and email providers may handle the information needed for their respective functions. We may disclose information to an authority where required by law. Permission for onboarding follow-up does not authorise unrelated marketing.",
  "Local selections remain until removed or app storage is cleared. Signing out removes the local session token. We keep enquiry and support records for the time needed to handle the request, resolve related disputes and meet applicable recordkeeping duties. When those purposes end, personal data is to be destroyed or anonymised unless lawful retention is required. Service logs and backup copies can have separate retention periods. For the providers, processing locations, transfer arrangements or retention period relevant to your request, contact the controller. Any transfer outside Saudi Arabia is subject to applicable Saudi transfer requirements.",
  "Access, correction and deletion",
  "Email aasaa.pvt.ltd@gmail.com with the subject Go Saudi privacy. You can ask how your data is used, request access or a readable copy, correct it, request its destruction, or withdraw consent for future processing based on consent. For account deletion, use Delete my Go Saudi account and identify the phone number or email associated with the account. For seller enquiries, specify the business and contact used. We may ask for proportionate verification. Clearing Android app storage affects your device only. To request removal of server records, email us even if you have uninstalled the app.",
  "We will explain any information we must retain and why. Saudi data-rights requests are generally due a response within 30 days. If a lawful extension applies we will explain the delay. You may also complain to the Saudi Data & AI Authority through its Personal Data Protection Platform. We will date material revisions and seek renewed consent where required.",
  "العربية",
  "٢٢ نوفمبر ٢٠٢٦ · إصدار أندرويد التجريبي 0.2.2 (البنية 4)",
  "جهة التحكم هي AASAA Pvt Ltd. للتواصل بشأن الخصوصية: aasaa.pvt.ltd@gmail.com. تشمل هذه السياسة تصفّح التطبيق وتسجيل الدخول بالهاتف والاستفسار عن تسجيل البائعين. لا يستقبل هذا الإصدار طلبات شراء أو مدفوعات.",
  "• التصفّح: تُحفظ المفضلة ومحتويات السلة على جهازك. عند تحميل الكتالوج عبر الإنترنت، يتلقى الخادم الطلب وبيانات الاتصال اللازمة للرد، ومنها عنوان بروتوكول الإنترنت.",
  "• الدخول بالهاتف عند إتاحته: تستقبل خدمة التحقق رقم الهاتف وطلب إرسال الرمز، ويحتاج مزود الرسائل إلى الرقم لإرسال الرمز. يرسل التطبيق الرقم والرمز للتحقق ويحفظ رمز الجلسة في مساحة تخزين آمنة على جهازك. يزيل تسجيل الخروج رمز الجلسة المحلي.",
  "• استفسار البائع عند إتاحته: نستخدم اسم المنشأة ورقم الهاتف والمدينة التي تختارها وفئة النشاط وإذنك بالتواصل للرد ومتابعة التسجيل. قد يتعذر الرد دون هذه البيانات. الإذن بالمتابعة لا يشمل التسويق لأغراض أخرى.",
  "• الدعم: نتلقى عنوان بريدك ورسالتك وأي معلومات ترفقها للتعامل مع طلبك والتحقق من هويتك عند الحاجة وتوثيق الرد. لا ترسل كلمة مرور أو رمز تحقق أو بيانات بطاقة دفع.",
  "يمكنك التصفح دون تقديم استفسار بائع. لا يطلب هذا الإصدار إذن الموقع الدقيق أو التقريبي في أندرويد، ولا يعرض إعلانات أو يستخدم معرّف إعلانات أندرويد.",
  "نعالج البيانات لتقديم الخدمة التي تطلبها وبناءً على موافقتك للمتابعة وبموجب الالتزامات النظامية ذات الصلة. قد يعالج مزودو الاستضافة والتحقق والرسائل والبريد البيانات اللازمة لوظائفهم. وقد نكشف البيانات للجهة المختصة إذا أوجب النظام ذلك. يخضع أي نقل خارج المملكة للمتطلبات النظامية السعودية ذات الصلة. للاستفسار عن المزود أو مكان المعالجة أو ضمانات النقل، تواصل معنا.",
  "تبقى اختياراتك على الجهاز حتى تزيلها أو تمسح بيانات التطبيق. نحتفظ بسجلات الاستفسارات والدعم بقدر ما يلزم لإنجاز الطلب وتسوية النزاعات والوفاء بالالتزامات النظامية، ثم تُتلف البيانات أو تُخفى هويتها ما لم يلزم الاحتفاظ بها نظاماً. قد تختلف مدد حفظ السجلات التقنية والنسخ الاحتياطية. يمكنك طلب بيان المدة التي تنطبق على بياناتك.",
  "يمكنك طلب العلم بالمعالجة أو الوصول إلى بياناتك أو الحصول على نسخة مقروءة أو تصحيحها أو إتلافها، وسحب موافقتك على المعالجة المستقبلية القائمة عليها. لحذف حسابك راسل aasaa.pvt.ltd@gmail.com بعنوان حذف حساب Go Saudi واذكر رقم الهاتف أو البريد المرتبط بالحساب. ولحذف استفسار بائع اذكر اسم المنشأة ووسيلة التواصل المستخدمة. قد نطلب التحقق من هويتك بقدر الحاجة. مسح التطبيق لا يحذف سجلات الخادم، ويمكن تقديم الطلب بعد إزالة التطبيق.",
  "سنوضح ما يلزم الاحتفاظ به وأسبابه. الأصل الرد على طلب ممارسة الحقوق خلال ٣٠ يوماً، مع إبلاغك بسبب أي تمديد جائز نظاماً. يمكنك تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي عبر منصة حوكمة البيانات الوطنية المعنية بحماية البيانات الشخصية. سنبيّن تاريخ التغييرات الجوهرية ونطلب موافقة جديدة متى لزم ذلك."
];

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")}>
          <Text style={styles.link}>رجوع · Back</Text>
        </Pressable>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} selectable style={[styles.text, index === 0 && styles.title]}>
            {paragraph}
          </Text>
        ))}
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(policyUrl).catch(() => Alert.alert("Go Saudi", policyUrl))}>
          <Text style={styles.link}>السياسة المنشورة · Public privacy policy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, gap: 16 },
  text: { color: "#183226", fontSize: 16, lineHeight: 25 },
  title: { fontSize: 22, fontWeight: "700", lineHeight: 30 },
  link: { color: "#075c3a", textDecorationLine: "underline", paddingVertical: 8 }
});
