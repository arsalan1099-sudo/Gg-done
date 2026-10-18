import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking, Alert, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/lib/query-client";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CLOSED" | "NOT_INTERESTED";
type Enquiry = {
  id: string; businessName: string; city: string; category: string; phone: string;
  consent: boolean; status: LeadStatus; createdAt: string;
};
const STATUS_OPTIONS: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "NOT_INTERESTED"];

export default function SellerLeadsAdmin() {
  const insets = useSafeAreaInsets();
  const [items,setItems] = useState<Enquiry[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [saving,setSaving] = useState<string | null>(null);
  const [filter,setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const token = async () => {
    const t = await AsyncStorage.getItem("gobharat_auth_token");
    if (!t) throw new Error("Admin login required.");
    return t;
  };
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const t = await token();
      const response = await fetch(new URL("/api/admin/seller-enquiries",getApiUrl()).toString(), {
        cache:"no-store", headers:{Authorization:"Bearer "+t,"Cache-Control":"no-cache"}
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load seller enquiries");
      setItems(data.enquiries || []); setError("");
    } catch (e:any) {
      setError(e?.message || "Could not load enquiries");
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); },[refresh]));

  const setStatus = async (item:Enquiry, status:LeadStatus) => {
    if (saving) return;
    setSaving(item.id);
    try {
      const t = await token();
      const response = await fetch(new URL("/api/admin/seller-enquiries/"+encodeURIComponent(item.id),getApiUrl()).toString(), {
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},
        body:JSON.stringify({status})
      });
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Update rejected");
      setItems(previous => previous.map(x=>x.id===item.id?{...x,status}:x));
    } catch (e:any) { Alert.alert("Could not update",e?.message || "Please try again"); }
    finally { setSaving(null); }
  };
  const whatsapp = async (item:Enquiry) => {
    const phone = item.phone.replace(/\D/g,"");
    if (!/^[6-9]\d{9}$/.test(phone)) return Alert.alert("Invalid contact","This lead has no valid Indian mobile number");
    const message = "Hello, this is Go Bharat seller support. You enquired about onboarding for " + item.businessName + ". Would you like details of the current annual plan and terms?";
    try { await Linking.openURL("https://wa.me/91"+phone+"?text="+encodeURIComponent(message)); }
    catch { Alert.alert("WhatsApp unavailable", "You can call the business contact instead."); }
  };
  const call = async (item:Enquiry) => {
    const phone = item.phone.replace(/\D/g,"");
    if(!/^[6-9]\d{9}$/.test(phone)) return;
    try { await Linking.openURL("tel:+91"+phone); } catch { Alert.alert("Dialer unavailable"); }
  };

  const visible=items.filter(e=>filter==="ALL"||e.status===filter);
  const newCount=items.filter(e=>e.status==="NEW").length;
  const qualifiedCount=items.filter(e=>e.status==="QUALIFIED").length;

  return <ScrollView style={{flex:1,backgroundColor:"#F2F5FA"}} contentContainerStyle={{paddingBottom:(Platform.OS==="web"?35:insets.bottom+20)}}>
    <LinearGradient colors={["#0B1B37","#213F65"]} style={{paddingTop:(Platform.OS==="web"?58:insets.top)+15,paddingHorizontal:18,paddingBottom:32}}>
      <Pressable onPress={()=>router.back()} style={{flexDirection:"row",gap:7,alignItems:"center",marginBottom:17}}>
        <Ionicons name="arrow-back" size={20} color="#FFFFFF"/><Text style={{color:"#FFFFFF",fontWeight:"800"}}>Admin dashboard</Text>
      </Pressable>
      <Text style={{color:"#FFB37B",fontWeight:"800",fontSize:12,letterSpacing:1.3}}>GO BHARAT • SALES</Text>
      <Text style={{color:"#FFFFFF",fontWeight:"900",fontSize:30,marginTop:6}}>Seller Enquiries</Text>
      <Text style={{color:"#C4D4E6",fontSize:13,marginTop:7}}>Consent-based incoming leads from the seller landing page.</Text>
    </LinearGradient>
    <View style={{marginTop:-14,paddingHorizontal:15}}>
      <View style={{flexDirection:"row",gap:10}}>
        {[
          {value:items.length,label:"Recent leads"},
          {value:newCount,label:"New"},
          {value:qualifiedCount,label:"Qualified"}
        ].map(x=><View key={x.label} style={{flex:1,backgroundColor:"#FFFFFF",padding:15,borderRadius:13}}>
          <Text style={{fontWeight:"900",fontSize:24,color:"#17283F"}}>{x.value}</Text>
          <Text style={{fontSize:11,color:"#6D7D91",marginTop:3}}>{x.label}</Text>
        </View>)}
      </View>
      <Text style={{color:"#60738C",fontSize:12,marginTop:12}}>These are enquiries, not paid subscriptions or verified revenue.</Text>
      <Pressable onPress={refresh} style={{backgroundColor:"#FFF1E6",padding:12,borderRadius:12,marginVertical:13,alignItems:"center"}}>
        <Text style={{fontWeight:"800",color:"#B85B12"}}>Refresh leads</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:11}}>
        {(["ALL",...STATUS_OPTIONS] as Array<"ALL"|LeadStatus>).map(status=>
          <Pressable key={status} onPress={()=>setFilter(status)} style={{backgroundColor:filter===status?"#F77822":"#FFFFFF",borderRadius:20,paddingHorizontal:13,paddingVertical:8,marginRight:7}}>
            <Text style={{fontSize:12,fontWeight:"700",color:filter===status?"#FFFFFF":"#536779"}}>{status.replace("_"," ")}</Text>
          </Pressable>
        )}
      </ScrollView>
      {loading?<ActivityIndicator color="#FF781C" style={{margin:30}}/>:null}
      {error?<Text style={{color:"#B42318",padding:10}}>{error}</Text>:null}
      {!loading&&visible.length===0?<View style={{backgroundColor:"#FFFFFF",padding:22,borderRadius:14}}>
        <Text style={{color:"#6B7C90"}}>No enquiries in this filter yet. Share the /sell page with interested businesses.</Text>
      </View>:null}
      {visible.map(item=><View key={item.id} style={{backgroundColor:"#FFFFFF",padding:17,borderRadius:16,borderWidth:1,borderColor:"#E3E9F1",marginBottom:11}}>
        <Text style={{fontSize:16,fontWeight:"900",color:"#192C42"}}>{item.businessName}</Text>
        <Text style={{color:"#667A90",fontSize:12,marginTop:4}}>{item.category} • {item.city}</Text>
        <Text style={{color:"#60758A",fontSize:12,marginTop:6}}>{item.phone} • {new Date(item.createdAt).toLocaleDateString("en-IN")}</Text>
        <Text style={{color:"#C0801B",fontSize:12,fontWeight:"700",marginTop:9}}>Status: {item.status.replace("_"," ")}</Text>
        <View style={{flexDirection:"row",gap:8,marginTop:13}}>
          <Pressable onPress={()=>whatsapp(item)} style={{flex:1,backgroundColor:"#0B8B64",borderRadius:9,padding:12,alignItems:"center"}}>
            <Text style={{color:"#FFFFFF",fontWeight:"800",fontSize:13}}>WhatsApp</Text>
          </Pressable>
          <Pressable onPress={()=>call(item)} style={{flex:1,backgroundColor:"#164879",borderRadius:9,padding:12,alignItems:"center"}}>
            <Text style={{color:"#FFFFFF",fontWeight:"800",fontSize:13}}>Call</Text>
          </Pressable>
        </View>
        <View style={{flexDirection:"row",gap:5,flexWrap:"wrap",marginTop:13}}>
          {STATUS_OPTIONS.filter(x=>x!==item.status).map(st=><Pressable key={st} disabled={saving===item.id} onPress={()=>setStatus(item,st)}
            style={{backgroundColor:"#F0F4F8",paddingVertical:8,paddingHorizontal:10,borderRadius:8}}>
            <Text style={{fontSize:11,color:"#496076",fontWeight:"800"}}>{st.replace("_"," ")}</Text>
          </Pressable>)}
        </View>
      </View>)}
    </View>
  </ScrollView>;
}
