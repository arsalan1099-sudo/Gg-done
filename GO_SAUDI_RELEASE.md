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
4. Apply the dedicated DB migration once on new Saudi DB with `GO_SAUDI_MODE=true`; verify the `saudi_market_metadata` row (`market='go-saudi'`, `schema_version=1`).
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
   VENDOR_MEMBERSHIP_PAYMENTS_ENABLED=false
   ```
   Set `APP_PUBLIC_URL` to the actual **HTTPS origin without a path**. Use `npm ci && npm run render:build` to build, and `npm run render:start` to serve. No auto-running destructive schema pushes on service startup.
7. Check `GET /api/health` returns HTTP 200 with `database: connected`; `GET /`, `GET /sell`, `GET /vendor`, `GET /saudi-admin` load; `/api/vendors` and Go Bharat India commerce paths return 423/404; neither payments nor product publishing work.
8. With **test data only**, verify approval → invitation → activation → draft CRUD → revoke, negative cross-vendor ownership, token reuse, CORS/CSRF, access logs and backups.
9. Turn on `GO_SAUDI_PRIVACY_APPROVED=true` *only after approved legal/privacy process*. Before real use, add individual admin MFA, Saudi vendor OTP/identity recovery, support, backup/restoration exercises, monitoring and data subject deletion/retention workflows.
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
