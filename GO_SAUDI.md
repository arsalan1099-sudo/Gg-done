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

## Running locally
```sh
git checkout go-saudi
npm ci
npm run test:saudi
npm run test:revenue
npm run server:build
npx expo export --platform web --output-dir static-build
# Provision a NEW, ISOLATED PostgreSQL database and apply schema:
DATABASE_URL='postgres://...' npm run db:push
DATABASE_URL='postgres://...' JWT_SECRET='long-random-secret' GO_SAUDI_ADMIN_TOKEN_SHA256='<sha256-digest>' npm run render:start
```
Never use Go Bharat's production DATABASE_URL for Saudi testing.

## Routes
- `GET /`: bilingual public preview and form
- `GET /sell`: bilingual public preview and form
- `GET /api/saudi/market`: localization/features and current status
- `GET /api/saudi/readiness`: unfulfilled launch requirements
- `POST /api/saudi/seller-enquiries`: Saudi seller lead
- `GET /api/health`: server health (requires database)
- `GET /saudi-admin`: admin login shell; no seller PII embedded
- `GET /api/saudi/admin/seller-enquiries?status=ALL&page=1`: authenticated seller pipeline + status totals
- `GET /api/saudi/admin/seller-enquiries/:id/events`: authenticated audit history
- `PATCH /api/saudi/admin/seller-enquiries/:id`: authenticated transition with `{status,note,checks}`
- All legacy India-only commerce APIs: blocked during prelaunch


## Admin onboarding setup (preview only)

**Do not make the admin dashboard public until Saudi privacy, business, hosting and access-control review.** The page shell is viewable but seller data requires a strong secret. Provision a **separate Saudi PostgreSQL database**; run `npm run db:push` against *that database only* to create the `saudi_seller_review_events` table and original seller enquiry table.

Create a unique high-entropy random admin token and its SHA-256 digest *on your own trusted machine*:

```sh
node -e "const c=require('crypto');const t=c.randomBytes(32).toString('hex');console.log('PRIVATE_ADMIN_TOKEN='+t);console.log('GO_SAUDI_ADMIN_TOKEN_SHA256='+c.createHash('sha256').update(t).digest('hex'))"
```

Set the **digest only** as Render secret `GO_SAUDI_ADMIN_TOKEN_SHA256`. Keep `PRIVATE_ADMIN_TOKEN` in a trusted password manager, never in GitHub, Slack, URL parameters or browser localStorage. Set `JWT_SECRET` as an independent random server secret (inherited app startup requires it). Optional `GO_SAUDI_ADMIN_REVIEWER` is an audit label for this single-admin preview.

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
This is a **single-admin prelaunch prototype**, not full workforce authentication. Before handling real seller data at scale, replace the shared admin token with individual user accounts, MFA, granular RBAC, reviewer identity audit and credential rotation. Implement an approved Saudi privacy notice and deletion/retention controls, verify lawful transfers/data residency, and perform external security testing. Do not activate sales just because a lead shows `APPROVED`.

## Launch gate / unresolved work
1. Separate new GitHub repository **go-saudi** (currently a development branch of Go Bharat).
2. Localize all customer/vendor/admin/delivery/marketing/franchise product screens and backend for Saudi (the inherited Expo screens are not Saudi-ready).
3. Implement genuine phone OTP for +966, individual admin identities, MFA/RBAC, SMS gateway, anti-abuse and account deletion.
4. Replace GST/PAN/IFSC/UPI/INR/Razorpay/PhonePe with Saudi CR/verification, IBAN, tax information, SAR/halalas, mada + licensed PSP. Avoid handling or routing merchants' funds directly without legal/PSP review.
5. Country-specific VAT (standard rate currently 15% where applicable), ZATCA invoices, VAT registration, refunds and official seller terms.
6. Saudi Business Center store verification and entity/bank-account requirements, PDPL privacy documents, lawful Saudi personal-data hosting/transfer assessment.
7. Dedicated production database, data residency review, compliance signoff, payment signature/idempotency/settlement tests, Arabic accessibility review and Android/iOS brand assets.
8. Live payment activation only after PSP merchant onboarding, verified webhook settlement and explicit approval.

## Caveats
- Inherited Expo screens/assets still contain Go Bharat/India concepts; intentionally **not** presented as completed Saudi app.
- Prelaunch seller enquiry data requires a reviewed Saudi privacy notice, retention/deletion policy and secure admin access before public deployment.
- This work does not create a new GitHub repository, provision cloud infrastructure, run an app-store build, or activate payment flows.
- Never reuse India's EAS project ID or release package ID. New app icon and splash are required.

Official references:
- https://mc.gov.sa/en/mediacenter/News/Pages/03-09-23-01.aspx
- https://www.sama.gov.sa/en-US/payment/Pages/mada.aspx
- https://www.rulebook.sama.gov.sa/en/rules-dealing-e-commerce-payment-service-and-support-providers
- https://zatca.gov.sa/en/eServices/Pages/eServices-002.aspx
- https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx
