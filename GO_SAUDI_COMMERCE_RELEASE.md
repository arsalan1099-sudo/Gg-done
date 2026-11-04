# Go Saudi — Real Commerce Release Gates (4 November 2026)

**Commercial release: BLOCKED.** This document distinguishes *implemented technical APIs* from a legally/operationally live Saudi marketplace. Never call Go Saudi production ready, collect real payments or advertise confirmed bookings on the strength of a test or environment flag alone.

## 4 November 2026 — signed Moyasar webhook inbox, schema v6

- Added `POST /api/saudi/payments/webhook` to accept only a valid, long operator-configured Moyasar `secret_token`, using constant-time token comparison. `MOYASAR_WEBHOOK_SECRET_TOKEN` must be configured via the dedicated Saudi service environment, never committed or shared in chat.
- Each accepted live payment callback stores only event ID, type, payment reference, optional order reference, live flag and receipt time in `saudi_moyasar_webhook_events`. Duplicate event IDs return an acknowledged duplicate; raw payment payload, card data and secrets are not persisted. A failed database insert returns a retryable error.
- **A webhook is NOT payment confirmation**. Inbound events remain `RECEIVED` until a separately approved provider-side reconciliation worker is implemented and tested. The customer-owned `/reconcile` route is presently the only path that marks an order paid and must re-fetch and verify the payment with the Moyasar secret key.
- `GO_SAUDI_PAYMENT_WEBHOOK_READY` and all commercial gates remain **false**. Do not mark that gate true just because the receipt endpoint exists. Webhook processing, retries, settlement reconciliation, refund automation, anomaly alerts and recovery from provider timeouts remain release blockers.
- Added migration `006_moyasar_webhook_inbox.sql`; the isolated Saudi DB marker is now `schema_version=6`. Apply 001–006 to a newly created Saudi database, never the shared Go Bharat one. Run the CI backup/restore drill before a release.
- Once a separate Saudi service/domain is deployed, configure a dedicated webhook in the Moyasar merchant dashboard (Settings → Webhooks) pointing to `https://<your-saudi-domain>/api/saudi/payments/webhook`, with a strong secret and approved live events. Until a real domain and account are verified this remains **not configured**.

## Implemented in go-saudi branch (source only)

1. **Saudi schema v6:** `migrations/saudi/005_customer_commerce.sql` extends a **dedicated, isolated** Saudi Postgres v4 database through migrations 005–006 with OTP-verified customer accounts (encrypted +966 phones), hash-only sessions, one-merchant orders, immutable line-item snapshots and manual booking requests. No Go Bharat production DB/table is reused. Start requires marker `schema_version=6` (run `GO_SAUDI_MODE=true npm run db:saudi:migrate` ONLY against an isolated Saudi DB).
2. **Saudi customer auth:** `POST /api/saudi/customer/otp/start`, `POST /api/saudi/customer/otp/verify`, `GET /api/saudi/customer/me`, `POST /api/saudi/customer/logout`. Twilio Verify provider results must actually say pending/approved; session is Secure + HttpOnly + SameSite=Strict. No made-up or static OTP. OTP sends are forbidden until privacy, Saudi e-store and customer data-rights signoff.
3. **Authoritative checkout:** `POST /api/saudi/checkout/quote` calculates SAR halalas from database-approved merchant/product price and stock, not any client price. Max 20 unique lines, one merchant, bounded total.
4. **Protected orders:** `POST /api/saudi/orders` creates time-limited, pickup-only `PENDING_PAYMENT` records, with idempotency keys, ONLY after all compliance and live-payment readiness gates. No fake success or stock reservation is implied.
5. **Moyasar adapter:** `POST /api/saudi/orders/:id/payment-intent` can initiate a server-priced Moyasar Payment Intent using a **server-side** secret key. Never sends raw card PAN/CVV through Go Saudi. A provider timeout locks that order against duplicate payment-intent attempts.
6. **Reconciliation:** `POST /api/saudi/orders/:id/reconcile` fetches a payment over server-side authenticated Moyasar API and requires `paid`, correct amount/currency and matching order metadata. Claiming `paid` in a browser redirect is not enough. Inventory is decremented transactionally only after payment verifies. If payment arrived late or stock is unavailable, state becomes `REFUND_PENDING` and fulfilment is blocked. **Refund automation and operational event processing are NOT complete.**
7. **Booking requests:** `POST /api/saudi/bookings`, `GET /api/saudi/bookings`, `GET /api/saudi/vendor/bookings`, `PATCH /api/saudi/vendor/bookings/:id`. Only limited eligible local service types, customer OTP auth, and manually approved vendor decisions. Request status is **not guaranteed availability**. No travel, Hajj/Umrah, employment, health, financial, insurance or other regulated reservations enabled.
8. **Readiness check:** `GET /api/saudi/commerce/readiness` reports blocked gates without revealing provider secret values.
9. **CI:** unit tests cover untrusted carts, SAR math, payer/merchant ownership conditions, OTP inputs, payment status and merchant metadata mismatch, encrypted customer identifiers, booking UTC scheduling. A disposable-PostgreSQL end-to-end test simulates Twilio and Moyasar **without sending messages or charging customers**; confirm its GitHub Actions result before release.

