# Go Saudi / جو سعودي — prelaunch implementation

**Source:** copied at branch level from Go Bharat (Go Bharat `main` has not been changed).
**Current stage:** bilingual public landing + vendor enquiry and protected review-dashboard source; NOT a production Saudi e-commerce service.

## Scope implemented
- Saudi Arabic/English landing page at `/` and `/sell`; Arabic is default, RTL layout, toggle persists locally.
- Saudi-first categories/cities and client/server form validation.
- Saudi mobile canonicalization: `05XXXXXXXX` => `+9665XXXXXXXX`.
- `POST /api/saudi/seller-enquiries` saves consented leads to the existing `seller_enquiries` schema; rate limit and 24-hour duplicate suppression.
- `GET /api/saudi/market` and `GET /api/saudi/readiness`.
- Protected `/saudi-admin` seller review dashboard. Admin lists only `SAUDI_LANDING` enquiries, not Indian Go Bharat leads.
- Admin uses long random bearer token with SHA-256 digest in server environment; fails closed until configured. No token stored in page localStorage.
- Status workflow: `NEW → CONTACTED → DOCUMENTS_PENDING / UNDER_REVIEW → APPROVED / REJECTED`; changes require permitted transitions, and approval needs three manual checkboxes plus notes.
- Transactional audit event recording alongside every update; concurrent conflicting changes return HTTP 409.
- `APPROVED` is **only a seller lead review**, not a live account, storefront, payment approval, licence or tax verification.
- **Legacy Indian APIs deliberately blocked**, even read endpoints, except `/api/health`. This protects Saudi customers from INR/Razorpay/UPI logic.
- New Go Saudi Android package / iOS bundle IDs are provisional and NOT released.
- Zero live payment acceptance or promises of subscription pricing.
- Separate proposed 33% referral-policy constant; not paid or accrued in the absence of verified Saudi captured settlements.

## Vendor panel — implemented in Go Saudi branch

The Saudi-only vendor panel is available at `/vendor` (`/vendor-panel` redirects there). It is a **working, authenticated draft-store workspace**, not a public selling site. The UI supports Arabic RTL/English LTR and mobile layouts.

- After admin approves a Saudi lead, open `/saudi-admin`, select the `APPROVED` enquiry, and click **Generate seller invitation**. Code is shown only in the admin response/UI, expires after 24 hours, and invalidates prior unused invitations. Share the code only after an independent identity check, using a private verified channel; never add it to a link or public chat.
- Vendor visits `/vendor`, enters the one-time 64-hex code, and receives a **12-hour vendor-only session**. This is a temporary admin-issued invitation flow until actual Saudi OTP/MFA account login is configured.
- `/api/saudi/vendor/me` returns only that vendor's draft business profile and draft product count; business identity is read-only.
- Vendor can update store description (600 characters max), create/edit/delete own products (maximum 200 private drafts, title, description, price as integer halalas, stock). All products remain `DRAFT`; there is no public publishing endpoint.
- Orders, sales, seller payout, payments, and public product discovery are **disabled**; dashboard order counts and sales are zero because there is no live order integration.
- Admin can revoke all vendor sessions and invitations. Admin access remains protected by its separately configured secret.
- Session tokens are stored as SHA-256 hashes in the Saudi database. Vendor sessions use host-only `Secure; HttpOnly; SameSite=Strict` cookies with a 12-hour expiry; the browser cannot read a session bearer token. Mutating vendor routes require same-origin `Origin`. Implement individual merchant OTP/MFA, account recovery, device/session management and security review before full commercial launch.

### Vendor/admin API routes

| Method and route | Purpose |
|---|---|
| `POST /api/saudi/admin/vendor-invites` | Admin-protected invite, body `{"enquiryId":"SL_..."}` |
| `POST /api/saudi/admin/vendor-sessions/revoke` | Admin-protected revoke, body `{"enquiryId":"SL_..."}` |
| `POST /api/saudi/vendor/activate` | Exchange one-time invite for vendor session |
| `GET /api/saudi/vendor/me` | Vendor-only draft store profile |
| `PATCH /api/saudi/vendor/store` | Vendor-only description |
| `GET /api/saudi/vendor/products` | Vendor's own draft products |
| `POST /api/saudi/vendor/products` | Create private draft |
| `PATCH /api/saudi/vendor/products/:id` | Update own draft |
| `DELETE /api/saudi/vendor/products/:id` | Delete own draft |
| `POST /api/saudi/vendor/logout` | Revoke current vendor session |

