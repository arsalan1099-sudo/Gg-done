# Go Saudi — vendor prelaunch production release gate

**Scope:** Saudi web vendor/admin prelaunch only. NOT a complete Saudi production marketplace, payment processor, native app or general commercial launch.

## Implementation at this commit
- Dedicated `server/saudiServer.ts` entrypoint. No legacy Go Bharat route registration, finance/payment modules, background jobs, homepage or admin pages.
- Saudi-only PostgreSQL schema at `migrations/saudi/001_init.sql` with dedicated `saudi_market_metadata` marker; startup refuses a database without the marker. The migration aborts if common Go Bharat legacy tables are detected.
- Vendor sessions in `Secure; HttpOnly; SameSite=Strict` host-only cookies; no JavaScript-readable bearer token, browser storage, payment acceptance or published product API.
- Strict same-origin checks for session-cookie mutations; default CORS closed; content-security-policy script hashes for three HTML pages.
- Scoped vendor draft CRUD with serialized per-vendor product-count limit and SQL price/stock constraints; one-time hashed invitation and revocable sessions.
- Admin approve/reject audit history and invite/revoke. Approval is a manual attestation, NOT independent CR or bank validation.
- Public seller enquiry submission **defaults to closed in production** unless `GO_SAUDI_PRIVACY_APPROVED=true` is explicitly set after signed privacy/data transfer review.
- `GO_SAUDI_MODE=true`, `APP_PUBLIC_URL` HTTPS origin, `GO_SAUDI_ADMIN_TOKEN_SHA256`, independent Saudi `DATABASE_URL` and DB schema marker required.

## November 2026 engineering hardening

The Saudi branch now additionally implements:
- Seller enquiry de-duplication under a Postgres advisory transaction lock, tested with concurrent HTTP submissions.
- Privacy-safe error logging for admin, seller lead and vendor routes: SQL/driver messages, phone numbers, invitation codes and merchant notes are never written to production logs.
- Migration guard: refuses any unmarked *nonempty* database and any unexpected table/version in a marked Saudi database. CI adds an actual mixed-market rejection and clean-rerun test.
- Public `/api/saudi/readiness` flags explicitly report that commercial launch, public products, orders and payments are OFF, with no raw secrets.
- Production-mode smoke verifies: seller personal-data submissions return 503 without signed privacy approval; cross-origin activation returns 403; India commerce API stays disabled; private draft portal serves independently.

### Shipping decision

| Release target | Gate |
|---|---|
| Source-controlled Saudi private draft onboarding preview | CI tests and production-mode smoke must pass; requires new isolated DB to deploy |
| Public Saudi vendor lead collection | BLOCKED pending Saudi privacy, hosting/transfer signoff and approved notices; `GO_SAUDI_PRIVACY_APPROVED` stays false |
| Real seller login at scale | BLOCKED pending Saudi OTP, individual identities, recovery and admin MFA |
| Live public marketplace / checkout | BLOCKED pending legal merchant/e-store validation, PSP/mada, invoices, delivery, refunds, buyer terms and end-to-end external security tests |

Never use the existing Go Bharat Render service or GitHub `main` branch for this pilot. Confirm workspace before any Render service creation, and use private trusted channels for credentials.

## Vendor personal-data rights and database recovery (schema v002)

- `migrations/saudi/002_data_requests.sql` updates the dedicated Saudi database marker to **schema version 2**. New deployments and upgrades must run `GO_SAUDI_MODE=true npm run db:saudi:migrate` with the **Saudi-only** database. The boot process now refuses older schemas.
- Logged-in sellers can download their own contact, store profile and private product draft data from `GET /api/saudi/vendor/data-export`. This is a sensitive personal-data export; send only over HTTPS and store local downloaded copies securely.
- Sellers can submit a **pending** deletion request via `POST /api/saudi/vendor/data-requests` with `{"requestType":"DELETE_ACCOUNT","confirm":true}`. Repeated requests are deduplicated. The admin can review pending requests in `/saudi-admin`.
- **No erasure by default.** `GO_SAUDI_ACCOUNT_ERASURE_ENABLED=false` in Render. Only after an approved retention/legal policy, an independently verified merchant identity, and an explicit operator decision should the setting temporarily be enabled for the authenticated admin request-completion action.
- Completing a deletion with two manual attestations and exact confirmation deletes the seller lead, vendor account, draft products, invitations, sessions and onboarding review history transactionally through database FK cascades. A minimal anonymous completed-request receipt remains. This feature has been exercised only in disposable CI, not on real users.
- CI performs a **custom-format PostgreSQL export and full restore into a separate test database**, checks schema version and restored records. This is not a real production backup. Configure encrypted scheduled production backups, off-site storage, least-privilege access and documented periodic restore tests separately.

**Before real users:** specify request-response deadlines and lawful-retention exceptions in the approved Arabic/English privacy policy; implement secure support and named reviewer identity. Do not treat an anonymous test deletion receipt as a comprehensive compliance audit.

## Required checks — dev/CI

