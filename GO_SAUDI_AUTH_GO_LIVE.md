# Go Saudi mobile authentication — release checklist

Updated 6 November 2026. Branch: `go-saudi`; Android app v0.2.2 (`com.aasaa.gosaudi`).

## Status

**Implemented and tested in source:** dedicated Arabic/English Account tab; canonical Saudi +966 phone validation; Twilio Verify SMS start/check; 12-hour hashed sessions; server-side revocation; browser HttpOnly/SameSite cookies; Android/iOS bearer tokens; encrypted device storage using `expo-secure-store`; consent and unavailable-state UX. Test coverage includes invalid tokens, forged browser origins, OTP-provider approval, native logout, phone normalization, isolated DB migration and restore.

**Not yet live:** There is no separate Go Saudi Render web service or isolated Saudi Postgres. The only database discovered in the connected workspace is the existing Go Bharat DB. Do not reuse it. No approved live Twilio Verify credentials or privacy/data-transfer approval have been supplied/verified. Consequently, testing APK uses `EXPO_PUBLIC_SAUDI_API_URL=""` and cannot send real SMS until reconfigured and rebuilt. Never replace the missing provider with a hardcoded code or report this as live.

## Secure launch steps

1. Complete the Saudi customer privacy notice, retention/deletion design, and regulatory assessment for SMS OTP and hosting/data transfers. Confirm the verified Saudi e-store business registration and owner/operator responsibilities.
2. In the customer's authorized Render workspace, provision a **separate** Saudi PostgreSQL service and web service, specifying an approved data location/region and whether the plan incurs charges. Never point `DATABASE_URL` at Go Bharat.
3. Configure the Saudi Render service from repo `arsalan1099-sudo/Gg-done`, branch `go-saudi`, with a build command of `npm ci && npm run db:saudi:migrate && npm run server:build` and start command `npm run server:prod`. Set `GO_SAUDI_MODE=true`, a separate HTTPS `APP_PUBLIC_URL` matching the Saudi service's public origin, and `DATABASE_URL` pointing ONLY to the isolated Saudi DB. DB migration must reach `go-saudi:6` before serving traffic. Verify database guard, backup/restore, health and HTTPS.
4. In a verified Twilio account, create a Saudi-capable Verify Service and store `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` (and `TWILIO_ACCOUNT_SID` for commerce readiness) in **server-only Render secrets**; never in the repository, mobile app, screenshot or chat. Comply with Saudi SMS sender, carrier and verification requirements.
5. Generate a random 32-byte `GO_SAUDI_CUSTOMER_ENCRYPTION_KEY` (64 hex characters) via a trusted secret manager; preserve it across deployments because changing it breaks encrypted phone lookup. Store only on the Saudi server.
6. Only after the named approvals are actually complete set `GO_SAUDI_PRIVACY_APPROVED=true`, `GO_SAUDI_CUSTOMER_DATA_RIGHTS_READY=true`, `GO_SAUDI_ESTORE_VERIFIED=true`, and `GO_SAUDI_CUSTOMER_OTP_ENABLED=true`. Leave all commerce/payment/order/booking flags **false**.
7. Validate `GET /api/saudi/customer/auth/status` returns `available:true`, then run a real device flow: consent -> send SMS -> verify SMS -> fetch profile -> restart app -> restore session -> logout -> reject revoked token. Test incorrect/expired codes and SMS delivery/rate limits. Confirm audit logs do not expose phone, OTP, tokens or card credentials.
8. Rebuild Android/iOS mobile binaries with `EXPO_PUBLIC_SAUDI_API_URL=https://<approved-Saudi-origin>` and `EXPO_PUBLIC_SAUDI_STAGE=PRELAUNCH`. Current GitHub testing APK workflow deliberately hardcodes an empty backend URL: **it will not enable live login as-is**. Validate correct Android app ID, signature, SHA-256, versionCode and device-specific SMS flow.
9. Enable actual customers only after an authorized production release review. Live orders, merchant booking and payments remain separate, blocked workflows and are not authorized by successful customer login.

## API contract

- `GET /api/saudi/customer/auth/status`: `{country:"SA",method:"sms_otp",available:boolean}`, no secrets.
- `POST /api/saudi/customer/otp/start`: `{phone:"+9665XXXXXXXX",consent:true}` returns HTTP 202 only after provider acknowledges SMS.
- `POST /api/saudi/customer/otp/verify`: `{phone:"+9665XXXXXXXX",code:"..."}` returns a bearer token to native clients **only when Twilio confirms**. Web returns HttpOnly SameSite Secure cookie.
- `GET /api/saudi/customer/me`: native Authorization `Bearer <session-token>`; web session cookie.
- `POST /api/saudi/customer/logout`: revoke one session, then clear the encrypted device credential.

## Remaining operational checks

Credential rotation and lost-secret recovery, device session revocation policy, production monitoring, SMS spend protection/abuse controls, independent security test, Saudi PDPL review, customer support and data-access/deletion readiness. These must be signed off before a public authentication launch.

## CI links

Auth and business security verification: https://github.com/arsalan1099-sudo/Gg-done/actions/workflows/go-saudi-verify.yml
Android native APK builder: https://github.com/arsalan1099-sudo/Gg-done/actions/workflows/go-saudi-apk.yml