The separate database must be initialized with `GO_SAUDI_MODE=true npm run db:saudi:migrate` (Saudi schema version **2**) to create seller enquiry/review tables, vendor accounts/invitations/sessions, product drafts and data-deletion requests. Do not run this against Go Bharat's original database.

**CI verified:** authenticated HTTP integration tests on disposable migrated PostgreSQL (vendor invitation, session cookies, tenant isolation, draft CRUD, revoke, origin/CSP restrictions). **Still not verified:** real Saudi OTP, legal review, a separate live Render service, actual merchant activation, orders or payments.


## Security hardening

- Postgres transactions prevent duplicate concurrent lead submissions from reaching admin as separate applications.
- Admin/vendor SQL errors are logged using sanitized categories only, not phone numbers, review notes or invite codes.
- First Saudi migration refuses any nonempty unmarked or mixed-market database, and is idempotent on its own marked database.
- `/api/saudi/readiness` publicly reports launch blockers and confirms commercial features remain disabled.
- Latest CI also verifies privacy-gated submission, migration mixed-DB rejection and cross-origin request blocking in production-mode smoke tests.

## Merchant privacy tools — prelaunch

- `GET /api/saudi/vendor/data-export`: authenticated vendor data download. Each session gets only its own profile and product drafts.
- `POST /api/saudi/vendor/data-requests`: seller confirms a deletion request; status is **PENDING** until approved/admin-processed.
- `GET /api/saudi/vendor/data-requests`: current vendor's request status.
- `GET /api/saudi/admin/data-requests`: private admin request queue.
- `POST /api/saudi/admin/data-requests/:id/complete`: requires admin authentication **and** explicit production configuration `GO_SAUDI_ACCOUNT_ERASURE_ENABLED=true` plus independently verified identity, retention review and exact deletion phrase. The default in Render is `false`.
- Vendor panel offers **Download my data** / **Request account deletion**. Admin panel shows review queue and stays locked until approved erasure configuration.
- Schema migration `002_data_requests.sql` upgrades the dedicated marker to version 2; run `npm run db:saudi:migrate` against a separate Saudi database, never Go Bharat. Server requires schema v2.
- CI additionally runs a disposable PostgreSQL backup/restore drill (not a production backup). Set up encrypted production backups and periodic restores before real operation.

**Privacy/compliance warning:** data exports and erasures are technical features, not substitutes for Saudi PDPL legal review, named admin MFA, consent/retention policy or signed legal signoff.

## Build and deploy

The authoritative deployment, privacy, isolated database and commercial launch gates are in [GO_SAUDI_RELEASE.md](GO_SAUDI_RELEASE.md).

Go Saudi now boots from an **isolated Saudi-only server entrypoint** (`server/saudiServer.ts`), not Go Bharat's `server/index.ts`. Run on a NEW SAUDI-ONLY PostgreSQL database:

```sh
npm ci
GO_SAUDI_MODE=true DATABASE_URL='<Saudi-only Postgres URL>' npm run db:saudi:migrate
npm run test:saudi
npm run test:revenue
npm run server:build
# Configure NODE_ENV=production, GO_SAUDI_MODE=true, DATABASE_URL,
# APP_PUBLIC_URL (HTTPS origin) and GO_SAUDI_ADMIN_TOKEN_SHA256.
npm run render:start
```

CI tests use a separate disposable PostgreSQL instance and verify the invitation, authorization, draft CRUD and revocation flow. `render:start` refuses to listen without the Saudi database marker.

**Public enquiry collection in production is CLOSED until** `GO_SAUDI_PRIVACY_APPROVED=true` is explicitly set after Saudi privacy/hosting/data transfer review. Commerce and payments stay disabled.

## Routes
- `GET /`: bilingual public preview and form
- `GET /sell`: bilingual public preview and form
- `GET /api/saudi/market`: localization/features and current status
- `GET /api/saudi/readiness`: unfulfilled launch requirements
- `POST /api/saudi/seller-enquiries`: Saudi seller lead
- `GET /api/health`: server health (requires database)
- `GET /saudi-admin`: admin login shell; no seller PII embedded
- `GET /vendor`: invitation-only merchant panel (Arabic/English)
- `GET /api/saudi/admin/seller-enquiries?status=ALL&page=1`: authenticated seller pipeline + status totals
- `GET /api/saudi/admin/seller-enquiries/:id/events`: authenticated audit history
- `PATCH /api/saudi/admin/seller-enquiries/:id`: authenticated transition with `{status,note,checks}`
- All legacy India-only commerce APIs: blocked during prelaunch


## Admin onboarding setup (preview only)

