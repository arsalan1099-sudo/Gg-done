#!/usr/bin/env node
// Static safety check for Go Saudi prelaunch Android/iOS artifacts. This does
// not claim store approval, on-device testing, credentials or signed binaries.
const fs=require("node:fs");
const assert=require("node:assert/strict");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const expo=read("app.json").expo;
const eas=read("eas.json");
const entry=fs.readFileSync("app/index.tsx","utf8");
const layout=fs.readFileSync("app/_layout.tsx","utf8");
const fail=(message)=>{throw Error("Go Saudi mobile gate: "+message)};
if(expo.name!=="Go Saudi"||expo.slug!=="go-saudi")fail("incorrect app branding");
if(expo.android?.package!=="com.aasaa.gosaudi"||expo.ios?.bundleIdentifier!=="com.aasaa.gosaudi")
  fail("Saudi-only Android and iOS IDs required; verify ownership before publish");
if(expo.extra?.market?.country!=="SA"||expo.extra.market.currency!=="SAR")
  fail("incorrect country/currency");
if(expo.extra?.market.paymentEnabled!==false||expo.extra?.storeSubmissionApproved!==false)
  fail("prelaunch must not claim store/commercial approval");
if(expo.android.permissions.some(x=>/CONTACTS|LOCATION|AUDIO|CAMERA|STORAGE/.test(x)))
  fail("unneeded sensitive Android permission still requested");
for(const name of ["READ_CONTACTS","ACCESS_FINE_LOCATION","RECORD_AUDIO","CAMERA"])
  if(!expo.android.blockedPermissions.includes("android.permission."+name))
    fail("missing dangerous permission block "+name);
for(const profile of ["preview","production"]){
  const env=eas.build[profile].env;
  if(env.EXPO_PUBLIC_API_URL||env.EXPO_PUBLIC_DOMAIN||
    /go.bharat/i.test(JSON.stringify(env)))fail("India production endpoint in "+profile);
  if(env.EXPO_PUBLIC_SAUDI_STAGE!=="PRELAUNCH")fail("prelaunch flag missing");
}
if(eas.build.production.android.buildType!=="app-bundle")fail("Android store needs AAB build");
if(!/sellerEnquiriesOpen===true/.test(entry)||!/country==="SA"/.test(entry)||
   !/configuredSaudiOrigin/.test(entry))fail("Saudi mobile remote privacy gate missing");
if(/getApiUrl|EXPO_PUBLIC_API_URL|go-bharat\.onrender\.com/.test(entry))
  fail("India API source remains in Saudi entry screen");
if(!layout.includes("<Stack.Protected guard={false}>")||!layout.includes('name="(customer)"')||
   !layout.includes('name="(vendor)"')||!layout.includes('name="payment"'))
  fail("inherited Indian routes are not blocked");
console.log("[SAUDI_MOBILE] Config and route isolation pass. Store publication is deliberately BLOCKED.");
