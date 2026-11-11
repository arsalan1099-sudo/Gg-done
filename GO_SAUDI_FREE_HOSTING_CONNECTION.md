# Go Saudi — free Render + Supabase database connection

Verified on 11 November 2026. **Do not enable live commerce** until legal, merchant, PSP, SMS and production testing requirements have passed.

## Resources created

- Supabase project: `go-saudi-free-db` (`chbftivdippbqibuotry`) in Singapore (`ap-southeast-1`), Free plan, active healthy. [Open Supabase](https://supabase.com/dashboard/project/chbftivdippbqibuotry).
- Render: `go-saudi-prelaunch` (`srv-dbq4ro9srm7s739h1cvg`), Singapore, Free web service, source: `fix/go-saudi-production-readiness`. [Open Render](https://dashboard.render.com/web/srv-dbq4ro9srm7s739h1cvg).
- All six Saudi migrations (`001`–`006`) were applied via Supabase connector to this new, empty database. Market marker was queried as `go-saudi`, schema version `6`.
- Security migration `go_saudi_007_server_only_rls` enabled RLS on all 15 app tables, revoked public / `anon` / `authenticated` table privileges, and granted explicitly scoped backend access to custom database login `go_saudi_app`.
- Independent verification: 15/15 tables have RLS enabled, zero public/anon/authenticated table read grants, and Supabase security advisors return no findings.
- `go_saudi_app` exists but **does not have a usable login password yet**. Automatic password-setting was blocked; no database URL has been installed on Render.
- Render has a random admin SHA-256 digest with no recoverable matching admin token. Admin access is intentionally **locked until owner provisions a new admin token**. Commerce / OTP launch switches remain disabled.
- Builds and CI are not evidence of a healthy live service without DB credentials. Earlier Render deploy failed at startup because `DATABASE_URL` was missing.

## One owner-only secure step to finish connection

Do **not** paste database passwords or complete database URLs into ChatGPT, a Git commit, or any public channel.

1. In [Supabase SQL Editor](https://supabase.com/dashboard/project/chbftivdippbqibuotry/sql/new), generate and retain a secure unique 32+ character password using a password manager. Execute the following statement, replacing the placeholder only in the SQL Editor:

   ```sql
   ALTER ROLE go_saudi_app WITH PASSWORD '<STRONG_UNIQUE_PASSWORD>';
   ```

   If SQL Editor permission prevents changing the role password, use the project Database Settings to reset the built-in `postgres` password and connect temporarily with that role instead. The scoped `go_saudi_app` role is strongly preferred.

2. In Supabase project, click **Connect** → **Session pooler**. Copy the **real** pooler hostname: the cluster index cannot be inferred from region. Use its host and port 5432. For the scoped backend role, its username is `go_saudi_app.chbftivdippbqibuotry`.

3. In [Render Environment](https://dashboard.render.com/web/srv-dbq4ro9srm7s739h1cvg), set the **secret** `DATABASE_URL` directly (not in source control). Template:
   ```
   postgresql://go_saudi_app.chbftivdippbqibuotry:<URL_ENCODED_PASSWORD>@<REAL_SESSION_POOLER_HOST>:5432/postgres?sslmode=require
   ```
   If using a `postgres` account instead, copy Supabase's own exact session pooler URL and insert the password locally. Do not expose it in an Expo `EXPO_PUBLIC_` variable.

4. Save Render environment; a deploy will run. Inspect logs. Health test:
   ```
   curl -fsS https://go-saudi-prelaunch.onrender.com/api/health
   ```
   Expected shape: `{"status":"healthy","service":"go-saudi","mode":"PRELAUNCH","database":"connected","payments":false,"orders":false}`.
   Also verify `/api/saudi/market` and `/api/saudi/readiness`. The latter must report `commercialLaunchReady:false`.

5. Record that this is an **unpaid prelaunch/staging setup**, not a production SLA. Render Free may sleep and Supabase Free may pause for inactivity. Test backups and restore periodically. Never add live shoppers, PII, payment credentials or settlement activity until compliance is complete.

## Separation and security

- The project does not share Go Bharat's database, credentials or Render service.
- Postgres direct host `db.chbftivdippbqibuotry.supabase.co` is typically IPv6-only and is **not** the endpoint to use on Render Free. Use the real Supabase **Session pooler** hostname.
- No live orders, bookings, payments, SMS OTP or merchant verifications have been performed.
- Admin secret must be replaced with an owner-generated random bearer token **hash** before real admin operations; never commit the raw token.