**Do not enable real public seller data collection until Saudi privacy, business, hosting and access-control review.** The page shell is viewable but seller data requires a strong secret. Provision a **new empty, isolated Saudi PostgreSQL database**; use `GO_SAUDI_MODE=true npm run db:saudi:migrate` to apply the dedicated migration, never generic `db:push`.

Create a unique high-entropy random admin token and its SHA-256 digest *on your own trusted machine*:

```sh
node -e "const c=require('crypto');const t=c.randomBytes(32).toString('hex');console.log('PRIVATE_ADMIN_TOKEN='+t);console.log('GO_SAUDI_ADMIN_TOKEN_SHA256='+c.createHash('sha256').update(t).digest('hex'))"
```

Set the **digest only** as Render secret `GO_SAUDI_ADMIN_TOKEN_SHA256`. Keep `PRIVATE_ADMIN_TOKEN` in a trusted password manager, never in GitHub, Slack, URL parameters or browser localStorage. The isolated Saudi server does not use Go Bharat's JWT auth; do not reuse India's JWT secret. Optional `GO_SAUDI_ADMIN_REVIEWER` is an audit label for this single-admin preview.

Visit `https://YOUR-SA-RENDER-HOST/saudi-admin`, paste the private admin token, select a lead and update its status. Read/list/review requests have `Authorization: Bearer <token>`, `Cache-Control: no-store` and rate limiting. The UI stores token only in JS memory until page close or logout. No SMS OTP or vendor account is created by this review tool.

### Approval review rules
- Initial enquiry is `NEW`, submitted through `/sell` and saved as `SAUDI_LANDING`.
- `NEW` can move only to `CONTACTED` or `REJECTED`.
- After contact: request documents or move to under review.
- To reach `APPROVED`, reviewer must confirm contact, eligible business documents and compliance review; write a review note of 10–1000 characters.
- Rejected leads require a reason; may reopen to contacted.
- Every transition is stored in `saudi_seller_review_events` within the same database transaction as the status update.
- The dashboard never stores identity documents or merchant bank credentials.

### Security limits
This is a **single-admin prelaunch implementation**, not full workforce authentication. Before handling real seller data at scale, replace the shared admin token with individual user accounts, MFA, granular RBAC, reviewer identity audit and credential rotation. Implement an approved Saudi privacy notice and deletion/retention controls, verify lawful transfers/data residency, and perform external security testing. Do not activate sales just because a lead shows `APPROVED`.

## Launch gate / unresolved work
1. Separate new GitHub repository **go-saudi** (currently a development branch of Go Bharat).
2. Localize remaining customer/delivery/marketing/franchise screens and backend for Saudi; the vendor draft web workspace is implemented, but the inherited Expo native screens are not Saudi-ready.
3. Replace temporary admin-issued vendor invite with genuine phone OTP for +966, vendor/admin account recovery, individual admin identities, MFA/RBAC, SMS gateway, anti-abuse and account deletion.
4. Replace GST/PAN/IFSC/UPI/INR/Razorpay/PhonePe with Saudi CR/verification, IBAN, tax information, SAR/halalas, mada + licensed PSP. Avoid handling or routing merchants' funds directly without legal/PSP review.
5. Country-specific VAT (standard rate currently 15% where applicable), ZATCA invoices, VAT registration, refunds and official seller terms.
6. Saudi Business Center store verification and entity/bank-account requirements, PDPL privacy documents, lawful Saudi personal-data hosting/transfer assessment.
7. Dedicated production database, data residency review, compliance signoff, payment signature/idempotency/settlement tests, Arabic accessibility review and Android/iOS brand assets.
8. Live payment activation only after PSP merchant onboarding, verified webhook settlement and explicit approval.

## Caveats
- Inherited Expo screens/assets still contain Go Bharat/India concepts; intentionally **not** presented as completed Saudi app.
- Prelaunch seller enquiry data requires a reviewed Saudi privacy notice, retention/deletion policy and secure admin access before public collection of seller PII.
- This work does not create a new GitHub repository, provision cloud infrastructure, run an app-store build, or activate payment flows.
- Never reuse India's EAS project ID or release package ID. New app icon and splash are required.

Official references:
- https://mc.gov.sa/en/mediacenter/News/Pages/03-09-23-01.aspx
- https://www.sama.gov.sa/en-US/payment/Pages/mada.aspx
- https://www.rulebook.sama.gov.sa/en/rules-dealing-e-commerce-payment-service-and-support-providers
- https://zatca.gov.sa/en/eServices/Pages/eServices-002.aspx
- https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx
