## 6 November 2026 — v0.2.1 premium category UI refinement

The native `All Categories` screen now follows the selected emerald-and-gold reference:
a centered bilingual title, compact ornament, full-width subcategory search,
five legible main-category cards, one selected emerald card, a separate
scrollable subcategory column, and consistent gold/ivory card treatment.
Arabic main-category cards use right-to-left icon/text layout. All 109
subcategories retain exact filters and English/Arabic labels. The two panels
have a bounded height so bottom navigation is accessible and lists do not
become an endlessly tall page. Go Saudi branding and launcher icon remain
independent of Go Bharat.

This is a **UI change**, not a commercial launch or signed Play Store release.
Live seller verification, orders, bookings and payments remain subject to the
existing Saudi compliance gates. To install this UI, build and verify Android
version `0.2.1` (versionCode `3`) from the go-saudi APK workflow; the
existing v0.2.0 APK will not update itself.

**Customer/mobile live checkout is not integrated.** Refer to [GO_SAUDI_COMMERCE_RELEASE.md](GO_SAUDI_COMMERCE_RELEASE.md) for order, OTP and payment infrastructure status.\n\n# Go Saudi — Android & iOS publishing gate (2 November 2026)

**Current decision: NOT APPROVED FOR STORE SUBMISSION.** Do not upload or release the currently available prelaunch native app to Google Play or Apple App Store. It does not yet implement customer orders, payments, shipping or signed-in seller operations inside the native app. No signed AAB/IPA, live Saudi production backend, device tests or new-store registration have been verified.

## 4 November 2026 — offline test checkout enabled; live commercial transactions OFF

- In `SaudiShop` the demo cart can now create a **local TEST_ONLY receipt** after explicit confirmation. It is saved only in this device's AsyncStorage. The cart is cleared after a successful receipt save; test-order history and clear-history action are available from the cart.
- The receipts have `paymentCaptured=false`, `serverOrderId=null`, `deliveryScheduled=false`, and are conspicuously marked DEMO. No phone, identity, address or payment details are entered or sent.
- Real customer orders, vendor notifications, inventory reservations, travel bookings, shipping and live payments remain **disabled**. Even a verified public product catalog alone cannot activate checkout.
- A new signed standalone APK is required to see this UI. This source edit is not an over-the-air update. Follow the current go-saudi APK GitHub workflow; install only the verified signed artifact from a successful run.
- Production launch still requires a separately deployed Saudi service/database, verified seller/customer identities, the necessary licences/consent, a Saudi-supporting PSP with server-side order/payment reconciliation, taxes/refunds/delivery handling and audited release signoff.

## 4 November 2026 — Go Bharat-style Saudi category explorer

- Implemented the same **five primary groups** found in Go Bharat's `lib/data.ts`: B2B, B2C, Services, Manpower and Travel.
- Curated **109 subcategories** from the Go Bharat taxonomy with bilingual Arabic/English labels and Saudi-appropriate naming (e.g. dates/coffee, oud/incense, Hajj/Umrah). No regulated trading, staffing, travel booking or checkout was enabled merely by adding categories.
- Added the `All Categories` bottom tab, five main-group cards on the shop home, Go Bharat-inspired sidebar category explorer, 2-column subcategory cards, searchable subcategory names, and exact product filtering.
- Demo products now carry explicit subcategory IDs. Legacy products without IDs can still appear at main-group level, but are not inaccurately placed in a specific subcategory.
- New public `GET /api/saudi/categories` serves localized taxonomy. Vendor product forms select main category and subcategory; submissions preserve a reviewed snapshot of the classification. Moderation/public catalog can return and filter by exact subcategory.
- Dedicated Saudi database migration **004** adds nullable `subcategory_id` columns and upgrades the isolated marker to `schema_version=4`. Current Saudi server additionally requires migration 005; live deployment requires all applicable migrations, real vendor identity, privacy approval, and operational validation.
- Tests cover taxonomy count/uniqueness, product subcategory validation, strict filtering and public catalog endpoint behavior. New Android APK requires fresh native compilation: earlier installed APKs cannot update themselves.

## 3 November 2026 — working catalog and cart preview

The original mobile screenshots showed an inert landing page and a disabled seller registration form. The native Saudi home now defaults to an interactive **Shop** view, with Arabic/English switching, live Saudi catalog fetch (when lawfully enabled), city/category filters, search, product details, a local wishlist, and a persistent local cart with stock caps and SAR/halalas totals.

With no approved Saudi HTTPS backend, the app shows eight **clearly labeled DEMO products**. These are illustrative, not real merchants or purchasable items. The cart only prepares a local selection; checkout cannot charge customers, place orders, reserve inventory or notify merchants. The previous seller-interest form is available through the Sell action and stays closed without the actual Saudi privacy gate.

Migration 003 adds `saudi_catalog_submissions` (current full schema version is **5**): approved vendors can request moderation of private draft product snapshots; admins can review/reject in the Saudi admin dashboard. Even `APPROVED` records are NOT public unless **all** of `GO_SAUDI_PRIVACY_APPROVED=true`, `GO_SAUDI_CATALOG_PUBLIC=true`, and `GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED=true` are set after approvals. Catalog moderation approval itself also requires `GO_SAUDI_MERCHANT_VERIFICATION_APPROVED=true`. All these new flags default to false in Render.

The new GET `/api/saudi/catalog` returns a bounded, PII-free seller-verified product listing only when permitted. It explicitly returns `checkoutEnabled:false` until a separate lawful transaction and payment architecture is built. CI tests cover moderation, catalog visibility/permissions, draft isolation, and cart arithmetic. Real device and signed-store build tests remain outstanding.

