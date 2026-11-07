# Go Bharat — free-for-dev rollout (review branch)

This branch adds **read-only readiness checks** and CI only. No live payment switch, database migration, or production deployment has been performed.

## Existing implementation
- Expo / React Native app with Express 5 API, PostgreSQL through Drizzle ORM
- Render deployment configured in `render.yaml`; `DATABASE_URL` is required
- Google login, JWT, PhonePe/Razorpay adapters, Resend, OneSignal integrations have source files but must be validated end to end
- Membership tests cover ₹1,000 annually, 33% referral and captured-payment validation

## Free development environment (not reliable production)
- Existing Render free Node service for API and web preview: sleeping and ephemeral local filesystem
- Separate Supabase Free PostgreSQL project, credentials stored in Render environment
- Cloudflare R2 for vendor media after implementing presigned upload and ownership checks
- GitHub Actions for API build and deterministic tests
- Sandbox payment keys only and no live customer settlements

## Operations before accepting real orders
1. Ensure ADMIN_PHONE is explicitly configured. There is currently a fallback in `server/routes.ts`; remove in a dedicated reviewed security PR.
2. Configure strong JWT_SECRET and HTTPS APP_PUBLIC_URL, then run `node scripts/check-production-env.mjs`.
3. Audit PhonePe adapter compatibility with the currently issued merchant API credentials; do not assume legacy endpoints remain valid.
4. Verify Google login, OTP, seller role authorization and account linking on Android and web.
5. Verify webhook HMAC/signature, event replay dedupe, payment capture, refunds, reconciliation and order-state transitions with test merchant.
6. Perform real backup/restore and inventory concurrency tests.
7. Use durable always-on hosting and a supported persistent database for live sales.
8. Get explicit approval before enabling live orders, payments or pushing to production.

## Commands

```sh
npm ci
node --test scripts/__tests__/check-production-env.test.mjs
npm run test:revenue
npm run server:build
# Read-only config audit; never prints secret values:
node scripts/check-production-env.mjs
```

## Boundaries
Free-tier limits can change. Store provider secrets only in hosting environment, never in frontend bundles or Git. Neither this document nor a green CI status proves production readiness.
