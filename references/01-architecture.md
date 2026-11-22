# Architecture

## Shape

```
                 +--------------------------- one codebase ---------------------------+
 PRODUCT=plate   |  Guest site  /r/<slug>   Website /w/<code>   Kiosk   QR table        |
 REGION=ca       |  Staff app   /staff  (POS, kitchen, bookings, HQ, ops) one login,    |
                 |              different screens per role                             |
                 |  Driver app  /driver     Platform admin /platform                   |
                 |  Webhooks    payments, texts, delivery apps, couriers, POS, AI phone|
                 +------+-------------------+----------------------+-------------------+
                        |                   |                      |
                 SQL database        Live hub per tenant     Clean-up job (every 10 min)
                 (tenant_id on       (WebSocket; polling     expire unpaid orders, retry
                  every row)          fallback)               queues, reminders, sync
```

One deployment per product and country: its own worker, database and secrets. The same code serves all of them; `PRODUCT` and `REGION` pick the brand, words, tax and modules.

## Stack (case study) and alternatives

| Layer | Case study | Alternatives |
|---|---|---|
| Server | Cloudflare Workers + Hono | Node (Fastify/Express), Deno, Bun, Go |
| Database | D1 (SQLite) | Postgres (Neon, Supabase, RDS), Turso |
| Live updates | Durable Object per tenant with WebSocket hibernation | Postgres LISTEN/NOTIFY + WebSocket server, Pusher, Ably, Supabase Realtime |
| Per-call state (phone AI) | Durable Object per call | A small stateful service |
| Front end | Plain HTML + JS modules, no build step | Any framework, but keep the POS bundle small for cheap tablets |
| Offline store | IndexedDB + service worker | Same everywhere |
| Native | Capacitor wrappers around the web app | React Native only if you need deep device APIs |
| CI | GitHub Actions: syntax, unit, migrate + seed + end-to-end | Any |

Choose SQL. Money flows need transactions or single-statement atomic updates, unique constraints and `RETURNING`.

## Tenancy

- Shared database, `tenant_id` on every tenant-owned row, composite indexes starting with `tenant_id`.
- Every repository function takes the tenant first. No query without it.
- Resolve the tenant from the path slug (`/r/<slug>`), a custom domain (`domains` table) or the staff session. Never from a body field.
- Seed a second sample tenant in every test database and prove one cannot read the other.

## Modules

Sell the platform as switchable modules. The server checks the module on every route, the screens hide what is off.

| Module | Contains |
|---|---|
| Online ordering | Guest menu, checkout, tracking, order ahead, tips, promos |
| Branded website | Templated site per business, custom domain |
| POS | Floor, tabs, counter sales, payments, Z report |
| Kitchen display | Tickets, stations, timers, recall |
| Bookings | Tables, deposits, reminders, waitlist |
| Delivery | Zones, drivers, dispatch, couriers |
| Loyalty and gift cards | Points, rewards, referrals, cards |
| Guest experience | QR table service, call staff, pay at the end, receipts |
| AI phone agent | Calls, orders, bookings, transcripts |
| Marketing | Consent-based text campaigns, insights, AI drafts |
| Back office | Inventory, purchasing, schedule, timesheets, payroll, accounting |
| POS integration | Push orders into the business's existing POS; Connect API |

Rules:
- A tenant with no module rows (created before modules existed) has everything.
- Each product declares which modules it sells. A module outside that list is refused even if a tenant row says on.
- Map each API path prefix to a module in one table so a new route cannot forget its check.

## Roles

`kitchen < staff < manager < owner`, plus `driver` (driver API only) and platform admin (separate login, separate cookie, short session). One staff app: the role decides the screens. Shared tablets use 4 to 6 digit PINs; managers 6.

## Background work

One scheduled job every 10 minutes is enough for most of it: cancel unpaid online orders after 45 minutes (returning held points and gift card money), release order-ahead tickets, send reminders, retry POS and delivery queues, read external calendars, clear expired sessions and codes, nightly accounting sync. Every job must be safe to run twice.

## Environments and switches

| Switch | Meaning |
|---|---|
| `LIVE_PAYMENTS=1` | Real money. Live keys allowed, test keys refused, all mocks and dev routes dead |
| `DEV_ROUTES=1` | Test-only routes (local only) |
| `*_MOCK=1` | Fake couriers, POS, terminals, claims for tests. Refused in live mode |
| `PRODUCT`, `REGION` | Which brand, words, tax and modules this deployment serves |
