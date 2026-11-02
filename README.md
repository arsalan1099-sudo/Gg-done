# Go Saudi 🇸🇦 | جو سعودي

A Saudi-first marketplace edition based on the existing Go Bharat codebase.

> **PRELAUNCH — NOT A LIVE SHOPPING OR PAYMENT APP.** The production Indian Go Bharat service remains on `main` and has not been modified.

## What works in this development branch
- Saudi Arabic/English responsive storefront, Arabic RTL default: `/`
- Saudi cities and category selection
- Free seller-interest enquiry form: `/sell`
- Saudi phone normalization and API input validation
- Seller lead storage with database configuration, rate limit and duplicate protection
- Market and readiness APIs, independent Render preview configuration
- Prelaunch gate blocks all legacy Indian commerce APIs

## What remains before launch
- Full customer/vendor/admin/delivery Expo and backend localization, authentication and real ordering
- Saudi business registration, identity verification, ZATCA compliance and PDPL privacy
- Saudi gateway (mada through a suitable licensed provider), verified webhooks and safe settlement
- New standalone repository, database, branded assets, app-store configuration, live integration tests

**No payments are accepted, and no membership price is finalized.**

See [Go Saudi implementation and deployment instructions](GO_SAUDI.md).

### Source and branch
Go Bharat source: `arsalan1099-sudo/Gg-done`
Saudi branch: `go-saudi`
