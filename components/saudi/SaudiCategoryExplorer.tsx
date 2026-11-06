import React from "react";
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {Ionicons} from "@expo/vector-icons";
import {SaudiGroupId,saudiMainCategories,subcategoriesFor} from "../../lib/saudiCategories";

type Lang="ar"|"en";
type Props={
 lang:Lang;
 selectedGroup:SaudiGroupId;
 onGroupChange:(group:SaudiGroupId)=>void;
 onSubcategory:(id:string)=>void;
 onBrowseGroup:(group:SaudiGroupId)=>void;
 search:string;
 onSearchChange:(value:string)=>void;
};
const GREEN="#053F32";
const GOLD="#D9AE60";
const BRASS="#966F34";
const CREAM="#FFF8EB";
const PAPER="#FFFDF9";
const MUTED="#829082";
const translated=(v:{ar:string;en:string},lang:Lang)=>lang==="ar"?v.ar:v.en;

export function SaudiCategoryStrip({lang,onOpenAll,onOpenGroup}:{
 lang:Lang;onOpenAll:()=>void;onOpenGroup:(id:SaudiGroupId)=>void;
}){
 return <View style={styles.strip}>
  <View style={styles.stripHeader}>
   <Text style={styles.stripTitle}>{lang==="ar"?"تسوق حسب الفئة":"Shop by category"}</Text>
   <Pressable accessibilityRole="button" onPress={onOpenAll}>
    <Text style={styles.stripAll}>{lang==="ar"?"عرض الكل":"View all"}  ‹</Text>
   </Pressable>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
   {saudiMainCategories.map(group=><Pressable key={group.id}
     accessibilityRole="button" accessibilityLabel={translated(group,lang)}
     onPress={()=>onOpenGroup(group.id)} style={styles.stripCard}>
     <View style={styles.stripIcon}><Text style={styles.stripEmoji}>{group.emoji}</Text></View>
     <Text style={styles.stripName} numberOfLines={1}>{lang==="ar"?group.ar:group.en}</Text>
     <Text style={styles.stripEn} numberOfLines={1}>{lang==="ar"?group.en:group.subtitleEn}</Text>
   </Pressable>)}
  </ScrollView>
 </View>;
}

