import React,{useCallback,useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {Ionicons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg,{Path,Rect,Circle,Line} from "react-native-svg";
import SaudiCategoryExplorer from "./SaudiCategoryExplorer";
import {saudiMainCategories,saudiSubcategories,matchesSaudiCategory,SaudiGroupId} from "../../lib/saudiCategories";
import {SaudiProduct,CartLine,safeSaudiProduct,safeSaudiCart,changeSaudiCart,saudiCartTotal,sar} from "../../lib/saudiCart";

type Lang="ar"|"en";
type Tab="home"|"categories"|"wishlist"|"cart";
type Props={lang:Lang;setLang:(lang:Lang)=>void;origin:string|null;onSell:()=>void};
const GREEN="#063F32",DARK="#042F28",GOLD="#D8AC59",CREAM="#FBF7EE",TEXT="#103D31";
const CITY=["All","Riyadh","Jeddah","Makkah","Madinah","Dammam","Khobar","Taif","Tabuk","Abha","Jazan"];
const icons:Record<string,string>={Grocery:"🛒",Fashion:"👗",Food:"🍽️",Electronics:"📱",Home:"🏡",Beauty:"✨",Services:"🛠️",Wholesale:"📦"};
const messages={
 en:{
  hero:"Your city. Your stores.",heroAccent:"Together.",sub:"Discover Saudi businesses, beautifully connected.",
  categories:"Explore categories",viewAll:"View all",search:"Search products and stores",city:"Select your city",
  featured:"Featured products",verified:"Verified listings",empty:"New stores are joining Go Saudi",
  emptySub:"Explore our categories while merchants complete their verification.",
  coming:"Explore categories",merchant:"Own a store?",merchantSub:"Join Go Saudi and grow your business.",
  register:"Register your store",browse:"Shop",allCategories:"Categories",wishlist:"Saved",cart:"Cart",
  savedEmpty:"Your wishlist is empty",savedSub:"Tap the heart on a product to save it here.",
  cartEmpty:"Your bag is empty",cartSub:"Discover products from verified Saudi shops.",
  subtotal:"Subtotal",disabled:"Checkout unavailable until verified payment launch",
  add:"Add to bag",details:"Details",stock:"Available",close:"Close",reload:"Refresh",
  unavailable:"Real product listings are not available yet",products:"Products",clear:"Clear",
  all:"All",language:"العربية",comingBadge:"COMING SOON",note:"Orders and payments open after merchant verification.",
  currency:"SAR",noMatches:"No products found for this filter",categoryFilter:"Selected category",
 },
 ar:{
  hero:"مدينتك ومتاجرك",heroAccent:"في مكان واحد",sub:"اكتشف متاجر السعودية بتجربة تسوق مميزة.",
  categories:"تسوق حسب الفئة",viewAll:"عرض الكل",search:"ابحث عن منتج أو متجر",city:"اختر مدينتك",
  featured:"منتجات المتاجر",verified:"منتجات موثقة",empty:"متاجر جديدة تنضم إلى جو سعودي",
  emptySub:"اكتشف الفئات بينما يكمل التجار إجراءات التحقق.",
  coming:"استكشف الفئات",merchant:"هل لديك متجر؟",merchantSub:"انضم إلى جو سعودي ووسّع نشاطك.",
  register:"سجّل متجرك",browse:"التسوق",allCategories:"الفئات",wishlist:"المفضلة",cart:"السلة",
  savedEmpty:"لا توجد منتجات محفوظة",savedSub:"اضغط على القلب لحفظ المنتج هنا.",
  cartEmpty:"سلتك فارغة",cartSub:"اكتشف منتجات متاجر سعودية موثقة.",
  subtotal:"الإجمالي",disabled:"الشراء والدفع غير متاحين حتى اعتماد التشغيل",
  add:"أضف للسلة",details:"التفاصيل",stock:"المتوفر",close:"إغلاق",reload:"تحديث",
  unavailable:"لا تتوفر منتجات موثقة حالياً",products:"منتجات",clear:"إزالة",
  all:"الكل",language:"English",comingBadge:"قريباً",note:"تُفعّل الطلبات والمدفوعات بعد اعتماد التجار.",
  currency:"ر.س",noMatches:"لا توجد منتجات مطابقة",categoryFilter:"الفئة المختارة",
 }
};

function Skyline(){
 return <Svg height={118} width="100%" viewBox="0 0 380 118" preserveAspectRatio="xMidYMax slice">
  <Path d="M0 118V86h22V64h16v54h9V46h18v72h11V74h26v44h13V38h15v80h12V51h13v67h20V89h12v29h15V26h23v92h17V70h13v48h14V50h20v68h12V82h17v36h12V62h14v56h17V93h21v25z" fill="#D9B66F" opacity=".28"/>
  <Path d="M155 118V45h37v73M164 45V17h20v28M169 22h10M177 27v18M184 27v18M177 17v-9" stroke="#F4D38A" strokeWidth="2" fill="none"/>
  <Path d="M171 17Q177 35 184 17" fill="none" stroke="#F4D38A" strokeWidth="2"/>
  <Path d="M0 107Q75 93 141 107T289 107T380 102" fill="none" stroke="#E8C17B" strokeWidth="2" opacity=".9"/>
  {[12,57,121,161,175,230,271,326,350].map((x,i)=><Line key={i} x1={x} x2={x} y1={87+(i%3)*7} y2={91+(i%3)*7} stroke="#F4D38A" strokeWidth="2" />)}
  <Circle cx="341" cy="36" r="28" fill="#D8AC59" opacity=".12"/>
 </Svg>;
}
const icon=(name:React.ComponentProps<typeof Ionicons>["name"],color=GREEN,size=20)=>
 <Ionicons name={name} size={size} color={color}/>;
export default function SaudiPremiumShop({lang,setLang,origin,onSell}:Props){
 const insets=useSafeAreaInsets(),t=messages[lang],ar=lang==="ar";
 const [tab,setTab]=useState<Tab>("home");
 const [products,setProducts]=useState<SaudiProduct[]>([]);
 const [live,setLive]=useState(false);
 const [loading,setLoading]=useState(false);
 const [city,setCity]=useState("All");
 const [query,setQuery]=useState("");
 const [group,setGroup]=useState<SaudiGroupId>("b2c");
 const [activeGroup,setActiveGroup]=useState<SaudiGroupId|null>(null);
 const [subcategory,setSubcategory]=useState<string|null>(null);
 const [subcategorySearch,setSubcategorySearch]=useState("");
 const [savedIds,setSavedIds]=useState<string[]>([]);
 const [cart,setCart]=useState<CartLine[]>([]);
 const [cartLoaded,setCartLoaded]=useState(false);
 const [selected,setSelected]=useState<SaudiProduct|null>(null);
 const loadCatalog=useCallback(async()=>{
  if(!origin){setProducts([]);setLive(false);return;}
  setLoading(true);
  try{
   const response=await fetch(origin+"/api/saudi/catalog",{headers:{Accept:"application/json"}});
   if(!response.ok)throw new Error("Catalog unavailable");
   const json=await response.json() as {country?:string;currency?:string;available?:boolean;products?:unknown[];checkoutEnabled?:boolean};
   if(json.country==="SA"&&json.currency==="SAR"&&json.checkoutEnabled===false&&json.available===true&&Array.isArray(json.products)){
    setProducts(json.products.filter(safeSaudiProduct));setLive(true);
   }else{setProducts([]);setLive(false);}
  }catch{setProducts([]);setLive(false)}
  finally{setLoading(false)}
 },[origin]);
 useEffect(()=>{loadCatalog()},[loadCatalog]);
 useEffect(()=>{
  let alive=true;
  Promise.all([AsyncStorage.getItem("go-saudi-premium-wishlist"),AsyncStorage.getItem("go-saudi-premium-cart")])
   .then(([wishlist,basket])=>{
    if(!alive)return;
    let list:unknown=[],saved:unknown=[];
    try{list=JSON.parse(basket||"[]");saved=JSON.parse(wishlist||"[]")}catch{}
    setSavedIds(Array.isArray(saved)?saved.filter((x):x is string=>typeof x==="string").slice(0,200):[]);
    setCart(safeSaudiCart(list,products));setCartLoaded(true);
   }).catch(()=>{if(alive)setCartLoaded(true)});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(!cartLoaded)return;
  setCart(old=>safeSaudiCart(old,products));
 },[products,cartLoaded]);
 useEffect(()=>{if(cartLoaded)AsyncStorage.setItem("go-saudi-premium-cart",JSON.stringify(cart)).catch(()=>{})},[cart,cartLoaded]);
 useEffect(()=>{if(cartLoaded)AsyncStorage.setItem("go-saudi-premium-wishlist",JSON.stringify(savedIds)).catch(()=>{})},[savedIds,cartLoaded]);
 const shown=useMemo(()=>products.filter(p=>{
  const term=query.trim().toLowerCase();
  return (city==="All"||p.city===city)&&matchesSaudiCategory(p,activeGroup,subcategory)&&
   (!term||[p.title,p.businessName,p.description].some(v=>v.toLowerCase().includes(term)));
 }),[products,query,city,activeGroup,subcategory]);
 const saved=products.filter(p=>savedIds.includes(p.id));
 const lines=cart.map(c=>({p:products.find(p=>p.id===c.id),n:c.quantity}))
  .filter((x):x is {p:SaudiProduct;n:number}=>!!x.p);
 const qty=cart.reduce((n,x)=>n+x.quantity,0);
 const wishlist=(id:string)=>setSavedIds(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const edit=(p:SaudiProduct,amount:number)=>setCart(old=>changeSaudiCart(old,p,amount));
 const openGroup=(id:SaudiGroupId)=>{setGroup(id);setSubcategorySearch("");setTab("categories")};
 const applyGroup=(id:SaudiGroupId,sub:string|null)=>{setActiveGroup(id);setSubcategory(sub);setTab("home");setQuery("")};
 const productCard=(p:SaudiProduct)=>(
  <View key={p.id} style={s.productCard}>
   <Pressable onPress={()=>setSelected(p)} style={s.productVisual} accessibilityRole="button">
    <LinearGradient colors={["#FFF8ED","#EFE7D7"]} style={s.productGradient}>
     <Text style={s.productEmoji}>{icons[p.category]||"🛍️"}</Text>
    </LinearGradient>
    <View style={s.verifiedTag}><Text style={s.verifiedText}>{p.city}</Text></View>
   </Pressable>
   <Pressable accessibilityRole="button" onPress={()=>wishlist(p.id)} style={s.heart}>
    {icon(savedIds.includes(p.id)?"heart":"heart-outline",savedIds.includes(p.id)?"#AE7953":GREEN,19)}
   </Pressable>
   <View style={s.productBody}>
    <Text style={s.productTitle} numberOfLines={2}>{p.title}</Text>
    <Text style={s.productMerchant} numberOfLines={1}>{p.businessName}</Text>
    <Text style={s.productPrice}>{sar(p.priceHalalas)}</Text>
    <Pressable onPress={()=>edit(p,1)} style={s.addButton} accessibilityRole="button">
     {icon("add",CREAM,18)}<Text style={s.addText}>{t.add}</Text>
    </Pressable>
   </View>
  </View>
 );
 const emptyCard=(section:"products"|"wishlist"|"cart")=><View style={s.emptyCard}>
   <View style={s.emptyIcon}>{icon(section==="cart"?"bag-outline":section==="wishlist"?"heart-outline":"storefront-outline",GOLD,32)}</View>
   <Text style={[s.emptyTitle,{textAlign:"center"}]}>{section==="cart"?t.cartEmpty:section==="wishlist"?t.savedEmpty:t.empty}</Text>
   <Text style={[s.emptySub,{textAlign:"center"}]}>{section==="cart"?t.cartSub:section==="wishlist"?t.savedSub:t.emptySub}</Text>
   <Pressable accessibilityRole="button" onPress={()=>section==="products"?openGroup("b2c"):setTab("home")} style={s.emptyButton}>
    <Text style={s.emptyButtonText}>{section==="products"?t.coming:t.browse}</Text>
    {icon("arrow-forward",CREAM,16)}
   </Pressable>
  </View>;
 const nav=(value:Tab,title:string,glyph:React.ComponentProps<typeof Ionicons>["name"])=>
  <Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:tab===value}}
   onPress={()=>{setTab(value);setSelected(null)}} style={[s.navTab,tab===value&&s.navActive]}>
   {icon(glyph,tab===value?GOLD:"#668477",23)}
   <Text numberOfLines={1} style={[s.navText,tab===value&&s.navSelected]}>{title}{value==="cart"&&qty?String(" ("+qty+")"):""}</Text>
  </Pressable>;
 return <View style={s.screen}>
  <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollContent}>
   <LinearGradient colors={["#062F28","#075542","#04382D"]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
    <View style={s.brandRow}>
     <View style={s.brandLeft}>
      <View style={s.brandMark}><Text style={s.star}>✦</Text></View>
      <Text style={s.brand}>GO SAUDI</Text>
     </View>
     <Pressable accessibilityRole="button" onPress={()=>setLang(ar?"en":"ar")} style={s.langBtn}>
      {icon("globe-outline",GOLD,17)}
      <Text style={s.langText}>{t.language}</Text>
     </Pressable>
    </View>
    <View style={s.eyebrow}><Text style={s.flag}>🇸🇦</Text><Text style={s.eyebrowText}>SAUDI ARABIA  ·  SAR</Text></View>
    <Text style={[s.heroTitle,{textAlign:ar?"right":"left"}]}>{t.hero}</Text>
    <Text style={[s.heroAccent,{textAlign:ar?"right":"left"}]}>{t.heroAccent}</Text>
    <Text style={[s.heroSub,{textAlign:ar?"right":"left"}]}>{t.sub}</Text>
    <View style={s.skyline}><Skyline/></View>
    <View style={s.heroGoldLine}/>
   </LinearGradient>
   <View style={s.content}>
    {tab==="home"&&<>
      <View style={s.searchBox}>
       {icon("search-outline",GREEN,23)}
       <TextInput style={[s.searchInput,{textAlign:ar?"right":"left"}]}
        value={query} onChangeText={setQuery} placeholder={t.search}
        placeholderTextColor="#8A968E"/>
       {query? <Pressable onPress={()=>setQuery("")}>{icon("close-circle-outline","#9DAEA3",22)}</Pressable>:null}
      </View>
      <View style={s.titleRow}>
       <Text style={s.sectionTitle}>{t.categories}</Text>
       <Pressable accessibilityRole="button" onPress={()=>setTab("categories")} style={s.viewAll}>
        <Text style={s.viewText}>{t.viewAll}</Text>{icon("chevron-forward",GOLD,16)}
       </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
       {saudiMainCategories.map((g,i)=><Pressable key={g.id} onPress={()=>openGroup(g.id)}
         accessibilityRole="button" style={[s.categoryCard,i===1&&s.categoryFeatured]}>
         <LinearGradient colors={i===1?["#0B6548","#04362F"]:["#FFFEFB","#F8F2E8"]}
          style={s.categoryFill}>
          <View style={[s.catSymbol,{backgroundColor:i===1?"#1A765C":"#F3EBDA"}]}>
           <Text style={s.catEmoji}>{g.emoji}</Text>
          </View>
          <Text style={[s.catName,i===1&&s.catActive]}>{g.en}</Text>
          <Text style={[s.catSub,i===1&&s.catActive]} numberOfLines={1}>{ar?g.ar:g.subtitleEn}</Text>
          <View style={[s.catArrow,{backgroundColor:i===1?GOLD:"#E8D7B3"}]}>
           {icon("arrow-forward",i===1?GREEN:DARK,12)}
          </View>
         </LinearGradient>
        </Pressable>)}
      </ScrollView>
      <View style={s.titleRow}><Text style={s.sectionTitle}>{t.city}</Text>{icon("location-outline",GOLD,20)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cityRow}>
       {CITY.map(c=><Pressable key={c} accessibilityRole="button"
        onPress={()=>setCity(c)} style={[s.cityChip,city===c&&s.citySelected]}>
        <Text style={[s.cityText,city===c&&s.cityTextSelected]}>{c==="All"?t.all:c}</Text>
       </Pressable>)}
      </ScrollView>
      {activeGroup&&<Pressable accessibilityRole="button" style={s.filterBox}
       onPress={()=>{setActiveGroup(null);setSubcategory(null)}}>
        <Text style={s.filterText}>{t.categoryFilter}: {subcategory?
          (ar?saudiSubcategories.find(x=>x.id===subcategory)?.ar:saudiSubcategories.find(x=>x.id===subcategory)?.en):
          (ar?saudiMainCategories.find(x=>x.id===activeGroup)?.ar:saudiMainCategories.find(x=>x.id===activeGroup)?.en)}</Text>
        {icon("close",GREEN,18)}
      </Pressable>}
      <View style={s.titleRow}>
       <View><Text style={s.sectionTitle}>{t.featured}</Text>
        <Text style={s.minor}>{live?t.verified:t.note}</Text></View>
       <Pressable accessibilityRole="button" onPress={loadCatalog} disabled={loading} style={s.refresh}>
        {icon("refresh-outline",GREEN,17)}<Text style={s.viewText}>{t.reload}</Text>
       </Pressable>
      </View>
      {loading&&<ActivityIndicator color={GOLD}/>}
      {shown.length>0?<View style={s.productGrid}>{shown.map(productCard)}</View>:
       live? <View style={s.emptyCard}><Text style={s.emptyTitle}>{t.noMatches}</Text></View>:
       emptyCard("products")}
      <LinearGradient colors={["#0B5843","#043B30"]} style={s.merchantCard}>
       <Text style={s.merchantIcon}>✦</Text>
       <View style={s.merchantInfo}>
        <Text style={s.merchantTitle}>{t.merchant}</Text>
        <Text style={s.merchantSub}>{t.merchantSub}</Text>
       </View>
       <Pressable accessibilityRole="button" onPress={onSell} style={s.merchantArrow}>{icon("arrow-forward",DARK,19)}</Pressable>
      </LinearGradient>
    </>}
    {tab==="categories"&&<SaudiCategoryExplorer lang={lang} selectedGroup={group}
     onGroupChange={setGroup} onSubcategory={id=>applyGroup(group,id)}
     onBrowseGroup={id=>applyGroup(id,null)}
     search={subcategorySearch} onSearchChange={setSubcategorySearch}/>}
    {tab==="wishlist"&&<><Text style={s.pageTitle}>{t.wishlist}</Text>
     {saved.length?<View style={s.productGrid}>{saved.map(productCard)}</View>:emptyCard("wishlist")}</>}
    {tab==="cart"&&<><Text style={s.pageTitle}>{t.cart}</Text>
     {lines.length?<>
      {lines.map(({p,n})=><View key={p.id} style={s.cartLine}>
       <Text style={s.cartEmoji}>{icons[p.category]||"🛍️"}</Text>
       <View style={{flex:1}}><Text style={s.productTitle}>{p.title}</Text><Text style={s.productPrice}>{sar(p.priceHalalas)}</Text></View>
       <View style={s.quantity}>
        <Pressable accessibilityRole="button" onPress={()=>edit(p,-1)}>{icon("remove-circle-outline",GREEN,25)}</Pressable>
        <Text style={s.qtyText}>{n}</Text>
        <Pressable accessibilityRole="button" onPress={()=>edit(p,1)}>{icon("add-circle-outline",GREEN,25)}</Pressable>
       </View>
      </View>)}
      <View style={s.totalRow}><Text style={s.sectionTitle}>{t.subtotal}</Text>
       <Text style={s.productPrice}>{sar(saudiCartTotal(cart,products))}</Text></View>
      <View style={s.checkoutLocked}>{icon("lock-closed-outline","#897147",17)}
       <Text style={s.checkoutLockedText}>{t.disabled}</Text></View>
     </>:emptyCard("cart")}</>}
   </View>
  </ScrollView>
  <View style={[s.bottom,{paddingBottom:Math.max(insets.bottom,9)}]}>
   {nav("home",t.browse,"home-outline")}
   {nav("categories",t.allCategories,"grid-outline")}
   {nav("wishlist",t.wishlist,"heart-outline")}
   {nav("cart",t.cart,"bag-handle-outline")}
  </View>
  {selected&&<View style={s.modalBg}>
    <View style={s.modal}>
     <Pressable onPress={()=>setSelected(null)} style={s.modalClose}>{icon("close",GREEN,22)}</Pressable>
     <Text style={s.modalEmoji}>{icons[selected.category]||"🛍️"}</Text>
     <Text style={s.pageTitle}>{selected.title}</Text>
     <Text style={s.minor}>{selected.businessName} · {selected.city}</Text>
     <Text style={s.productPrice}>{sar(selected.priceHalalas)}</Text>
     <Text style={s.minor}>{t.stock}: {selected.stock}</Text>
     <Text style={s.description}>{selected.description}</Text>
     <Pressable style={s.modalAdd} onPress={()=>{edit(selected,1);setSelected(null);setTab("cart")}}>
      {icon("add",CREAM,17)}<Text style={s.addText}>{t.add}</Text>
     </Pressable>
    </View>
   </View>}
 </View>;
}
const shadows={shadowColor:"#14281B",shadowOpacity:.12,shadowRadius:15,shadowOffset:{width:0,height:7},elevation:3};
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:CREAM},scroll:{flex:1},scrollContent:{paddingBottom:20},
 hero:{paddingTop:18,paddingHorizontal:20,minHeight:280,overflow:"hidden"},
 brandRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 brandLeft:{flexDirection:"row",alignItems:"center",gap:8},
 brandMark:{width:39,height:39,alignItems:"center",justifyContent:"center",borderRadius:12,borderWidth:1,borderColor:"#D6AC60"},
 star:{fontSize:28,color:GOLD},brand:{color:"#FFFDF6",fontSize:23,fontWeight:"900",letterSpacing:.8},
 langBtn:{flexDirection:"row",alignItems:"center",gap:5,borderRadius:22,borderColor:GOLD,borderWidth:1,paddingHorizontal:11,paddingVertical:9},
 langText:{color:"#FFF8E7",fontWeight:"700",fontSize:12},
 eyebrow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:20},
 flag:{fontSize:17},eyebrowText:{color:GOLD,fontSize:11,fontWeight:"800",letterSpacing:1.3},
 heroTitle:{fontSize:30,color:"#FFFFFF",fontWeight:"900",marginTop:13},
 heroAccent:{fontSize:30,color:"#E4BE78",fontWeight:"900",marginTop:0},
 heroSub:{fontSize:13,color:"#E3EDE7",marginTop:10,lineHeight:19,maxWidth:"92%"},
 skyline:{height:104,opacity:.9,marginTop:3,marginHorizontal:-20},heroGoldLine:{height:3,backgroundColor:GOLD,marginHorizontal:-20},
 content:{paddingHorizontal:15,paddingTop:15},searchBox:{height:58,flexDirection:"row",alignItems:"center",gap:10,
  backgroundColor:"#FFFDF9",borderColor:"#D9B56D",borderWidth:1.25,borderRadius:20,paddingHorizontal:17,...shadows,marginBottom:23},
 searchInput:{flex:1,fontSize:14,color:TEXT},
 titleRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12,marginTop:5},
 sectionTitle:{fontSize:18,fontWeight:"900",color:GREEN},viewAll:{flexDirection:"row",alignItems:"center",gap:2,padding:5},
 viewText:{color:"#986F2B",fontWeight:"800",fontSize:12},categoryRow:{gap:11,paddingBottom:14,paddingRight:4},
 categoryCard:{width:137,borderWidth:1,borderColor:"#EADCB9",borderRadius:22,overflow:"hidden",...shadows},
 categoryFeatured:{borderColor:GOLD},
 categoryFill:{height:166,alignItems:"center",paddingHorizontal:9,paddingTop:13},
 catSymbol:{width:65,height:62,borderRadius:20,alignItems:"center",justifyContent:"center"},
 catEmoji:{fontSize:34},catName:{fontSize:18,fontWeight:"900",color:GREEN,marginTop:9},
 catSub:{fontSize:11,color:"#6A7A70",fontWeight:"600",marginTop:2,textAlign:"center"},
 catActive:{color:"#FFF6E7"},catArrow:{position:"absolute",bottom:8,width:23,height:23,borderRadius:12,alignItems:"center",justifyContent:"center"},
 cityRow:{gap:9,paddingBottom:20,paddingRight:4},cityChip:{backgroundColor:"#FFFDF9",borderRadius:23,
  paddingHorizontal:18,paddingVertical:12,borderWidth:1,borderColor:"#EADDBF"},
 citySelected:{backgroundColor:GREEN,borderColor:GOLD},
 cityText:{fontSize:12,color:GREEN,fontWeight:"800"},cityTextSelected:{color:"#FFF9E9"},
 minor:{fontSize:12,color:"#718276",marginTop:4},
 refresh:{flexDirection:"row",gap:5,alignItems:"center",padding:7},
 productGrid:{flexDirection:"row",flexWrap:"wrap",gap:11,justifyContent:"space-between"},
 productCard:{width:"48%",backgroundColor:"#FFFDF8",borderRadius:20,borderColor:"#EDDFCA",borderWidth:1,overflow:"hidden",...shadows},
 productVisual:{height:140,overflow:"hidden"},productGradient:{flex:1,alignItems:"center",justifyContent:"center"},
 productEmoji:{fontSize:63},verifiedTag:{position:"absolute",bottom:8,left:8,backgroundColor:"#FFF9ED",paddingHorizontal:8,paddingVertical:4,borderRadius:10},
 verifiedText:{fontSize:10,color:GREEN,fontWeight:"800"},
 heart:{position:"absolute",top:10,right:10,width:34,height:34,borderRadius:19,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFAF4"},
 productBody:{padding:12},productTitle:{color:TEXT,fontSize:14,fontWeight:"900"},
 productMerchant:{fontSize:11,color:"#788B7D",marginTop:5},
 productPrice:{color:"#0D7352",fontWeight:"900",fontSize:16,marginTop:9},
 addButton:{backgroundColor:GREEN,marginTop:11,borderRadius:11,paddingVertical:9,paddingHorizontal:9,
  flexDirection:"row",justifyContent:"center",alignItems:"center",gap:6},
 addText:{fontSize:12,color:"#FFF8E9",fontWeight:"900"},
 emptyCard:{borderRadius:22,borderColor:"#E6D9C2",borderWidth:1,backgroundColor:"#FFFCF5",
  paddingHorizontal:22,paddingVertical:24,alignItems:"center",marginTop:6,marginBottom:15},
 emptyIcon:{width:64,height:64,alignItems:"center",justifyContent:"center",backgroundColor:"#F3EBD9",borderRadius:20},
 emptyTitle:{fontSize:17,color:GREEN,fontWeight:"900",marginTop:13},
 emptySub:{fontSize:12,color:"#687C70",marginTop:8,lineHeight:19},
 emptyButton:{marginTop:19,paddingHorizontal:19,paddingVertical:13,borderRadius:14,backgroundColor:GREEN,
  flexDirection:"row",gap:8,alignItems:"center"},
 emptyButtonText:{color:"#FFF8E9",fontWeight:"800",fontSize:12},
 merchantCard:{flexDirection:"row",borderRadius:20,padding:17,alignItems:"center",marginTop:13,gap:10,marginBottom:20},
 merchantIcon:{color:GOLD,fontSize:34},merchantInfo:{flex:1},
 merchantTitle:{color:"#FFF6E3",fontWeight:"900",fontSize:15},
 merchantSub:{color:"#C7E2D5",fontSize:11,marginTop:3},
 merchantArrow:{height:38,width:38,borderRadius:20,backgroundColor:GOLD,justifyContent:"center",alignItems:"center"},
 pageTitle:{fontSize:25,fontWeight:"900",color:GREEN,marginVertical:20},
 bottom:{backgroundColor:"#FFFCF7",flexDirection:"row",paddingHorizontal:8,paddingTop:9,borderTopColor:"#EADFCB",borderTopWidth:1,...shadows},
 navTab:{flex:1,alignItems:"center",paddingVertical:9,borderRadius:15,gap:4},
 navActive:{backgroundColor:GREEN},navText:{fontSize:10,color:"#5F7769",fontWeight:"700"},
 navSelected:{color:"#FAE3AE"},
 cartLine:{borderColor:"#EADFCB",borderWidth:1,borderRadius:15,backgroundColor:"#FFFDF9",
  padding:14,marginBottom:10,flexDirection:"row",gap:13,alignItems:"center"},
 cartEmoji:{fontSize:35},quantity:{flexDirection:"row",alignItems:"center",gap:9},
 qtyText:{fontSize:14,fontWeight:"900",color:GREEN},
 totalRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:15},
 checkoutLocked:{borderRadius:13,backgroundColor:"#F4EEDC",borderColor:"#E1D3AF",borderWidth:1,padding:15,flexDirection:"row",gap:9,alignItems:"center"},
 checkoutLockedText:{fontSize:12,color:"#816D4B",fontWeight:"700",flex:1},
 filterBox:{backgroundColor:"#E8F2EA",borderRadius:12,padding:11,marginBottom:13,flexDirection:"row",alignItems:"center"},
 filterText:{color:GREEN,flex:1,fontSize:12,fontWeight:"800"},
 modalBg:{...StyleSheet.absoluteFillObject,backgroundColor:"#071E17CC",justifyContent:"center",padding:20},
 modal:{backgroundColor:CREAM,borderRadius:23,padding:23},modalClose:{alignSelf:"flex-end"},
 modalEmoji:{fontSize:68,textAlign:"center",marginTop:10},
 description:{fontSize:13,color:"#647669",marginTop:12,lineHeight:19},
 modalAdd:{borderRadius:12,padding:14,marginTop:18,backgroundColor:GREEN,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7}
});
