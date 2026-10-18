import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/lib/query-client";

type Membership = { status: string; active: boolean; amount?: number; expiresAt?: string | null; paymentReference?: string | null };
type StatusResponse = { vendorStatus: string; membership: Membership };

export default function VendorSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [vendorStatus, setVendorStatus] = useState("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState("");
  const [gatewayReady, setGatewayReady] = useState(false);

  const auth = async (): Promise<string> => {
    const token = await AsyncStorage.getItem("gobharat_auth_token");
    if (!token) throw new Error("Please log in to your vendor account.");
    return token;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const base = getApiUrl();
      const token = await auth();
      const [statusRes, offerRes] = await Promise.all([
        fetch(new URL("/api/vendor-membership/status", base).toString(), {
          headers: { Authorization: "Bearer " + token, "Cache-Control": "no-cache" },
          cache: "no-store"
        }),
        fetch(new URL("/api/vendor-membership/offer", base).toString(), { cache: "no-store" }),
      ]);
      const status = await statusRes.json() as StatusResponse & { error?: string };
      const offer = await offerRes.json() as { gatewayAvailable?: boolean };
      if (!statusRes.ok) throw new Error(status.error || "Membership could not be loaded");
      setVendorStatus(status.vendorStatus);
      setMembership(status.membership);
      setGatewayReady(Boolean(offerRes.ok && offer.gatewayAvailable));
      setError("");
    } catch (e: any) {
      setError(e?.message || "Unable to check membership status");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const beginPayment = async () => {
    if (processing) return;
    setProcessing(true);
    setError("");
    try {
      const token = await auth();
      const res = await fetch(new URL("/api/vendor-membership/create-order", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({})
      });
      const data = await res.json() as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || "Checkout unavailable");
      const url = new URL(data.checkoutUrl, getApiUrl()).toString();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.assign(url);
        return;
      }
      await WebBrowser.openBrowserAsync(url);
      await refresh();
    } catch (e: any) {
      const message = e?.message || "Could not open secure payment";
      setError(message);
      Alert.alert("Membership payment", message);
    } finally { setProcessing(false); }
  };

  const active = membership?.active === true;
  const approved = vendorStatus === "APPROVED" || vendorStatus === "LIVE";
  const bottom = Platform.OS === "web" ? 40 : insets.bottom + 30;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F3F6FB" }} contentContainerStyle={{ paddingBottom: bottom }}>
      <LinearGradient colors={["#071B38", "#183A60"]} style={{ paddingTop: (Platform.OS === "web" ? 60 : insets.top) + 14, paddingHorizontal: 22, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 22, flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Vendor dashboard</Text>
        </Pressable>
        <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFAF7C", letterSpacing: 1.5 }}>GO BHARAT MEMBERSHIP</Text>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#FFFFFF", marginTop: 12, lineHeight: 39 }}>Bring your business online.</Text>
        <Text style={{ fontSize: 14, color: "#CDDAEC", marginTop: 10, lineHeight: 22 }}>A transparent annual plan with secure payment verification.</Text>
      </LinearGradient>
      <View style={{ paddingHorizontal: 20, marginTop: -16 }}>
        <View style={{ padding: 24, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E9F0" }}>
          <Text style={{ color: "#64748B", fontWeight: "800", fontSize: 12 }}>ANNUAL VENDOR PLAN</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6 }}>
            <Text style={{ fontSize: 40, fontWeight: "900", color: "#101C33" }}>₹1,000</Text>
            <Text style={{ color: "#64748B", marginLeft: 7 }}> / year</Text>
          </View>
          <Text style={{ marginTop: 6, fontSize: 13, color: "#63758B" }}>₹0 additional onboarding fee with this offer. Separate platform order commissions may apply.</Text>
          {["Seller digital storefront", "Product listings and order management", "Local customer discovery", "Payment verified by Razorpay"].map(v =>
            <View key={v} style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14 }}>
              <Ionicons name="checkmark-circle" size={20} color="#139A72" />
              <Text style={{ color: "#263A4E", flex: 1, fontSize: 14 }}>{v}</Text>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: "#E9EFF5", marginVertical: 22 }} />
          {loading ? <ActivityIndicator color="#F56F17" /> : (
            <>
              <Text style={{ color: active ? "#0D9266" : "#A76316", fontWeight: "800" }}>
                {active ? "Membership active ✓" : "Membership: " + (membership?.status || "Not purchased")}
              </Text>
              {active && membership?.expiresAt ? <Text style={{ marginTop: 8, color: "#64748B" }}>
                Valid until {new Date(membership.expiresAt).toLocaleDateString("en-IN")}
              </Text> : null}
              {!active && !approved ? <Text style={{ marginTop: 8, color: "#9A5B20" }}>Your vendor application must be approved before payment is available.</Text> : null}
              {!active && !gatewayReady ? <Text style={{ marginTop: 8, color: "#B42318" }}>Live payment gateway is not available. No charge can be made.</Text> : null}
              {error ? <Text style={{ color: "#B42318", marginTop: 12 }}>{error}</Text> : null}
              <Pressable disabled={active || !approved || !gatewayReady || processing}
                onPress={beginPayment}
                style={{ marginTop: 21, alignItems: "center", borderRadius: 13, paddingVertical: 17, backgroundColor: active || !approved || !gatewayReady || processing ? "#BAC5D1" : "#FF7119" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>{processing ? "Opening checkout..." : active ? "Already subscribed" : "Pay ₹1,000 securely"}</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={refresh} style={{ alignItems: "center", marginTop: 18, padding: 8 }}>
            <Text style={{ color: "#2B5E9D", fontWeight: "800" }}>Refresh verified payment status</Text>
          </Pressable>
          <Text style={{ marginTop: 10, textAlign: "center", color: "#748398", fontSize: 12, lineHeight: 17 }}>
            A payment is never considered successful based solely on a screenshot, redirect, or vendor approval.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
