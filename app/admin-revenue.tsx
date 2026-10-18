import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/lib/query-client";

type Revenue = { activePayments:number; pendingPayments:number; refundedPayments:number; capturedRevenue:number;
  reservedMarketingCommission:number; beforeTaxAndGatewayFees:number; currency:string; payoutsExecuted:number;
  payments:Array<{id:string;status:string;amount:number;referralCommission:number;paidAt:string|null}> };
type Readiness = { annualPrice:number; referralRatePercent:number; liveRazorpayKeyPresent:boolean;
  webhookSecretPresent:boolean; subscriptionCollectionEnabled:boolean; acceptingNewCharges:boolean;
  gatewayCaptureTested:string; payoutExecution:string };
const money=(n:number)=>"₹"+n.toLocaleString("en-IN",{maximumFractionDigits:2});

export default function RevenueAdmin() {
  const insets=useSafeAreaInsets();
  const [data,setData]=useState<Revenue|null>(null);
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    setLoading(true);
    try {
      const token=await AsyncStorage.getItem("gobharat_auth_token");
      if(!token)throw new Error("Sign in as super admin to view verified revenue");
      const head={Authorization:"Bearer "+token,"Cache-Control":"no-cache"};
      const base=getApiUrl();
      const [revResp,readyResp]=await Promise.all([
        fetch(new URL("/api/admin/vendor-membership-revenue",base).toString(),{headers:head,cache:"no-store"}),
        fetch(new URL("/api/admin/vendor-membership-readiness",base).toString(),{headers:head,cache:"no-store"})
      ]);
      const [rev,ready]=await Promise.all([revResp.json(),readyResp.json()]);
      if(!revResp.ok || !readyResp.ok)throw new Error(rev.error||ready.error||"Revenue records unavailable");
      setData(rev);setReadiness(ready);setError("");
    }catch(e:any){setError(e?.message||"Unable to load revenue statement");setData(null);setReadiness(null);}
    finally{setLoading(false);}
  },[]);
  useFocusEffect(useCallback(()=>{refresh();},[refresh]));
  const figures=[
    {title:"Captured vendor revenue",value:money(data?.capturedRevenue||0),icon:"cash-outline" as const},
    {title:"Reserved marketing commissions",value:money(data?.reservedMarketingCommission||0),icon:"people-outline" as const},
    {title:"Before fees and taxes",value:money(data?.beforeTaxAndGatewayFees||0),icon:"wallet-outline" as const},
  ];
  const checks=[
    {title:"Live Razorpay credentials",pass:readiness?.liveRazorpayKeyPresent},
    {title:"Verified webhook secret configured",pass:readiness?.webhookSecretPresent},
    {title:"Membership collection explicitly enabled",pass:readiness?.subscriptionCollectionEnabled},
    {title:"New charge capability",pass:readiness?.acceptingNewCharges}
  ];
  return <ScrollView style={{flex:1,backgroundColor:"#F3F6FA"}} contentContainerStyle={{paddingBottom:(Platform.OS==="web"?40:insets.bottom+25)}}>
    <LinearGradient colors={["#0A1A34","#214264"]} style={{paddingHorizontal:20,paddingTop:(Platform.OS==="web"?58:insets.top)+14,paddingBottom:33}}>
      <Pressable onPress={()=>router.back()} style={{flexDirection:"row",alignItems:"center",gap:9,marginBottom:24}}>
        <Ionicons name="arrow-back" size={21} color="#FFFFFF"/><Text style={{fontWeight:"700",color:"#FFFFFF"}}>Super Admin</Text>
      </Pressable>
      <Text style={{fontSize:12,fontWeight:"800",color:"#FFAE70",letterSpacing:1.4}}>GO BHARAT FINANCE</Text>
      <Text style={{fontSize:31,fontWeight:"900",color:"#FFFFFF",marginTop:6}}>Verified membership revenue</Text>
      <Text style={{fontSize:13,lineHeight:20,color:"#C8D7E9",marginTop:8}}>Gateway-captured annual subscription payments only. Leads, orders and unverified applications are excluded.</Text>
    </LinearGradient>
    <View style={{paddingHorizontal:17,marginTop:-13}}>
      {loading?<ActivityIndicator color="#FF7719" style={{padding:23}}/>:null}
      {error?<Text style={{color:"#B42318",backgroundColor:"#FFFFFF",padding:17,borderRadius:12}}>{error}</Text>:null}
      <Pressable onPress={refresh} style={{padding:13,backgroundColor:"#FFF0E4",borderRadius:12,alignItems:"center",marginTop:12,marginBottom:13}}>
        <Text style={{fontWeight:"800",color:"#AF5B1A"}}>Refresh verified statement</Text>
      </Pressable>
      {figures.map(x=><View key={x.title} style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:20,marginBottom:11,flexDirection:"row",alignItems:"center",gap:14}}>
        <Ionicons name={x.icon} size={25} color="#F27622"/>
        <View><Text style={{fontSize:12,color:"#6D7F92"}}>{x.title}</Text><Text style={{fontSize:27,fontWeight:"900",color:"#172940",marginTop:3}}>{x.value}</Text></View>
      </View>)}
      <View style={{flexDirection:"row",gap:9,marginTop:5}}>
        {[{title:"Captured",n:data?.activePayments||0},{title:"Pending",n:data?.pendingPayments||0},{title:"Refunded",n:data?.refundedPayments||0}].map(x=>
          <View key={x.title} style={{flex:1,backgroundColor:"#FFFFFF",borderRadius:12,padding:14}}>
            <Text style={{fontWeight:"900",fontSize:22,color:"#20344C"}}>{x.n}</Text>
            <Text style={{fontSize:12,color:"#718196"}}>{x.title}</Text>
          </View>
        )}
      </View>
      <View style={{backgroundColor:"#FFFFFF",borderRadius:16,padding:20,marginTop:15}}>
        <Text style={{color:"#1B2D42",fontWeight:"900",fontSize:18}}>Payment launch checklist</Text>
        <Text style={{color:"#687D92",fontSize:12,marginTop:5,marginBottom:9}}>Configuration checks do not prove that a real capture or settlement test has passed.</Text>
        {checks.map(c=><View key={c.title} style={{flexDirection:"row",alignItems:"center",gap:9,marginTop:13}}>
          <Ionicons name={c.pass?"checkmark-circle":"close-circle-outline"} size={21} color={c.pass?"#0B9770":"#D38B3F"}/>
          <Text style={{flex:1,fontSize:13,color:"#344A61"}}>{c.title}</Text>
        </View>)}
        <Text style={{marginTop:14,color:"#B0722B",fontSize:12}}>Captured payment test: {readiness?.gatewayCaptureTested||"Not verified"}</Text>
      </View>
      <Pressable onPress={()=>router.push("/admin-sales-leads" as any)} style={{padding:17,borderRadius:14,marginTop:14,backgroundColor:"#16385D",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
        <Text style={{color:"#FFFFFF",fontWeight:"800"}}>Open seller enquiry pipeline</Text>
        <Ionicons name="arrow-forward-circle" color="#FFFFFF" size={22}/>
      </Pressable>
      <Text style={{color:"#72849A",textAlign:"center",fontSize:12,marginTop:16,lineHeight:17}}>No payment or payout can be initiated from this read-only admin report. Figures exclude gateway charges, taxes and unsettled refunds.</Text>
    </View>
  </ScrollView>;
}
