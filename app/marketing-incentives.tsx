import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { getApiUrl } from "@/lib/query-client";

type ReferralStatement = {
  verifiedPaidSubscriptions: number;
  pendingReviewCommission: number;
  paidOut: number;
  payoutStatus: string;
  items: Array<{ id: string; amount: number; commission: number; paidAt: string | null }>;
};

const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function MarketingIncentives() {
  const { leads } = useApp();
  const insets = useSafeAreaInsets();
  const [statement, setStatement] = useState<ReferralStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("gobharat_auth_token");
      if (!token) throw new Error("Log in as a marketing executive.");
      const res = await fetch(new URL("/api/vendor-membership/marketing", getApiUrl()).toString(), {
        headers: { Authorization: "Bearer " + token, "Cache-Control": "no-cache" },
        cache: "no-store"
      });
      const data = await res.json() as ReferralStatement & { error?: string };
      if (!res.ok) throw new Error(data.error || "Commission data unavailable");
      setStatement(data);
      setError("");
    } catch (e: any) {
      setStatement(null);
      setError(e?.message || "Could not load verified payments");
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.status === "CLOSED").length;

  return <ScrollView style={{ flex: 1, backgroundColor: "#F4F6FA" }} contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 45 : insets.bottom + 25) }}>
    <LinearGradient colors={["#081A37", "#203F68"]} style={{ paddingTop: (Platform.OS === "web" ? 58 : insets.top) + 13, paddingHorizontal: 20, paddingBottom: 32 }}>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Marketing dashboard</Text>
      </Pressable>
      <Text style={{ color: "#FFAC73", fontWeight: "800", fontSize: 12, letterSpacing: 1.5 }}>GO BHARAT REVENUE</Text>
      <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginTop: 8 }}>Verified referrals</Text>
      <Text style={{ color: "#CBD6E4", fontSize: 13, marginTop: 10, lineHeight: 20 }}>33% referral commission on confirmed ₹1,000 annual vendor memberships, subject to attribution and payout approval.</Text>
    </LinearGradient>
    <View style={{ marginTop: -12, paddingHorizontal: 17 }}>
      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 19, padding: 21, borderWidth: 1, borderColor: "#E4E9F1" }}>
        <Text style={{ color: "#64748B", fontWeight: "700", fontSize: 13 }}>Commission pending review</Text>
        <Text style={{ color: "#17273D", fontWeight: "900", fontSize: 38, marginTop: 8 }}>{rupees(statement?.pendingReviewCommission || 0)}</Text>
        <Text style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>Not yet payable or transferred. Refunds and verification may change this amount.</Text>
        {loading ? <ActivityIndicator color="#FF741C" style={{ marginTop: 20 }} /> : null}
        {error ? <Text style={{ color: "#B42318", marginTop: 14 }}>{error}</Text> : null}
        <Pressable onPress={load} style={{ marginTop: 17, paddingVertical: 12, borderRadius: 12, backgroundColor: "#FFF1E5", alignItems: "center" }}>
          <Text style={{ color: "#B9560C", fontWeight: "800" }}>Refresh payment records</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 11, marginTop: 13 }}>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: "#FFFFFF", padding: 17 }}>
          <Text style={{ color: "#17273D", fontSize: 25, fontWeight: "900" }}>{statement?.verifiedPaidSubscriptions || 0}</Text>
          <Text style={{ color: "#667A90", fontSize: 12, marginTop: 5 }}>Captured subscriptions</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: "#FFFFFF", padding: 17 }}>
          <Text style={{ color: "#17273D", fontSize: 25, fontWeight: "900" }}>{rupees(statement?.paidOut || 0)}</Text>
          <Text style={{ color: "#667A90", fontSize: 12, marginTop: 5 }}>Payouts recorded</Text>
        </View>
      </View>
      <View style={{ borderRadius: 17, backgroundColor: "#FFFFFF", padding: 20, marginTop: 15 }}>
        <Text style={{ color: "#17273D", fontSize: 17, fontWeight: "900" }}>Your lead pipeline</Text>
        <Text style={{ color: "#64748B", marginTop: 8, fontSize: 13 }}>{totalLeads} leads • {closedLeads} marked closed</Text>
        <Text style={{ color: "#64748B", marginTop: 9, fontSize: 12, lineHeight: 19 }}>Closing a lead or making a vendor LIVE does not prove a paid membership. Only captured gateway payments appear in the commission statement.</Text>
      </View>
      <View style={{ borderRadius: 17, backgroundColor: "#FFFFFF", padding: 20, marginTop: 15 }}>
        <Text style={{ color: "#17273D", fontSize: 17, fontWeight: "900", marginBottom: 11 }}>Gateway-verified subscription statement</Text>
        {!(statement?.items?.length) ? <Text style={{ color: "#74849A", fontSize: 13 }}>No verified paid memberships attributed to this marketing account yet.</Text> :
          statement.items.map(row => <View key={row.id} style={{ paddingVertical: 13, borderTopWidth: 1, borderTopColor: "#EFF2F6", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: "#273A4E", fontSize: 13 }}>Annual subscription</Text>
              <Text style={{ color: "#8694A7", fontSize: 12, marginTop: 3 }}>{row.paidAt ? new Date(row.paidAt).toLocaleDateString("en-IN") : "Pending date"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#0B8A66", fontSize: 16, fontWeight: "900" }}>{rupees(row.commission)}</Text>
              <Text style={{ color: "#AD762B", fontSize: 11 }}>Review pending</Text>
            </View>
          </View>)
        }
      </View>
      <Text style={{ color: "#77879C", fontSize: 12, marginTop: 16, lineHeight: 18, textAlign: "center" }}>Payout processing is not available in this screen. No bank transfer is initiated by refreshing or viewing the report.</Text>
    </View>
  </ScrollView>;
}
