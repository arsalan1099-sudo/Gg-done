# Go Bharat auth hardening — review before merge

This branch prevents a severe OTP takeover scenario: the prior code could
return an OTP in a production API response when SHOW_OTP_ON_SCREEN=true.
**Production responses must never contain the OTP, regardless of flags or role.**

Changes:
- Production on-screen OTP disclosure is disabled.
- OTP generation uses crypto.randomInt instead of Math.random.
- SUPER_ADMIN phone recognition requires an explicitly configured, valid
  Indian admin E.164 number. No hard-coded fallback.
- Public /api/admin/config no longer returns the admin phone number;
  responds with a boolean only.
- render.yaml declares ADMIN_PHONE as a manually configured secret.
- Pure security tests and CI verify the new behavior.

# Operational go/no-go checks
1. Ensure ADMIN_PHONE is configured in Render; this branch intentionally
   makes SUPER_ADMIN unavailable if it is missing.
2. Ensure real WhatsApp/SMS/email OTP delivery for the admin and vendors.
   SHOW_OTP_ON_SCREEN is ignored in production.
3. Test verified admin and regular user OTP login on web and Android, plus
   Google-link flows. The client no longer gets adminPhone from the public
   bootstrap API. The backend determines authenticated role.
4. If any admin interface relies on displaying admin phone via the public API,
   move it to a separately authenticated SUPER_ADMIN-only endpoint.
5. Verify production OTP responses never include devOtp for **any** role.
6. Review OTP rate limiting, session invalidation, and security monitoring.
7. Never merge or deploy until the authenticated admin flow is confirmed.

No payments, migrations, hosting changes, or production deployment have occurred.
