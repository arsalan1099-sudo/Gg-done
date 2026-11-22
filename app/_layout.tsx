import React from "react";
import {Stack} from "expo-router";

// Saudi prelaunch release: the inherited Go Bharat screens are intentionally
// inaccessible. They remain in source for future migration only. Expo Router
// Protected routes redirect direct links to the Saudi index (not India APIs).
// This is a client navigation guard, NOT server-side authorization.
export default function RootLayout() {
  return (
    <Stack screenOptions={{headerShown:false,animation:"none"}}>
      <Stack.Screen name="index" />
      <Stack.Screen name="privacy" />
      <Stack.Protected guard={false}>
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(delivery)" />
        <Stack.Screen name="(franchise)" />
        <Stack.Screen name="(marketing)" />
        <Stack.Screen name="(vendor)" />
        <Stack.Screen name="about" />
        <Stack.Screen name="accept-terms" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="admin-manual" />
        <Stack.Screen name="admin-revenue" />
        <Stack.Screen name="admin-sales-leads" />
        <Stack.Screen name="ai-assistant" />
        <Stack.Screen name="all-categories" />
        <Stack.Screen name="all-reviews" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="bus-booking" />
        <Stack.Screen name="cab-booking" />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="coupons" />
        <Stack.Screen name="delivery-earnings" />
        <Stack.Screen name="flight-booking" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="franchise-revenue" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="live-shopping" />
        <Stack.Screen name="marketing-incentives" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="store/[id]" />
        <Stack.Screen name="subcategory/[id]" />
        <Stack.Screen name="submit-story" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="upload-reel" />
        <Stack.Screen name="vendor-ads" />
        <Stack.Screen name="vendor-b2b" />
        <Stack.Screen name="vendor-chat" />
        <Stack.Screen name="vendor-live" />
        <Stack.Screen name="vendor-manpower" />
        <Stack.Screen name="vendor-payouts" />
        <Stack.Screen name="vendor-register" />
        <Stack.Screen name="vendor-subscription" />
        <Stack.Screen name="vendor-travel" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="write-review" />
      </Stack.Protected>
    </Stack>
  );
}
