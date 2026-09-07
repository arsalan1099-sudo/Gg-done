# Go Bharat — free hosting on Render

This version is prepared to run the existing Go Bharat Expo web app and Express API as **one Render Web Service**. The browser frontend and `/api/*` backend share the same origin, so the web build no longer depends on a Replit hostname.

## What changed

- Web API URLs use the browser's current origin on web (`window.location.origin`).
- Native builds can still use `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_DOMAIN`.
- Added `render.yaml` for a free Render Web Service.
- Added `render:build` and `render:start` scripts.
- Removed the unused `stripe-replit-sync` package.
- Replit-only development/build configuration is no longer required for the hosted web version.

## Deploy

1. Put this project in a GitHub repository.
2. In Render, choose **New → Web Service** and connect the repository.
3. Select the **Free** plan.
4. Render will use the commands from `render.yaml`:
   - Build: `npm ci && npm run render:build`
   - Start: `npm run render:start`
5. Add the environment variables required by the features you use. `DATABASE_URL` is required by the server.
6. After deployment, open the Render URL and test `/api/health`.

## Important: database

Go Bharat is a full-stack app and requires PostgreSQL. Do not rely on a local SQLite file: Render free web services have ephemeral filesystems.

A practical no-cost option is a **Supabase Free** Postgres project. Supabase currently includes a free Postgres database (500 MB per project), although inactive free projects can be paused. For an external backend, use Supabase's IPv4-compatible pooler connection string when needed.

After creating the database, set `DATABASE_URL` in Render and apply the existing Drizzle schema from a machine with the project dependencies installed:

```bash
npm ci
npm run db:push
```

Render's own free Postgres is also available, but Render currently documents that free Postgres databases expire after 30 days, so it is not the best choice for long-term Go Bharat data.

## Important: secrets

Do not put API keys in the repository or inside the Expo web bundle. Add them in Render's Environment settings. Typical production integrations include Google OAuth, Razorpay, PhonePe, OpenAI, and OneSignal.

## Free-tier behavior

Render documents that free web services spin down after 15 minutes of inactivity and can take about a minute to wake on the next request. This is normal on the free plan.
