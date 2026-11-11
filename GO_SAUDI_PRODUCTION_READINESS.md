# Go Saudi production readiness — 10 November 2026

Status: NOT ready for public launch. This change hardens build configuration; it does not activate a backend, SMS, orders, payments or store publication.

## Changes

- Production Expo config and EAS post-install validation reject a missing/invalid Saudi HTTPS origin, inherited India API settings, development mode, incorrect app IDs and a missing EAS project ID.
- Removed the production profile's hardcoded empty URL. Set `EXPO_PUBLIC_SAUDI_API_URL` in the owner's EAS **production** environment, and the same origin as GitHub Actions variable `GO_SAUDI_API_URL` for the manual signed-AAB workflow. Never put credentials in EXPO_PUBLIC variables. Preview remains intentionally offline.
- PostgreSQL statement timeouts are now set on every connection at connection startup. The old connect listener submitted a query to the pool, which could execute on a different connection and did not reliably protect the new connection's first query.
- Pull requests targeting `go-saudi` now run the existing isolated PostgreSQL integration, backup/restore, mobile export and server-smoke workflow, plus release configuration regression tests.

## Verification

Local Node 24.22.1: 24 Saudi tests, 10 mobile tests, 5 inherited billing tests and 3 production configuration tests passed (42 total). Server bundle, route isolation and focused TypeScript check passed. Used `node --import tsx --test` locally because the tsx CLI's Unix socket is unavailable in this environment.

The unmodified base commit `57bcaacd738f42671fd893c637bd805177500461` has a successful upstream verification run: https://github.com/arsalan1099-sudo/Gg-done/actions/runs/42797418172 . This is prior-base evidence, not a result for this change or a production deployment.

Initial `npm audit --omit=dev` reported 55 advisories: 3 critical, 27 high, 23 moderate and 2 low. Compatible lockfile updates reduced the production dependency report to 25 advisories: **0 critical, 10 high, 14 moderate and 1 low**. All 42 tests and server build passed again after the update. The remaining high advisories still block production readiness. Do not force an Expo major upgrade as an automatic audit fix.

## Remaining release dependencies

1. Select the intended Render workspace, then inspect/provision the dedicated Saudi service and isolated database. Do not reuse Go Bharat's database. Confirm hosting plan/region before provisioning resources that incur charges.
2. Verify HTTPS origin, migrate the isolated database, validate health and backup recovery. The build validator checks URL syntax, not DNS, ownership or availability.
3. Link the owner's Go Saudi Expo project and permanent Android signing credentials. Configure EAS/Actions public origin consistently.
4. Configure server-only SMS provider and encryption secrets. Complete the existing privacy/customer-data prerequisites; do not fabricate approvals by turning flags on.
5. Run real phone OTP, session restoration, logout/revocation and failure-path tests. Build a signed artifact and verify it on a device.
6. Resolve dependency advisories, inspect CI for this commit and independently validate payments, refunds and fulfillment before enabling commerce.

No new signed APK/AAB, live deployment, real SMS, merchant charge or Play publication is claimed by this work.

## Verified delivery state — 11 November 2026

- Pull request [#9](https://github.com/arsalan1099-sudo/Gg-done/pull/9) is an open draft targeting `go-saudi`; do not merge or authorize a public launch based solely on CI.
- Production server fix commit [da6c77a](https://github.com/arsalan1099-sudo/Gg-done/commit/da6c77accb09420181938685423d62c2953358c0) resolves the broken local `@shared/schema` alias in the Node bundle.
- GitHub Actions [run #253](https://github.com/arsalan1099-sudo/Gg-done/actions/runs/43009483565) succeeded on that fix: Saudi tests, DB isolation/migration, disposable backup and restore, JavaScript exports, server build and production-mode smoke.
- Separate [go-saudi-prelaunch Render web service](https://dashboard.render.com/web/srv-dbq4ro9srm7s739h1cvg) was provisioned in Singapore on the fix branch, free plan, auto-deploy disabled. Build succeeded, but runtime fails closed: DATABASE_URL is missing. This is NOT a healthy production deployment.
- Render rejected a second free PostgreSQL database with `cannot have more than one active free tier database`. The existing Go Bharat free database must not be reused. A dedicated paid Saudi PostgreSQL instance needs explicit cost approval; choose a production plan, enable appropriate backups and connect privately in the same region.
- Android manual signed-AAB preparation is in `.github/workflows/go-saudi-play-release-eas.yml`. Added `.github/workflows/go-saudi-ios-release-eas.yml` for **manual gated iOS signed build only**. Neither workflow automatically submits an app to the stores.
- The app currently lacks `expo.extra.eas.projectId`; owner Expo/Apple signing, EXPO_TOKEN, production HTTPS origin and store credentials have not been verified. No signed AAB/IPA is claimed.
- Existing authenticated Moyasar webhook endpoint persists validated event IDs into an inbox, but does not automatically reconcile payments; full live payment, refund and payout verification is outstanding.

## Owner-controlled prerequisites before live activation

1. Approve a billable dedicated Saudi PostgreSQL plan and backup/restore policy. Migrate with `GO_SAUDI_MODE=true npm run db:saudi:migrate` only against the new Saudi database. Verify `saudi_market_metadata` and restore from a real backup in an isolated environment.
2. Add Saudi server-only secrets through Render Environment (do not commit values): `DATABASE_URL` (Render internal private URL), securely generated `GO_SAUDI_ADMIN_TOKEN_SHA256`, `APP_PUBLIC_URL`, `GO_SAUDI_CUSTOMER_ENCRYPTION_KEY`, Twilio Verify credentials, Moyasar secret/publishable keys and webhook token. Keep all launch switches FALSE until signoff.
3. Complete legal/privacy and merchant checks, business registration and identity documentation, data retention/deletion and contact channels. Record reviewer, document evidence and approval timestamps; never use test merchants as real KYC.
4. On an actual Saudi phone verify SMS delivery, OTP rate limits, rejection, login, session restore, logout and revoke. Test customer export/erasure before opening registration.
5. With PSP-provided approved test and live accounts, independently verify signed/webhook-authenticated events, replay idempotency, amount/currency/order matching, double-spend prevention, failed charges, refunds, reconciliation, settlement and pickup/booking fulfillment. Do not process a real charge until financial and operational signoff.
6. Link the correct Expo EAS project to `app.json`; set GitHub Actions `GO_SAUDI_API_URL` and EAS production `EXPO_PUBLIC_SAUDI_API_URL` to the verified dedicated HTTPS origin; store `EXPO_TOKEN` only in GitHub Secrets. Verify Android remote signing/Play access and Apple Developer/App Store Connect access on the owner's accounts.
7. Resolve remaining dependency advisories, test release artifacts on real Android/iOS devices, prepare privacy disclosures, then use the manual signing workflows. App Store and Play submission require separate owner-controlled signoff, store account access and completed metadata/review.

No production commerce flags were enabled and no real SMS, KYC approval, payment, store signing or store publication was performed.

Remaining high advisory package names: brace-expansion, decode-uri-component, drizzle-orm, expo-router, image-size, postcss, query-string, sharp, zod, zod-validation-error. Some remediations require major-version migrations; none have been forced.

Android Expo JavaScript export completed after the dependency update; this is not a signed native APK/AAB or an on-device test. The focused TypeScript check also passed again.
