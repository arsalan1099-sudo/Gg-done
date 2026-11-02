import React, {useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {SaudiProduct,CartLine,safeSaudiProduct,safeSaudiCart,changeSaudiCart,saudiCartTotal,sar} from "../../lib/saudiCart";

type Lang="ar"|"en";
type Props={lang:Lang;setLang:(l:Lang)=>void;origin:string|null;onSell:()=>void};
type Tab="home"|"cart"|"wishlist";
type Mode="demo"|"live";
const categoryIcons:Record<string,string>={Grocery:"🛒",Fashion:"👗",Food:"🍱",Electronics:"📱",Home:"🏠",Beauty:"🌸",Services:"🔧",Wholesale:"📦"};
const demos:SaudiProduct[]=[
 {id:"demo-food-1",title:"Saudi Arabic Coffee",description:"Illustrative product only · not for purchase",priceHalalas:2899,stock:12,category:"Food",city:"Jeddah",businessName:"Sample Shop · Demo"},
 {id:"demo-fashion-2",title:"Classic Abaya",description:"Illustrative fashion item · not for purchase",priceHalalas:14900,stock:8,category:"Fashion",city:"Riyadh",businessName:"Sample Shop · Demo"},
 {id:"demo-grocery-3",title:"Ajwa Dates",description:"Illustrative grocery item · not for purchase",priceHalalas:4400,stock:20,category:"Grocery",city:"Madinah",businessName:"Sample Shop · Demo"},
 {id:"demo-electronics-4",title:"Wireless Earbuds",description:"Illustrative electronics item · not for purchase",priceHalalas:9900,stock:7,category:"Electronics",city:"Jeddah",businessName:"Sample Shop · Demo"},
 {id:"demo-home-5",title:"Arabic Tea Set",description:"Illustrative home item · not for purchase",priceHalalas:6700,stock:5,category:"Home",city:"Makkah",businessName:"Sample Shop · Demo"},
 {id:"demo-beauty-6",title:"Oud Gift Set",description:"Illustrative gift item · not for purchase",priceHalalas:11900,stock:13,category:"Beauty",city:"Riyadh",businessName:"Sample Shop · Demo"},
 {id:"demo-wholesale-7",title:"Bulk Packaging Boxes",description:"Illustrative wholesale item · not for purchase",priceHalalas:6500,stock:30,category:"Wholesale",city:"Dammam",businessName:"Sample Shop · Demo"},
 {id:"demo-services-8",title:"Home Cleaning Inquiry",description:"Illustrative service listing · not bookable",priceHalalas:3500,stock:4,category:"Services",city:"Khobar",businessName:"Sample Shop · Demo"},
];
const cities=["All","Riyadh","Jeddah","Makkah","Madinah","Dammam","Khobar"];
const categories=["All","Grocery","Fashion","Food","Electronics","Home","Beauty","Services","Wholesale"];
const a={
 ar:{
  browse:"التسوق",cart:"السلة",wishlist:"المفضلة",sell:"للتجار",vendor:"لوحة البائع",
  heading:"اكتشف متاجر السعودية",sub:"تصفح المنتجات وأضفها للسلة قبل بدء البيع الرسمي",
  search:"ابحث عن منتج أو متجر",all:"الكل",featured:"المنتجات",empty:"لا توجد منتجات مطابقة",
  demo:"وضع العرض: جميع المنتجات تجريبية وليست للبيع",live:"الكتالوج متاح للعرض؛ الطلبات والدفع غير مفعلة",
  count:"منتجات",add:"+ أضف",detail:"التفاصيل",close:"إغلاق",stock:"الكمية المتوفرة",
  cartEmpty:"سلتك فارغة",cartHelp:"أضف منتجات لتجربة السلة",subtotal:"المجموع الفرعي",
  checkout:"الطلب والدفع",checkoutBlocked:"الطلب والدفع غير متاحين حتى تشغيل السوق والتحقق من الامتثال.",
  remove:"حذف",favEmpty:"لم تضف منتجات للمفضلة",saved:"تمت الإضافة",mode:"المرحلة التجريبية",
  reload:"تحديث",goSell:"سجل متجرك",qty:"الكمية",nonLive:"لا تتم أي عمليات شراء أو حجز من هذه الواجهة.",
  offline:"لم يتوفر كتالوج مباشر، نعرض منتجات توضيحية فقط",city:"المدينة",
 },
 en:{
  browse:"Shop",cart:"Cart",wishlist:"Wishlist",sell:"Sell",vendor:"Vendor panel",
  heading:"Discover Saudi stores",sub:"Explore products and prepare your cart before launch",
  search:"Search products or stores",all:"All",featured:"Products",empty:"No matching products",
  demo:"DEMO MODE: All products are examples and not for sale",live:"Catalog browsing available; orders and payments are not enabled",
  count:"products",add:"+ Add",detail:"Details",close:"Close",stock:"Stock",
  cartEmpty:"Your cart is empty",cartHelp:"Add products to try the shopping cart",subtotal:"Subtotal",
  checkout:"Checkout",checkoutBlocked:"Checkout and payments are unavailable until compliance review and marketplace activation.",
  remove:"Remove",favEmpty:"No saved items yet",saved:"Saved",mode:"PRELAUNCH",
  reload:"Refresh",goSell:"Register your store",qty:"Quantity",nonLive:"This screen does not place real orders, reserve inventory or collect payments.",
  offline:"No live catalog. Showing sample products only.",city:"City",
 }
};
export default function SaudiShop({lang,setLang,origin,onSell}:Props){
 const t=a[lang],right=lang==="ar"?"right" as const:"left" as const;
 const [tab,setTab]=useState<Tab>("home");
 const [mode,setMode]=useState<Mode>("demo");
 const [items,setItems]=useState<SaudiProduct[]>(demos);
 const [loading,setLoading]=useState(false);
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("All");
 const [city,setCity]=useState("All");
 const [cart,setCart]=useState<CartLine[]>([]);
 const [cartLoaded,setCartLoaded]=useState(false);
 const [favs,setFavs]=useState<string[]>([]);
 const [selected,setSelected]=useState<SaudiProduct|null>(null);
 const [networkError,setNetworkError]=useState(false);
 const loadCatalog=useCallback(async()=>{
  if(!origin){setMode("demo");setItems(demos);setNetworkError(false);return;}
  setLoading(true);
  try{
   const response=await fetch(origin+"/api/saudi/catalog",{headers:{Accept:"application/json"}});
   if(!response.ok)throw Error("Catalog unavailable");
   const result=await response.json() as {available?:boolean;products?:unknown[];country?:string;currency?:string;checkoutEnabled?:boolean};
   if(result.country!=="SA"||result.currency!=="SAR"||result.checkoutEnabled!==false)
     throw Error("Invalid catalog origin/market");
   if(result.available===true && Array.isArray(result.products)){
    setItems(result.products.filter(safeSaudiProduct));setMode("live");setNetworkError(false);
   }else{setItems(demos);setMode("demo");setNetworkError(false);}
  }catch{setMode("demo");setItems(demos);setNetworkError(true);}
  finally{setLoading(false);}
 },[origin]);
 useEffect(()=>{loadCatalog();},[loadCatalog]);
 const key=mode==="live"?"go-saudi-live-cart-v1":"go-saudi-demo-cart-v1";
 useEffect(()=>{
  let active=true;
  setCartLoaded(false);
  AsyncStorage.getItem(key).then(raw=>{
   let stored:unknown=[];try{stored=JSON.parse(raw||"[]")}catch{}
   if(active){setCart(safeSaudiCart(stored,items));setCartLoaded(true);}
  }).catch(()=>{if(active){setCart([]);setCartLoaded(true);}});
  return()=>{active=false};
 // Demo and real carts are stored separately. Never send cart data to the server.
 },[key,mode]);
 useEffect(()=>{
  if(cartLoaded)AsyncStorage.setItem(key,JSON.stringify(cart)).catch(()=>{});
 },[key,cart,cartLoaded]);
 const favorites=useMemo(()=>items.filter(p=>favs.includes(p.id)),[items,favs]);
 const shown=useMemo(()=>items.filter(p=>{
  const q=search.trim().toLocaleLowerCase("en");
  return (category==="All"||p.category===category)&&(city==="All"||p.city===city)&&
   (!q||[p.title,p.businessName,p.description].some(x=>x.toLocaleLowerCase("en").includes(q)));
 }),[items,search,category,city]);
 const bag=useMemo(()=>cart.map(c=>({product:items.find(p=>p.id===c.id),quantity:c.quantity}))
   .filter((x):x is {product:SaudiProduct,quantity:number}=>!!x.product),[cart,items]);
 const total=saudiCartTotal(cart,items);
 const count=cart.reduce((s,v)=>s+v.quantity,0);
 const modify=(p:SaudiProduct,d:number)=>setCart(cur=>changeSaudiCart(cur,p,d));
 const wish=(p:SaudiProduct)=>setFavs(cur=>cur.includes(p.id)?cur.filter(x=>x!==p.id):[...cur,p.id]);
 const msg=()=>Alert.alert("Go Saudi",t.checkoutBlocked);
 const openVendor=()=>{if(origin)Linking.openURL(origin+"/vendor").catch(()=>Alert.alert("Go Saudi","Vendor panel unavailable"));else Alert.alert("Go Saudi",t.offline)};
 const pill=(value:string,onPress:()=>void,active=false)=>(
  <Pressable key={value} onPress={onPress} style={[styles.pill,active&&styles.pillActive]}>
   <Text style={[styles.pillText,active&&styles.pillTextActive]}>{value==="All"?t.all:value}</Text>
  </Pressable>);
 const renderProduct=(p:SaudiProduct)=>(
  <View key={p.id} style={styles.product}>
   <Pressable onPress={()=>setSelected(p)} accessibilityRole="button" style={styles.productImage}>
    <Text style={styles.productEmoji}>{categoryIcons[p.category]||"🛍️"}</Text>
    <Text style={styles.previewTag}>{mode==="demo"?"DEMO":p.city}</Text>
   </Pressable>
   <View style={styles.productInfo}>
    <Text numberOfLines={1} style={[styles.productTitle,{textAlign:right}]}>{p.title}</Text>
    <Text numberOfLines={1} style={[styles.muted,{textAlign:right}]}>{p.businessName}</Text>
    <Text style={[styles.price,{textAlign:right}]}>{sar(p.priceHalalas)}</Text>
    <View style={styles.cardActions}>
     <Pressable onPress={()=>modify(p,1)} style={styles.add} accessibilityRole="button">
      <Text style={styles.addText}>{t.add}</Text>
     </Pressable>
     <Pressable onPress={()=>wish(p)} style={styles.favButton} accessibilityRole="button">
      <Text style={{fontSize:19,color:"#0c7e54"}}>{favs.includes(p.id)?"♥":"♡"}</Text>
     </Pressable>
    </View>
   </View>
  </View>
 );
 return (
  <View style={styles.root}>
   <View style={styles.top}>
    <View style={styles.topRow}>
     <Text style={styles.logo}>✦ GO SAUDI</Text>
     <Pressable style={styles.language} onPress={()=>setLang(lang==="ar"?"en":"ar")}>
      <Text style={styles.languageText}>{lang==="ar"?"English":"العربية"}</Text>
     </Pressable>
    </View>
    <Text style={styles.topKicker}>🇸🇦  {t.mode}  •  SAR</Text>
    <Text style={[styles.topHeading,{textAlign:right}]}>{t.heading}</Text>
    <Text style={[styles.topSub,{textAlign:right}]}>{t.sub}</Text>
   </View>
   <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={[styles.banner,mode==="live"&&styles.liveBanner]}>
     <Text style={[styles.bannerText,{textAlign:right}]}>{mode==="demo"?t.demo:t.live}</Text>
     <Text style={[styles.bannerSmall,{textAlign:right}]}>{t.nonLive}</Text>
    </View>
    {networkError&&<Text style={styles.error}>{t.offline}</Text>}
    {tab==="home"&&<>
     <TextInput value={search} onChangeText={setSearch} placeholder={"🔎  "+t.search} placeholderTextColor="#718b79"
      style={[styles.search,{textAlign:right}]} />
     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}
      contentContainerStyle={{gap:7,paddingBottom:4}}>
      {categories.map(c=>pill(c,()=>setCategory(c),category===c))}
     </ScrollView>
     <Text style={[styles.filterTitle,{textAlign:right}]}>{t.city}</Text>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}
      contentContainerStyle={{gap:7,paddingBottom:4}}>
      {cities.map(c=>pill(c,()=>setCity(c),city===c))}
     </ScrollView>
     <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t.featured} ({shown.length})</Text>
      <Pressable onPress={loadCatalog} disabled={loading}><Text style={styles.link}>{loading?"…":t.reload}</Text></Pressable>
     </View>
     {loading&&<ActivityIndicator color="#047344"/>}
     <View style={styles.products}>{shown.map(renderProduct)}</View>
     {shown.length===0&&<Text style={styles.empty}>{t.empty}</Text>}
    </>}
    {tab==="wishlist"&&<>
      <Text style={styles.sectionTitle}>{t.wishlist} ({favorites.length})</Text>
      <View style={styles.products}>{favorites.map(renderProduct)}</View>
      {!favorites.length&&<Text style={styles.empty}>{t.favEmpty}</Text>}
    </>}
    {tab==="cart"&&<>
      <Text style={styles.sectionTitle}>{t.cart} ({count})</Text>
      {!bag.length?<View style={styles.cartEmpty}><Text style={styles.bigEmoji}>🛒</Text>
       <Text style={styles.sectionTitle}>{t.cartEmpty}</Text><Text style={styles.muted}>{t.cartHelp}</Text></View>:
       bag.map(({product:p,quantity})=><View key={p.id} style={styles.cartLine}>
        <Text style={styles.cartEmoji}>{categoryIcons[p.category]||"🛍️"}</Text>
        <View style={{flex:1}}><Text style={styles.productTitle}>{p.title}</Text>
         <Text style={styles.price}>{sar(p.priceHalalas)}</Text></View>
        <View style={styles.qtyRow}>
         <Pressable style={styles.qtyBtn} onPress={()=>modify(p,-1)}><Text style={styles.qtyText}>−</Text></Pressable>
         <Text style={styles.qtyValue}>{quantity}</Text>
         <Pressable style={styles.qtyBtn} onPress={()=>modify(p,1)}><Text style={styles.qtyText}>+</Text></Pressable>
        </View>
       </View>)}
      <View style={styles.cartTotal}><Text style={styles.sectionTitle}>{t.subtotal}</Text>
       <Text style={styles.total}>{sar(total)}</Text></View>
      <Pressable onPress={msg} style={styles.disabledCheckout}><Text style={styles.checkoutLabel}>{t.checkout} · {t.mode}</Text></Pressable>
      <Text style={styles.disclaimer}>{t.checkoutBlocked}</Text>
    </>}
    <View style={styles.sellerCard}>
      <Text style={styles.sellerTitle}>🏬 {t.sell}</Text>
      <Pressable onPress={onSell} style={styles.sellerButton}><Text style={styles.sellerButtonText}>{t.goSell}</Text></Pressable>
      <Pressable onPress={openVendor} style={styles.vendorLink}><Text style={styles.link}>{t.vendor} ↗</Text></Pressable>
    </View>
   </ScrollView>
   <View style={styles.bottom}>
    {(["home","wishlist","cart"] as const).map((v,i)=><Pressable key={v} onPress={()=>{setTab(v);setSelected(null)}} style={[styles.bottomTab,tab===v&&styles.tabActive]}>
      <Text style={styles.tabIcon}>{["⌂","♡","🛒"][i]}</Text>
      <Text style={[styles.bottomText,tab===v&&styles.bottomActive]}>{v==="home"?t.browse:v==="cart"?t.cart:t.wishlist}{v==="cart"&&count?" ("+count+")":""}</Text>
    </Pressable>)}
   </View>
   {selected&&<View style={styles.modalShade}>
    <View style={styles.modal}>
     <Pressable onPress={()=>setSelected(null)} style={styles.close}><Text style={styles.link}>{t.close} ✕</Text></Pressable>
     <Text style={styles.bigEmoji}>{categoryIcons[selected.category]||"🛍️"}</Text>
     <Text style={styles.sectionTitle}>{selected.title}</Text>
     <Text style={styles.muted}>{selected.businessName} • {selected.city}</Text>
     <Text style={styles.detail}>{selected.description}</Text>
     <Text style={styles.price}>{sar(selected.priceHalalas)}</Text>
     <Text style={styles.muted}>{t.stock}: {selected.stock}</Text>
     <Pressable onPress={()=>{modify(selected,1);setSelected(null);setTab("cart")}} style={styles.modalAdd}><Text style={styles.addText}>{t.add}</Text></Pressable>
     {mode==="demo"&&<Text style={styles.disclaimer}>{t.demo}</Text>}
    </View>
   </View>}
  </View>
 );
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:"#f4f8f4"},
 top:{backgroundColor:"#064735",paddingHorizontal:20,paddingTop:18,paddingBottom:23},
 topRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 logo:{color:"white",fontSize:22,fontWeight:"900",letterSpacing:1},
 language:{borderWidth:1,borderColor:"#ffffff55",borderRadius:12,paddingHorizontal:12,paddingVertical:8},
 languageText:{color:"white",fontWeight:"700"},
 topKicker:{color:"#e9c88b",fontSize:12,fontWeight:"800",marginTop:22},
 topHeading:{fontWeight:"900",color:"white",fontSize:27,marginTop:9},
 topSub:{color:"#d4ecdf",fontSize:13,marginTop:8},
 content:{paddingHorizontal:15,paddingTop:13,paddingBottom:32},
 banner:{backgroundColor:"#fff5db",borderColor:"#eddb9d",borderWidth:1,borderRadius:13,padding:13,marginBottom:12},
 liveBanner:{backgroundColor:"#e7f4ed",borderColor:"#abd4ba"},
 bannerText:{color:"#705429",fontWeight:"900",fontSize:13},
 bannerSmall:{color:"#786c57",fontSize:11,marginTop:5},
 error:{color:"#b43f33",fontSize:12,marginBottom:12},
 search:{backgroundColor:"#fff",borderRadius:14,borderColor:"#dce8df",borderWidth:1,padding:14,fontSize:15,color:"#173d2e",marginBottom:15},
 chips:{marginBottom:13},
 pill:{backgroundColor:"#fff",borderWidth:1,borderColor:"#dce8df",borderRadius:99,paddingHorizontal:12,paddingVertical:9},
 pillActive:{backgroundColor:"#086944",borderColor:"#086944"},
 pillText:{fontSize:12,color:"#415d4b",fontWeight:"700"},
 pillTextActive:{color:"white"},
 filterTitle:{fontWeight:"800",fontSize:13,color:"#375747",marginBottom:9},
 sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:11},
 sectionTitle:{fontSize:18,fontWeight:"900",color:"#183e2e",marginBottom:10},
 link:{color:"#0c7952",fontSize:13,fontWeight:"800"},
 products:{flexDirection:"row",flexWrap:"wrap",gap:11,justifyContent:"space-between"},
 product:{width:"48%",backgroundColor:"#fff",borderRadius:17,overflow:"hidden",borderWidth:1,borderColor:"#e0ebe4",marginBottom:10},
 productImage:{height:120,backgroundColor:"#edf5ef",alignItems:"center",justifyContent:"center"},
 productEmoji:{fontSize:45},
 previewTag:{position:"absolute",bottom:8,right:8,fontSize:10,fontWeight:"900",color:"#28734c",backgroundColor:"#fff",borderRadius:7,paddingHorizontal:6,paddingVertical:2},
 productInfo:{padding:11},
 productTitle:{fontSize:14,fontWeight:"800",color:"#194333"},
 muted:{fontSize:11,color:"#718576",marginTop:5},
 price:{fontWeight:"900",fontSize:15,color:"#08734c",marginTop:10},
 cardActions:{flexDirection:"row",alignItems:"center",gap:7,marginTop:13},
 add:{backgroundColor:"#06754f",paddingVertical:10,borderRadius:9,flex:1,alignItems:"center"},
 addText:{color:"white",fontWeight:"900",fontSize:12},
 favButton:{width:35,height:36,alignItems:"center",justifyContent:"center",borderRadius:10,backgroundColor:"#eff7f1"},
 empty:{textAlign:"center",padding:30,color:"#738477"},
 cartEmpty:{backgroundColor:"#fff",padding:30,borderRadius:16,alignItems:"center",marginTop:15},
 bigEmoji:{fontSize:52,textAlign:"center",marginVertical:14},
 cartLine:{flexDirection:"row",alignItems:"center",gap:12,padding:13,backgroundColor:"#fff",borderRadius:13,marginBottom:11},
 cartEmoji:{fontSize:30},qtyRow:{flexDirection:"row",alignItems:"center",gap:9},
 qtyBtn:{width:32,height:32,backgroundColor:"#e6f3e9",borderRadius:8,alignItems:"center",justifyContent:"center"},
 qtyText:{fontSize:20,color:"#146f49",fontWeight:"900"},qtyValue:{fontSize:13,fontWeight:"900"},
 cartTotal:{marginTop:18,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 total:{fontSize:19,fontWeight:"900",color:"#06744c"},
 disabledCheckout:{backgroundColor:"#b7d5c6",padding:16,alignItems:"center",borderRadius:13,marginTop:15},
 checkoutLabel:{color:"#285d46",fontWeight:"900"},
 disclaimer:{color:"#806b4d",fontSize:11,marginTop:10,lineHeight:18},
 sellerCard:{marginTop:27,borderRadius:17,backgroundColor:"#fff",padding:20,borderWidth:1,borderColor:"#e2eee6"},
 sellerTitle:{fontSize:17,fontWeight:"900",color:"#174533",marginBottom:13},
 sellerButton:{borderRadius:10,backgroundColor:"#0a7350",padding:13,alignItems:"center"},
 sellerButtonText:{color:"white",fontWeight:"850"},
 vendorLink:{alignSelf:"center",padding:12},
 bottom:{backgroundColor:"#fff",borderTopWidth:1,borderTopColor:"#dce9df",flexDirection:"row",justifyContent:"space-evenly",paddingVertical:7},
 bottomTab:{flex:1,alignItems:"center",paddingVertical:6,borderRadius:11},
 tabActive:{backgroundColor:"#e7f4ec"},tabIcon:{fontSize:21,color:"#166a49"},
 bottomText:{fontSize:11,color:"#688574",fontWeight:"700",marginTop:3},
 bottomActive:{color:"#077349",fontWeight:"900"},
 modalShade:{...StyleSheet.absoluteFillObject,backgroundColor:"#10261bc7",justifyContent:"center",padding:18},
 modal:{borderRadius:23,backgroundColor:"#fff",padding:23},
 close:{alignSelf:"flex-end",padding:7},detail:{fontSize:13,color:"#536c5c",marginVertical:12},
 modalAdd:{marginTop:18,backgroundColor:"#0a7650",padding:15,borderRadius:13,alignItems:"center"}
});