```sh
npm ci
GO_SAUDI_MODE=true DATABASE_URL='postgresql://<SAUDI_DB>' npm run db:saudi:migrate
npm run test:saudi
npm run test:revenue
GO_SAUDI_MODE=true DATABASE_URL='postgresql://<SAUDI_TEST_DB>' npm run test:saudi:integration
npm run server:build
```

Integration tests need a newly migrated **disposable test database**, not a production database. CI provisions PostgreSQL 16, migrates fresh, tests real HTTP/API auth and tenant isolation, and boots the compiled server in production mode with a DB health check.

## Required steps before any real deployment

1. Choose and confirm the **Render workspace** for Go Saudi. Create a distinct Saudi web service and a **new isolated database**; never share Go Bharat's `DATABASE_URL`, tables, credentials, payment secrets or Expo project.
2. Assess Saudi PDPL, relevant Saudi data residency/transfer obligations and the proposed hosting region. Render's offered regions are **not assumed** to be Saudi.
3. Prepare and approve Arabic/English privacy notice, cookie notice (where relevant), consent, retention/deletion and incident response policy. Consult local Saudi counsel.
4. Apply dedicated Saudi migrations 001 and 002 (or upgrade the isolated v001 schema) using `GO_SAUDI_MODE=true npm run db:saudi:migrate`; verify the marker (`market='go-saudi'`, `schema_version=2`).
5. Generate a new 64-character private admin token on a trusted machine and configure **only its SHA-256 hex digest** in `GO_SAUDI_ADMIN_TOKEN_SHA256`:
   ```sh
   node -e "const c=require('node:crypto');const t=c.randomBytes(32).toString('hex');console.log('PRIVATE_TOKEN='+t);console.log('GO_SAUDI_ADMIN_TOKEN_SHA256='+c.createHash('sha256').update(t).digest('hex'))"
   ```
   Store the private token in a password manager. Never post it here or commit it to GitHub. Plan replacement with individual admin MFA accounts.
6. Render runtime Node 22. Required env:
   ```env
   NODE_ENV=production
   GO_SAUDI_MODE=true
   DATABASE_URL=<dedicated Saudi database URL>
   APP_PUBLIC_URL=https://<your-saudi-service-host>
   GO_SAUDI_ADMIN_TOKEN_SHA256=<SHA256 hex of private admin token>
   GO_SAUDI_PRIVACY_APPROVED=false
   GO_SAUDI_ACCOUNT_ERASURE_ENABLED=false
   VENDOR_MEMBERSHIP_PAYMENTS_ENABLED=false
   ```
   Set `APP_PUBLIC_URL` to the actual **HTTPS origin without a path**. Use `npm ci && npm run render:build` to build, and `npm run render:start` to serve. No auto-running destructive schema pushes on service startup.
7. Check `GET /api/health` returns HTTP 200 with `database: connected`; `GET /`, `GET /sell`, `GET /vendor`, `GET /saudi-admin` load; `/api/vendors` and Go Bharat India commerce paths return 423/404; neither payments nor product publishing work.
8. With **test data only**, verify approval → invitation → activation → draft CRUD → revoke, negative cross-vendor ownership, token reuse, CORS/CSRF, access logs and backups.
9. Turn on `GO_SAUDI_PRIVACY_APPROVED=true` *only after approved legal/privacy process*. Keep `GO_SAUDI_ACCOUNT_ERASURE_ENABLED=false` except during explicitly authorized, legally reviewed deletion processing. Before real use, add individual admin MFA, Saudi vendor OTP/identity recovery, support, backup/restoration exercises, monitoring and data subject deletion/retention workflows.
10. **Commercial launch remains BLOCKED** pending actual legal entity/eligible merchant validation, Saudi Business Center e-store authentication as applicable, payment provider with mada and signed webhook reconciliation, ZATCA VAT/e-invoice requirements, refunds, buyer rights, delivery, comprehensive pen-test and real device QA.

## Access paths
- `/` and `/sell`: prelaunch website (form closed until privacy flag)
- `/vendor`: private seller draft portal
- `/saudi-admin`: private admin lead-review portal
- `/api/saudi/market`: feature/readiness metadata
- `/api/health`: DB and deployment readiness

## Known limitations that stop full production
- No Saudi SMS OTP/individual merchant identity service or merchant recovery; invitation is appropriate only for controlled prelaunch.
- One shared admin access token instead of named MFA-controlled reviewers.
- No real Saudi registration/document verification provider, public shops, product search, orders, payment capture, refund, invoicing or delivery.
- No vendor import of India-based data and no Go Bharat shared accounts.
- Free Render service/database plans (if used) do not provide the capacity/availability guarantees expected for commercial production.
- No audited live deployment, data residency legal sign-off, external pen-test, independent production load test or device release.

**Approval for a prelaunch code release does not approve a real public marketplace or payment operation.**

Saudi reference resources:
- Saudi Business Center: https://business.sa/
- SDAIA PDPL guidance: https://dgp.sdaia.gov.sa/
- Saudi payment network: https://www.sama.gov.sa/en-US/payment/Pages/mada.aspx
- ZATCA invoicing: https://zatca.gov.sa/en/E-Invoicing/PreparingYourBusiness/Phase1/Pages/How-to-prepare.aspx
