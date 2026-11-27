# Security and privacy

## Sign-in

- Passwords and PINs: PBKDF2-SHA256 (100,000+ iterations) or Argon2id, per-user salt.
- PIN lookup: HMAC(pin, server pepper) so the database alone cannot be searched. Refuse PIN sign-in on any deployed server without the pepper.
- Trusted devices: a signed device cookie after a full sign-in. PIN failures from untrusted devices share a per-business limit (for example 10 an hour) that never locks out trusted tablets. Manager PINs 6 digits.
- Rate limits per IP, per account and per business.
- Cookies: staff HttpOnly, Secure, SameSite=Strict; guests SameSite=Lax (90 days); platform admin separate cookie, 8 hours, behind SSO with two-factor before live.
- Every state-changing call needs a custom header (blocks cross-site form posts).

## Authorization

Tenant filter on every query. Role check on every route. Module check on every route. Object-level checks: an order id from another tenant returns 404, not 403.

## Secrets

Platform secret store only. Encrypt third-party tokens and sensitive identifiers at rest (AES-GCM with a key from secrets). Never rotate that key without a migration. Hash gift codes, one-time codes, API keys and session tokens.

## Web

HSTS, Content-Security-Policy with no inline or third-party scripts, `frame-ancestors 'none'`, Permissions-Policy, escape all output, CSV formula-injection guard on exports.

## Audit

Voids, discounts, comps, refunds, price and settings changes, staff edits, timesheet edits, support access, "show full numbers": who, when, before, after, reason.

## Privacy

- Collect what the order needs. Guests' phone numbers hidden from dispatch; text logs mask numbers.
- Deletion on request (loyalty, accounts); ledgers keep amounts without identity.
- Driver location: only to the guest whose order they carry, only while fresh; delete pings after 7 days.
- You are the businesses' processor for guest data: write processing terms and a breach plan.
- Laws to check per region: NZ Privacy Act 2020 and Unsolicited Electronic Messages Act; Canada PIPEDA, CASL, provincial health privacy (PHIPA in Ontario) for clinics.

## Before real money

Independent penetration test, live keys swapped deliberately, mocks and dev routes off, WAF rate limits on sign-in and order routes, provider certifications, backups with a tested restore. Full list: `templates/go-live-checklist.md`.

## Ship-safe five (keep them closed by test)

The five holes that sink quickly built apps. Each one is a check in the test suite, so a later change cannot quietly reopen it (Mainpoint: `test/shipsafe.test.js`).
1. **Open data.** Every query on a business's data filters by `tenant_id` (or Row Level Security is on for every table, if the database offers it). A guest or staff member only ever sees their own business's rows.
2. **Public file storage.** No public buckets. Uploaded photos and ID documents stay private; hand out signed links that expire (about 60 seconds) or serve them through an authenticated route.
3. **Login checked only in the browser.** One server-side gate before every signed-in route returns 401 without a valid session; the only routes above it are sign-in flows (login, PIN, forgot, reset). Hiding a page in the front end is not a check.
4. **Secret keys in the front end.** Nothing the browser downloads holds a secret key (Stripe `sk_`, webhook `whsec_`, cloud keys, model API keys). Scan every shipped file for key patterns; keep secrets in the platform secret store, never in config files committed to the repo.
5. **No rate limit on paid endpoints.** Every route that calls a model, sends a text or places a call has a per-tenant (or per-IP) limit plus a monthly spend cap, so one bot cannot run up the bill overnight. The test lists every AI route and fails when one has no limit.
