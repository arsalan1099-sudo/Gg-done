import React from "react";
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SaudiGroupId,saudiMainCategories,subcategoriesFor} from "../../lib/saudiCategories";

type Lang="ar"|"en";
type Props={
 lang:Lang;
 selectedGroup:SaudiGroupId;
 onGroupChange:(group:SaudiGroupId)=>void;
 onSubcategory:(id:string)=>void;
 onBrowseGroup:(group:SaudiGroupId)=>void;
 search:string;
 onSearchChange:(s:string)=>void;
};
const localized=(item:{ar:string;en:string},lang:Lang)=>lang==="ar"?item.ar:item.en;

export function SaudiCategoryStrip({lang,onOpenAll,onOpenGroup}:{
 lang:Lang;onOpenAll:()=>void;onOpenGroup:(id:SaudiGroupId)=>void;
}){
 return <View style={styles.stripWrap}>
  <View style={styles.stripHead}>
    <Text style={styles.headTitle}>{lang==="ar"?"تسوق حسب الفئة":"Shop by category"}</Text>
    <Pressable accessibilityRole="button" onPress={onOpenAll} style={styles.allButton}>
      <Text style={styles.allText}>{lang==="ar"?"عرض الكل":"View all"}  ›</Text>
    </Pressable>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
    {saudiMainCategories.map(group=><Pressable key={group.id} onPress={()=>onOpenGroup(group.id)}
      accessibilityRole="button" accessibilityLabel={localized(group,lang)}
      style={[styles.mainCard,{borderBottomColor:group.color}]}>
      <View style={[styles.mainIcon,{backgroundColor:group.color+"18"}]}>
        <Text style={styles.mainEmoji}>{group.emoji}</Text>
      </View>
      <Text numberOfLines={1} style={styles.mainEnglish}>{group.en}</Text>
      <Text numberOfLines={2} style={styles.mainArabic}>{group.ar}</Text>
    </Pressable>)}
  </ScrollView>
 </View>;
}
export default function SaudiCategoryExplorer({
 lang,selectedGroup,onGroupChange,onSubcategory,onBrowseGroup,search,onSearchChange
}:Props){
 const group=saudiMainCategories.find(g=>g.id===selectedGroup)!;
 const items=subcategoriesFor(selectedGroup).filter(s=>{
  const query=search.trim().toLowerCase();
  return !query||s.en.toLowerCase().includes(query)||s.ar.includes(query);
 });
 return <View style={styles.explorer}>
  <View style={styles.exploreHeader}>
   <Text style={[styles.exploreTitle,{textAlign:lang==="ar"?"right":"left"}]}>
    {lang==="ar"?"جميع الفئات":"All Categories"}
   </Text>
   <Text style={[styles.exploreSubtitle,{textAlign:lang==="ar"?"right":"left"}]}>
    {lang==="ar"?"اختر الفئة والقسم الفرعي":"Browse Go Saudi by category and subcategory"}
   </Text>
  </View>
  <View style={styles.explorerBody}>
   <ScrollView style={styles.side} nestedScrollEnabled showsVerticalScrollIndicator={false}
     contentContainerStyle={styles.sideContent}>
    {saudiMainCategories.map(cat=>{
     const selected=cat.id===selectedGroup;
     return <Pressable key={cat.id} accessibilityRole="button"
       accessibilityState={{selected}}
       onPress={()=>{onGroupChange(cat.id);onSearchChange("");}}
       style={[styles.sideItem,selected&&styles.sideItemSelected,
              selected&&{borderLeftColor:cat.color}]}>
       <View style={[styles.sideIcon,{backgroundColor:selected?cat.color:"#edf2ee"}]}>
        <Text style={styles.sideEmoji}>{cat.emoji}</Text>
       </View>
       <Text numberOfLines={2} style={[styles.sideLabel,selected&&{color:cat.color}]}>
        {localized(cat,lang)}
       </Text>
       <Text style={styles.sideEn}>{lang==="ar"?cat.en:cat.subtitleEn}</Text>
     </Pressable>;
    })}
   </ScrollView>
   <View style={styles.rightContent}>
    <View style={[styles.groupBanner,{backgroundColor:group.color}]}>
     <Text style={styles.groupEmoji}>{group.emoji}</Text>
     <View style={{flex:1}}>
      <Text style={styles.groupName}>{localized(group,lang)}</Text>
      <Text style={styles.groupCaption}>{items.length} {lang==="ar"?"قسم فرعي":"subcategories"}</Text>
     </View>
    </View>
    <Pressable accessibilityRole="button" onPress={()=>onBrowseGroup(selectedGroup)}
      style={[styles.browseGroup,{borderColor:group.color+"50"}]}>
      <Text style={[styles.browseText,{color:group.color}]}>
       {lang==="ar"?"تصفح منتجات هذه الفئة":"Browse all products in group"}  ›
      </Text>
    </Pressable>
    <TextInput value={search} onChangeText={onSearchChange}
      placeholder={lang==="ar"?"🔎 ابحث عن قسم فرعي":"🔎 Search subcategories"}
      placeholderTextColor="#758779" style={[styles.search,{textAlign:lang==="ar"?"right":"left"}]}/>
    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}
      style={styles.subScroll} contentContainerStyle={styles.subGrid}>
      {items.map(sub=><Pressable key={sub.id} accessibilityRole="button"
        accessibilityLabel={localized(sub,lang)}
        onPress={()=>onSubcategory(sub.id)}
        style={[styles.subCard,{borderColor:group.color+"25"}]}>
        <View style={[styles.subIcon,{backgroundColor:group.color+"13"}]}>
         <Text style={styles.subEmoji}>{sub.emoji}</Text>
        </View>
        <Text style={styles.subLabel} numberOfLines={3}>{localized(sub,lang)}</Text>
       </Pressable>)}
       {items.length===0&&<View style={styles.empty}>
         <Text style={styles.emptyText}>{lang==="ar"?"لا توجد فئات مطابقة":"No matching subcategories"}</Text>
       </View>}
    </ScrollView>
   </View>
  </View>
  <Text style={styles.disclaimer}>
   {lang==="ar"
    ?"ملاحظة: عرض الفئات لا يعني تفعيل الشراء أو الحجز أو الخدمات المرخصة."
    :"Category browsing does not enable orders, bookings, regulated products or licensed services."}
  </Text>
 </View>;
}
const styles=StyleSheet.create({
 stripWrap:{marginTop:3,marginBottom:17},
 stripHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},
 headTitle:{fontSize:18,fontWeight:"900",color:"#163e2d"},
 allButton:{paddingVertical:8,paddingHorizontal:11},
 allText:{color:"#0b7450",fontWeight:"800",fontSize:13},
 stripRow:{gap:10,paddingVertical:3,paddingRight:4},
 mainCard:{width:112,minHeight:137,alignItems:"center",backgroundColor:"#fff",
  borderRadius:16,borderWidth:1,borderColor:"#e0e9e2",borderBottomWidth:3,
  paddingVertical:13,paddingHorizontal:8},
 mainIcon:{width:54,height:54,borderRadius:17,alignItems:"center",justifyContent:"center",marginBottom:9},
 mainEmoji:{fontSize:29},
 mainEnglish:{fontSize:14,fontWeight:"900",color:"#183f2f",textAlign:"center"},
 mainArabic:{fontSize:11,fontWeight:"600",color:"#628171",textAlign:"center",marginTop:4},
 explorer:{marginBottom:14,borderWidth:1,borderColor:"#dce9df",borderRadius:17,overflow:"hidden",backgroundColor:"#fff"},
 exploreHeader:{padding:16,backgroundColor:"#f5faf6"},
 exploreTitle:{fontSize:22,fontWeight:"900",color:"#164735"},
 exploreSubtitle:{fontSize:12,color:"#6b8272",marginTop:5},
 explorerBody:{flexDirection:"row",height:585,backgroundColor:"#fff"},
 side:{width:93,backgroundColor:"#f5f7f5",borderRightWidth:1,borderRightColor:"#e1eae2"},
 sideContent:{paddingVertical:7,paddingHorizontal:5},
 sideItem:{alignItems:"center",borderLeftWidth:3,borderLeftColor:"transparent",
   paddingVertical:14,paddingHorizontal:3,borderRadius:9,marginBottom:5},
 sideItemSelected:{backgroundColor:"#fff"},
 sideIcon:{width:45,height:45,borderRadius:13,alignItems:"center",justifyContent:"center",marginBottom:8},
 sideEmoji:{fontSize:23},
 sideLabel:{fontSize:11,fontWeight:"800",color:"#63776a",textAlign:"center"},
 sideEn:{fontSize:9,color:"#92a097",marginTop:3,textAlign:"center"},
 rightContent:{flex:1,paddingHorizontal:10,paddingTop:12,minWidth:0},
 groupBanner:{height:72,borderRadius:13,paddingHorizontal:12,flexDirection:"row",
    alignItems:"center",gap:11,marginBottom:11},
 groupEmoji:{fontSize:31},
 groupName:{color:"#fff",fontSize:17,fontWeight:"900"},
 groupCaption:{color:"#ffffffd9",fontSize:11,marginTop:4},
 browseGroup:{borderRadius:10,borderWidth:1,backgroundColor:"#fafffa",paddingVertical:10,
  paddingHorizontal:8,marginBottom:10},
 browseText:{fontSize:11,textAlign:"center",fontWeight:"800"},
 search:{borderRadius:10,borderWidth:1,borderColor:"#dce8df",paddingHorizontal:9,paddingVertical:10,
   fontSize:12,marginBottom:10,color:"#18402f"},
 subScroll:{flex:1},
 subGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:9,paddingBottom:20},
 subCard:{width:"48%",minHeight:112,borderRadius:12,borderWidth:1,backgroundColor:"#fff",
    alignItems:"center",paddingHorizontal:5,paddingVertical:11},
 subIcon:{borderRadius:13,width:51,height:48,justifyContent:"center",alignItems:"center",marginBottom:9},
 subEmoji:{fontSize:27},
 subLabel:{textAlign:"center",fontSize:11,fontWeight:"800",color:"#284b39",lineHeight:15},
 empty:{width:"100%",paddingVertical:25},
 emptyText:{textAlign:"center",color:"#728374",fontSize:12},
 disclaimer:{paddingVertical:12,paddingHorizontal:15,color:"#8d7750",fontSize:11,backgroundColor:"#fff8ed"}
});
