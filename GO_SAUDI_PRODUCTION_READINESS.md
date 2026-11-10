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

## Delivery state

Changes are committed locally on `fix/go-saudi-production-readiness`. Automatic approval review blocked the GitHub push because explicit authorization to export this change was required. No pull request, remote CI for this change, merge or deployment has occurred.

Remaining high advisory package names: brace-expansion, decode-uri-component, drizzle-orm, expo-router, image-size, postcss, query-string, sharp, zod, zod-validation-error. Some remediations require major-version migrations; none have been forced.

Android Expo JavaScript export completed after the dependency update; this is not a signed native APK/AAB or an on-device test. The focused TypeScript check also passed again.