export default function SaudiCategoryExplorer({
 lang,selectedGroup,onGroupChange,onSubcategory,onBrowseGroup,search,onSearchChange
}:Props){
 const arabic=lang==="ar";
 const group=saudiMainCategories.find(c=>c.id===selectedGroup)??saudiMainCategories[0];
 const all=subcategoriesFor(selectedGroup);
 const query=search.trim().toLocaleLowerCase();
 const matches=all.filter(sub=>!query||
   sub.en.toLocaleLowerCase().includes(query)||sub.ar.includes(query));
 const chosen=(id:SaudiGroupId)=>{onGroupChange(id);onSearchChange("");};
 return <View style={styles.container}>
   <View style={styles.titleArea}>
    <View style={styles.headingOrnament}>
     <View style={styles.goldRule}/><Text style={styles.ornament}>✦</Text><View style={styles.goldRule}/>
    </View>
    <Text style={styles.heading}>{arabic?"جميع الفئات":"All Categories"}</Text>
    <Text style={styles.subtitle}>{arabic?"اختر الفئة والقسم الفرعي للتصفح والتسوق":"Explore stores by group and subcategory"}</Text>
    <View style={styles.headingOrnament}>
     <View style={styles.shortRule}/><Text style={styles.tinyGold}>◆</Text><View style={styles.shortRule}/>
    </View>
   </View>

   <View style={styles.searchBar}>
    <Ionicons name="options-outline" color={BRASS} size={21}/>
    <View style={styles.searchSeparator}/>
    <TextInput value={search} onChangeText={onSearchChange}
     placeholder={arabic?"ابحث عن قسم فرعي...":"Search subcategories..."}
     accessibilityLabel={arabic?"بحث عن قسم فرعي":"Search subcategories"}
     placeholderTextColor="#968B77" style={[styles.searchInput,{textAlign:arabic?"right":"left"}]}
     returnKeyType="search"/>
    {search.length>0&&<Pressable onPress={()=>onSearchChange("")}
      accessibilityRole="button" accessibilityLabel={arabic?"مسح البحث":"Clear search"}>
      <Ionicons name="close-circle-outline" size={19} color="#9B8D75"/>
    </Pressable>}
    <Ionicons name="search-outline" color={BRASS} size={22}/>
   </View>

   <View style={styles.mainPanel}>
    <View style={styles.columns}>
     <View style={styles.left}>
      {saudiMainCategories.map(cat=>{
       const isSelected=cat.id===selectedGroup;
       return <Pressable accessibilityRole="button" accessibilityState={{selected:isSelected}}
         accessibilityLabel={translated(cat,lang)} key={cat.id}
         onPress={()=>chosen(cat.id)} style={[styles.mainCard,{flexDirection:arabic?"row-reverse":"row"},isSelected&&styles.mainSelected]}>
        {isSelected&&<LinearGradient colors={["#0C6B50","#034032"]} style={styles.selectedFill}/>}
        <View style={[styles.mainIcon,isSelected&&styles.selectedIcon]}>
         <Text style={styles.mainEmoji}>{cat.emoji}</Text>
        </View>
        <View style={styles.mainInfo}>
         <Text style={[styles.mainLabel,{textAlign:arabic?"right":"left"},isSelected&&styles.selectedLabel]}
           numberOfLines={2}>{translated(cat,lang)}</Text>
         <Text style={[styles.mainSub,{textAlign:arabic?"right":"left"},isSelected&&styles.selectedSub]}
           numberOfLines={1}>{arabic?cat.en:cat.subtitleEn}</Text>
        </View>
       </Pressable>;
      })}
     </View>

     <View style={styles.right}>
      <LinearGradient colors={["#0A674D","#033F32"]} start={{x:0,y:0}} end={{x:1,y:1}}
        style={styles.groupHero}>
       <View style={styles.heroSymbol}><Text style={styles.heroEmoji}>{group.emoji}</Text></View>
       <Text style={styles.heroName} numberOfLines={2}>{translated(group,lang)}</Text>
       <Text style={styles.heroCount}>{all.length} {arabic?"قسم فرعي":"subcategories"}</Text>
       <View style={styles.heroCorner}><Text style={styles.heroStar}>✦</Text></View>
      </LinearGradient>
      <Pressable onPress={()=>onBrowseGroup(selectedGroup)} accessibilityRole="button"
        style={styles.groupButton}>
       <Ionicons name="chevron-back" color={GREEN} size={17}/>
       <Text style={styles.groupButtonText} numberOfLines={2}>
        {arabic?"تصفح منتجات الفئة":"Browse group products"}
       </Text>
      </Pressable>

      <ScrollView style={styles.subList} nestedScrollEnabled
       showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
       contentContainerStyle={styles.subContent}>
       {matches.map(sub=><Pressable key={sub.id} onPress={()=>onSubcategory(sub.id)}
         accessibilityRole="button" accessibilityLabel={translated(sub,lang)}
         style={styles.subCard}>
        <View style={styles.subIcon}><Text style={styles.subEmoji}>{sub.emoji}</Text></View>
        <Text style={[styles.subText,{textAlign:arabic?"right":"left"}]} numberOfLines={3}>
         {translated(sub,lang)}
        </Text>
       </Pressable>)}
       {matches.length===0&&<View style={styles.emptyResults}>
        <Ionicons name="search-outline" color={BRASS} size={27}/>
        <Text style={styles.emptyText}>{arabic?"لا توجد فئات مطابقة":"No matching categories"}</Text>
       </View>}
      </ScrollView>
     </View>
    </View>
   </View>
   <View style={styles.notice}>
    <Ionicons name="information-circle-outline" size={18} color="#896B36"/>
    <Text style={styles.noticeText}>
     {arabic?"عرض الفئات للتصفح فقط؛ تُفعّل الطلبات والخدمات بعد اكتمال التحقق."
      :"Browse categories; orders and regulated services remain unavailable pending verification."}
    </Text>
   </View>
  </View>;
}
const styles=StyleSheet.create({
 container:{borderRadius:25,overflow:"hidden",backgroundColor:CREAM,
  borderColor:"#E9D8B9",borderWidth:1,marginBottom:18},
 titleArea:{paddingTop:24,paddingHorizontal:13,paddingBottom:18,alignItems:"center"},
 headingOrnament:{flexDirection:"row",justifyContent:"center",alignItems:"center",gap:12},
 goldRule:{width:44,height:1,backgroundColor:GOLD},shortRule:{width:42,height:1,backgroundColor:GOLD},
 ornament:{fontSize:17,color:BRASS},tinyGold:{color:GOLD,fontSize:12},
 heading:{fontSize:29,fontWeight:"900",textAlign:"center",color:GREEN,marginVertical:7},
 subtitle:{fontSize:13,color:"#807A6C",textAlign:"center",lineHeight:21,marginBottom:13},
 searchBar:{marginHorizontal:13,marginBottom:18,minHeight:53,flexDirection:"row",alignItems:"center",
  gap:10,backgroundColor:PAPER,borderWidth:1,borderColor:"#D6B677",borderRadius:20,
  paddingHorizontal:12,shadowColor:"#745323",shadowOpacity:.08,shadowRadius:10,
  shadowOffset:{width:0,height:4},elevation:2},
 searchSeparator:{width:1,height:26,backgroundColor:"#D9BF91"},
 searchInput:{flex:1,minWidth:0,paddingVertical:9,color:GREEN,fontSize:13},
 mainPanel:{marginHorizontal:10,marginBottom:12,borderWidth:1,borderColor:"#E6D8C1",
  backgroundColor:"#FFF9EE",borderRadius:19,overflow:"hidden"},
 columns:{flexDirection:"row",alignItems:"stretch",height:610},
 left:{width:"51%",paddingHorizontal:7,paddingVertical:10,backgroundColor:"#FCF4E7",
  borderRightWidth:1,borderRightColor:"#E1CFAB",gap:9,justifyContent:"space-between"},
 mainCard:{height:96,borderRadius:17,backgroundColor:PAPER,
  borderWidth:1,borderColor:"#E5D8C4",flexDirection:"row",alignItems:"center",
  paddingHorizontal:9,gap:7,overflow:"hidden",shadowColor:"#5D492C",
  shadowOpacity:.07,shadowRadius:5,shadowOffset:{width:0,height:3},elevation:1},
 mainSelected:{borderColor:GOLD,borderWidth:2,backgroundColor:GREEN},
 selectedFill:{...StyleSheet.absoluteFillObject},
 mainIcon:{width:48,height:51,backgroundColor:"#F5EEDF",borderRadius:15,
  justifyContent:"center",alignItems:"center"},
 selectedIcon:{backgroundColor:"#1C795D"},
 mainEmoji:{fontSize:26},mainInfo:{flex:1,minWidth:0},
 mainLabel:{color:GREEN,fontSize:13,fontWeight:"900",lineHeight:19},
 selectedLabel:{color:"#FFFFFF"},mainSub:{color:"#938A79",fontSize:10,marginTop:3},
 selectedSub:{color:"#F1D59D"},
 right:{width:"49%",paddingHorizontal:7,paddingTop:10,paddingBottom:10},
 groupHero:{minHeight:117,borderWidth:1,borderColor:GOLD,borderRadius:17,padding:10,
  overflow:"hidden",alignItems:"center",justifyContent:"center"},
 heroSymbol:{width:39,height:39,borderRadius:13,backgroundColor:"#197359",
  justifyContent:"center",alignItems:"center",marginBottom:5},
 heroEmoji:{fontSize:25},heroName:{fontSize:17,fontWeight:"900",color:"#FFFFFF",
  textAlign:"center",lineHeight:22},
 heroCount:{fontSize:11,color:"#F3D69E",marginTop:4},
 heroCorner:{position:"absolute",right:8,top:1,opacity:.4},heroStar:{fontSize:21,color:GOLD},
 groupButton:{marginTop:9,marginBottom:10,minHeight:42,paddingHorizontal:6,
  paddingVertical:8,borderRadius:13,borderWidth:1,borderColor:"#D9C59E",
  flexDirection:"row",alignItems:"center",justifyContent:"center",backgroundColor:"#FFF8EA"},
 groupButtonText:{fontSize:11,fontWeight:"800",color:GREEN,flexShrink:1,textAlign:"center"},
 subList:{flex:1,minHeight:0},subContent:{paddingBottom:10,gap:9},
 subCard:{minHeight:84,backgroundColor:PAPER,borderRadius:15,borderWidth:1,
  borderColor:"#E9DDC8",flexDirection:"row",alignItems:"center",gap:8,
  padding:7,shadowColor:"#765535",shadowOpacity:.05,shadowRadius:6,
  shadowOffset:{width:0,height:3},elevation:1},
 subIcon:{width:48,height:55,borderRadius:14,backgroundColor:"#F7EEE0",
  alignItems:"center",justifyContent:"center"},
 subEmoji:{fontSize:26},
 subText:{fontSize:12,fontWeight:"800",color:GREEN,flex:1,lineHeight:18},
 emptyResults:{alignItems:"center",padding:20,gap:7},
 emptyText:{textAlign:"center",color:"#887D69",fontSize:12},
 notice:{marginHorizontal:12,marginBottom:12,borderRadius:13,
  backgroundColor:"#FFF3DE",paddingVertical:12,paddingHorizontal:10,
  flexDirection:"row",alignItems:"center",gap:8},
 noticeText:{color:"#806D4B",fontSize:11,flex:1,lineHeight:17}
});
