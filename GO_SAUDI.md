# Go Saudi / جو سعودي — prelaunch implementation

**Source:** copied at branch level from Go Bharat (Go Bharat `main` has not been changed).
**Current stage:** functional landing and seller-interest API source; NOT a production Saudi e-commerce service.

## Scope implemented
- Saudi Arabic/English landing page at `/` and `/sell`; Arabic is default, RTL layout, toggle persists locally.
- Saudi-first categories/cities and client/server form validation.
- Saudi mobile canonicalization: `05XXXXXXXX` => `+9665XXXXXXXX`.
- `POST /api/saudi/seller-enquiries` saves consented leads to the existing `seller_enquiries` schema; rate limit and 24-hour duplicate suppression.
- `GET /api/saudi/market` and `GET /api/saudi/readiness`.
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
DATABASE_URL='postgres://...' npm run render:start
```
Never use Go Bharat's production DATABASE_URL for Saudi testing.

## Routes
- `GET /`: bilingual public preview and form
- `GET /sell`: bilingual public preview and form
- `GET /api/saudi/market`: localization/features and current status
- `GET /api/saudi/readiness`: unfulfilled launch requirements
- `POST /api/saudi/seller-enquiries`: Saudi seller lead
- `GET /api/health`: server health (requires database)
- All legacy India-only commerce APIs: blocked during prelaunch

## Launch gate / unresolved work
1. Separate new GitHub repository **go-saudi** (currently a development branch of Go Bharat).
2. Localize all customer/vendor/admin/delivery/marketing/franchise product screens and backend for Saudi (the inherited Expo screens are not Saudi-ready).
3. Implement genuine phone OTP for +966, RBAC, SMS gateway, anti-abuse and account deletion.
4. Replace GST/PAN/IFSC/UPI/INR/Razorpay/PhonePe with Saudi CR/verification, IBAN, tax information, SAR/halalas, mada + licensed PSP. Avoid handling or routing merchants' funds directly without legal/PSP review.
5. Country-specific VAT (standard rate currently 15% where applicable), ZATCA invoices, VAT registration, refunds and official seller terms.
6. Saudi Business Center store verification and entity/bank-account requirements, PDPL privacy documents, lawful Saudi personal-data hosting/transfer assessment.
7. Dedicated production database, data residency review, compliance signoff, payment signature/idempotency/settlement tests, Arabic accessibility review and Android/iOS brand assets.
8. Live payment activation only after PSP merchant onboarding, verified webhook settlement and explicit approval.

## Caveats
- Inherited Expo screens/assets still contain Go Bharat/India concepts; intentionally **not** presented as completed Saudi app.
- Prelaunch seller enquiry data requires a lawful privacy notice and secure admin access before public deployment.
- This work does not create a new GitHub repository, provision cloud infrastructure, run an app-store build, or activate payment flows.
- Never reuse India's EAS project ID or release package ID. New app icon and splash are required.

Official references:
- https://mc.gov.sa/en/mediacenter/News/Pages/03-09-23-01.aspx
- https://www.sama.gov.sa/en-US/payment/Pages/mada.aspx
- https://www.rulebook.sama.gov.sa/en/rules-dealing-e-commerce-payment-service-and-support-providers
- https://zatca.gov.sa/en/eServices/Pages/eServices-002.aspx
- https://sdaia.gov.sa/en/SDAIA/about/Pages/RegulationsAndPolicies.aspx