**Still missing for full functionality:** live Saudi HTTPS environment, genuine Saudi customer/mobile authentication, customer address management and privacy handling, order orchestration and stock reservation, supplier fulfilment, shipping, refunds, disputes, regulated PSP/payment settlement, VAT invoicing, merchant verification, and actual app-store approval. Do not market the preview as a finished working marketplace.

## Implemented this pass

- Saudi package/bundle IDs (provisional, ownership must be verified): `com.aasaa.gosaudi`.
- `eas.json` preview/production builds no longer target the Indian Go Bharat Render domain. `EXPO_PUBLIC_SAUDI_API_URL` defaults to blank and native submission fails closed.
- Native `app/index.tsx` checks that an **HTTPS**, non-Go Bharat backend returns `country=SA`, `currency=SAR`, `status=PRELAUNCH`, `sellerEnquiriesOpen=true` and `paymentsEnabled=false` before it can transmit a consented seller enquiry. The form is disabled otherwise.
- `app/_layout.tsx` protects every inherited Go Bharat customer/vendor/payment/admin/delivery deep-link route and shows only the Saudi native prelaunch screen. This is client-side navigation isolation, **not a substitute for removing old code before full store launch**.
- Removed old location/contacts/camera/microphone permissions and incompatible app-privacy claims from the prelaunch app configuration; maintain accurate Play Data Safety and Apple App Privacy disclosures when real features change.
- `npm run test:saudi:mobile` validates Saudi IDs, stage, permission reductions, no Indian EAS backend, route isolation, and that store submission is marked NOT approved.
- CI exports **unsigned Expo bundles** for Android/iOS/web as a technical bundling check. Passing export is *not* equivalent to an .aab/.ipa, signing, store review or real device acceptance.
- Android uses Expo SDK 54; Expo documentation states its default `targetSdkVersion` is API **36**. Verify the actual compiled AndroidManifest after building the final .aab.
- Android EAS `production` specifies `app-bundle`; `eas submit` production preset targets internal testing as a draft, not an automatic consumer release.

## Google Play launch checklist (all must be completed before submission)

1. Confirm a Google Play Console developer account with permission to create a **new, distinct Go Saudi app**; do not overwrite Go Bharat's existing package or signing keys.
2. Finish Saudi merchant/customer flows as appropriate. App must have meaningful utility beyond a passive landing page, and complete accessible app account deletion where account creation is supported.
3. Deploy Saudi-only HTTPS backend and review privacy/PDPL, consent, account erasure, support, and data retention. Set an approved `EXPO_PUBLIC_SAUDI_API_URL` only after verification and redeploy/rebuild.
4. Supply Go Saudi original icon, splash, phone screenshots captured on real working devices, store listing in Arabic/English, content rating, age targeting, Data Safety, and stable privacy-policy and account-deletion URLs.
5. Verify final compileSdk/targetSdk **API 36+**, Play App Signing configuration, Android package ownership, no unnecessary dangerous permissions, test on actual Android 14–16 devices, Play policy checklist.
6. After successful QA, bind a new Expo/EAS project and configure upload-key credentials through Expo securely. Do not commit keystores or service-account JSON.
7. Build and verify actual signed release:
   `eas build --platform android --profile production`
   Then inspect .aab manifest/signing certificate and upload it through the Play Console or an authorized EAS Submit connection to **internal testing**, not production. Complete applicable testing requirements, then request production review.

## Apple App Store launch checklist

1. Confirm active Apple Developer Program membership, App Store Connect team and permission to register **new** bundle ID `com.aasaa.gosaudi`; the existing Go Bharat iOS project is unrelated.
2. Provide a meaningful fully working native experience; Apple's 4.2 minimum functionality and 2.1 completeness rules block static prelaunch/website wrapper submissions.
3. Make accurate App Privacy disclosures, Arabic/English listing, compliant privacy/support URLs, account deletion workflows, reviewer credentials/demo (if login required), iPhone screenshots from final running app, and clear Saudi availability/pricing terms.
4. Configure new Expo EAS project, Apple distribution signing and App Store Connect API key securely, verify certificate/team and iOS build number.
5. On a finished, reviewed production branch:
   `eas build --platform ios --profile production`
   Verify signed IPA on real iPhone; `eas submit --platform ios --profile production` uploads to App Store Connect/TestFlight once store credentials and app ID exist. Then request App Review explicitly in App Store Connect. No automatic publication is implied.

## Release stop conditions

- `APP_PUBLIC_URL` / `DATABASE_URL` for Go Saudi production has not been deployed, privacy approval flag is OFF, and mobile `EXPO_PUBLIC_SAUDI_API_URL` is deliberately empty.
- Saudi identity OTP and merchant verification, buying, product search, orders, payments, refunds and invoices remain inactive. Vendor prelaunch draft portal exists on web only.
- Original Saudi assets and actual device screenshots have not been approved/verified.
- No App Store Connect ID, Expo EAS project ID, Google Play service-account release authorization or signing certificates are present/verified for Go Saudi.
- App store submissions would misrepresent current functionality; **both store submissions are blocked** until completion.

## Evidence links

- Expo SDK API targets: https://docs.expo.dev/versions/v54.0.0/
- Google target API requirement: https://support.google.com/googleplay/android-developer/answer/11926878
- Google app functionality: https://support.google.com/googleplay/android-developer/answer/9898783
- Apple app review: https://developer.apple.com/app-store/review/guidelines/
- EAS Android: https://docs.expo.dev/submit/android/
- EAS iOS: https://docs.expo.dev/submit/ios/
- User data/account deletion: https://support.google.com/googleplay/android-developer/answer/10144311

**Privacy:** Never commit Expo tokens, keystores, Play Console service-account JSON, App Store Connect private keys or certificates. Do not transfer Go Bharat's Indian seller database to Saudi servers without review.