## Real live activation — ALL required independently

- **Saudi entity/store:** Verify the seller/business commercial record or eligible professional documentation, verified e-store via Saudi Business Center, and business-linked bank account. Establish whether AASAA's current India entity can legally operate locally. Do not use an Indian personal bank account for Saudi settlements.
- **Privacy & identity:** Approved Arabic and English customer terms/privacy, data processor and hosting/transfers assessment, customer access/deletion/retention program, genuine Saudi SMS verification, named staff MFA, anti-fraud/anti-SMS-abuse.
- **PSP:** Go Saudi's OWN approved Saudi Moyasar merchant account, approved merchant settlement/split rules, PCI-safe hosted payment form, domain ownership verification (Apple Pay if used), signed or secret-verified webhook receiving and durable/idempotent processing, reconciliation/alerts, chargebacks, refund and support runbooks.
- **Tax & logistics:** ZATCA-applicable VAT and compliant Arabic electronic invoicing, appropriate fulfilment capability (only pickup initially), cancellation/refunds, booking availability and confirmation policy, regulated category and merchant licence checks.
- **Production infrastructure:** New isolated Saudi database, separate Render web service pinned to `go-saudi` branch and release commit, approved data residency and backup policy, least privilege, secrets stored in Render env (not GitHub), encrypted backups/restore tests, real devices and payment sandbox end-to-end tests.
- **Customer experience:** Production Saudi HTTPS backend, real mobile login and checkout screens, secure hosted Moyasar payment page and callback/restore UX, order/refund status and support. The currently installed APK still uses a **clearly labeled DEMO cart**. A signed iOS/Android release must be built and tested after this is implemented.

**Never set the live flags merely to make a status widget green.** `render.yaml` currently defaults every commerce switch to `false`; provider keys are `sync:false` and have NOT been provisioned. No Saudi production service or separate database was discovered in Render's connected My Workspace when checked on 4 Nov 2026. The only Render database found was Go Bharat's existing free database expiring 17 Nov 2026; DO NOT share that database with Saudi.

### Environment variables (all disabled by default)
`GO_SAUDI_ORDERS_ENABLED`, `GO_SAUDI_PAYMENTS_ENABLED`, `GO_SAUDI_BOOKINGS_ENABLED`, `GO_SAUDI_LIVE_CHARGES_APPROVED`, `GO_SAUDI_PRIVACY_APPROVED`, `GO_SAUDI_CUSTOMER_OTP_ENABLED`, `GO_SAUDI_CUSTOMER_DATA_RIGHTS_READY`, `GO_SAUDI_ESTORE_VERIFIED`, `GO_SAUDI_MARKETPLACE_LAUNCH_APPROVED`, `GO_SAUDI_CATALOG_PUBLIC`, `GO_SAUDI_MERCHANT_VERIFICATION_APPROVED`, `GO_SAUDI_FULFILLMENT_READY`, `GO_SAUDI_ZATCA_READY`, `GO_SAUDI_REFUNDS_READY`, `GO_SAUDI_SETTLEMENT_RECONCILIATION_READY`, `GO_SAUDI_PAYMENT_WEBHOOK_READY`, `GO_SAUDI_VENDOR_SETTLEMENT_READY`, `GO_SAUDI_REGULATED_CATEGORY_REVIEW_READY`, `GO_SAUDI_ORDER_OPERATIONAL_TESTS_PASSED`, `GO_SAUDI_SERVICE_BOOKINGS_LICENSED`.

**Server-only secrets:** `MOYASAR_SECRET_KEY` (live `sk_live_`), `MOYASAR_PUBLISHABLE_KEY` (live `pk_live_`), `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_ACCOUNT_SID`, `GO_SAUDI_CUSTOMER_ENCRYPTION_KEY` (32 random bytes represented as 64 hex characters), `DATABASE_URL`, `APP_PUBLIC_URL`. Never send them into a chat message, the repository or a public mobile binary.

## External official documentation

- Saudi e-store verification: https://mc.gov.sa/en/mediacenter/News/Pages/03-09-23-01.aspx
- Moyasar payment intents: https://docs.moyasar.com/guides/payment-intents/create-an-intent
- Moyasar payment status confirmation: https://docs.moyasar.com/guides/card-payments/min-integration
- Moyasar webhooks: https://docs.moyasar.com/api/other/webhooks/webhook-reference
- Twilio Verify: https://www.twilio.com/docs/verify/api
- Saudi ZATCA e-invoicing: https://www.zatca.gov.sa/en/E-Invoicing/Introduction/FAQ/Pages/default.aspx

This is a **tested engineering foundation**, not a financial launch approval or evidence of real funds being collected.
