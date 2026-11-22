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
