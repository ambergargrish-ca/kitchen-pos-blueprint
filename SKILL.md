---
name: kitchen-pos-blueprint
description: Build a production-grade restaurant POS (tabs, kitchen display, online and QR ordering, payments, terminals, offline mode, back office) as one multi-tenant codebase, then replicate it to other businesses (salons, clinics, gyms, retail) by configuration. Use when planning, building, testing or extending a POS, kitchen display system, ordering platform or a vertical SaaS family, and when you need the edge cases that break real money flows.
license: MIT
---

# Kitchen POS Blueprint

A playbook for building a point-of-sale system a real restaurant can run a Friday night on, and then turning the same codebase into a family of products for other kinds of businesses.

It is built from a working platform: one codebase serving restaurants in two countries plus salons, clinics, dental offices, gyms and shops, each its own deployment and brand. Every rule below exists because a real flow needed it.

Stack used in the case study: Cloudflare Workers (Hono) + D1 (SQLite) + Durable Objects for live updates, plain HTML/JS front end, no build step. Every pattern is stack-neutral; see `references/01-architecture.md` for alternatives.

## The ten rules that matter most

1. **Money is integer cents. Always.** No floats anywhere: database, API, browser. Rates are basis points (1500 = 15.00%).
2. **The server prices everything.** The browser sends item ids, quantities and option ids. Prices, discounts, tax, tips, points and fees are recomputed on the server from the database on every request. Client totals are ignored.
3. **Every row carries `tenant_id` and every query filters on it.** Prove it with a second tenant in the test seed.
4. **Every state change that touches money is idempotent.** Webhooks, terminal results, offline replays, double taps, two tablets: each is applied once (idempotency keys, claimed-once rows, optimistic locks).
5. **Balances move only through atomic updates plus a ledger row.** Gift cards, loyalty points, deposits, tab `paid_cents`. Never read, add in code, write back.
6. **Read the payment result back from the provider** before marking anything paid. Redirects and browser callbacks prove nothing.
7. **Live money is off by default** and needs an explicit switch. Test keys are refused in live mode and live keys in test mode. Every mock and dev route dies in live mode.
8. **Modules are enforced on the server.** Hiding a button is never the only control.
9. **Time is the tenant's local wall clock,** stored as UTC epoch ms. Opening hours can pass midnight; DST happens.
10. **A vertical is configuration, not a fork.** One codebase, a `PRODUCT` and a `REGION` per deployment, words rewritten on the way out, modules filtered per product.

## Workflow

```
1 Scope -> 2 Model -> 3 Money core -> 4 POS + kitchen -> 5 Channels -> 6 Payments + devices
   -> 7 Offline + live -> 8 Back office -> 9 Harden (edge cases) -> 10 Go live -> 11 Replicate
```

### 1. Scope
Write the module list first (see `references/01-architecture.md`, "Modules"). Decide per module: in the first release, later, or never. Name the roles (kitchen < staff < manager < owner, plus driver as a separate role). Decide the country and tax model before writing a single price.

### 2. Model the data
Start from `templates/schema.sql`. Core tables: tenants, branches, staff_users, sessions, categories, menu_items (with modifiers JSON), orders, order_items, payments, refunds, kitchen_tickets, ledgers (points, gift cards), audit_log, webhook_events, idempotency. Read `references/02-data-model.md`.

### 3. Build the money core first, test it hardest
Pricing, totals, tax (inclusive and exclusive), discounts, surcharges, tips, split bills, refunds and the daily journal. Pure functions, unit tested, before any screen exists. `scripts/money.js` is a reference implementation with `scripts/money.test.mjs`. Read `references/03-money.md`.

### 4. POS and kitchen
Floor plan, tabs, rounds, seats, voids, moves, split payments, then the kitchen display with stations, bump, recall and timers. Read `references/04-pos-flows.md` and `references/05-kitchen-display.md`.

### 5. Channels
Online ordering, QR table ordering (order now or pay at the end), kiosk, phone AI agent, delivery apps, and pushing orders into a POS the business already has. Every channel ends in the same order and ticket model. Read `references/07-channels.md`.

### 6. Payments and devices
Hosted checkout (card data never touches you), signed webhooks, integrated terminals, surcharges, Connect-style payouts. Read `references/06-payments-devices.md`.

### 7. Offline mode and live updates
A POS that stops when Wi-Fi drops is not a POS. Queue changes locally with idempotency keys and replay in order. Push changes to every screen over a WebSocket per tenant, with polling as a fallback. Read `references/04-pos-flows.md`, "Offline mode".

### 8. Back office
Sales with tags, Z report, inventory with recipes, purchasing, timesheets, tips, payroll export, accounting journal (Xero/QuickBooks), audit log, insights. Read `references/03-money.md`, "Daily journal".

### 9. Harden against the edge cases
Work through `references/edge-cases.md`. It is the core of this skill: 234 cases in 23 areas, each with what goes wrong and the rule that prevents it. Turn each into a test using `templates/edge-case-matrix.csv`. A release is not ready while any P0 row lacks a passing test.

### 10. Go live
Run `templates/go-live-checklist.md`. Security review, live keys swapped deliberately, backups tested, provider certifications, privacy policy, support access rules.

### 11. Replicate to other businesses
Read `references/09-replicate.md`. Map the new business onto the same primitives (items become services or products, tables become chairs or rooms, tickets become appointments), write a vertical profile from `templates/vertical-profile.json` (`python3 scripts/new_vertical.py <key>`), list what is genuinely new (appointments, memberships, insurer billing, age checks), and add only that. Then do the region pass in `references/10-regions-tax.md`.

## Testing tiers

- **Quick (every change):** unit tests for the area you touched plus the edge-case rows tagged for it.
- **Full (before each deploy batch):** all unit tests, then migrations + fresh seed + the end-to-end run against a local server, including the second-tenant isolation checks and every P0 edge case.
- Detail in `references/11-testing-launch.md`.

## Reference map

| File | Read when |
|---|---|
| `references/01-architecture.md` | Starting out; choosing stack, tenancy, modules, roles |
| `references/02-data-model.md` | Designing tables, ids, statuses |
| `references/03-money.md` | Anything with a price, tax, discount, tip, refund or report |
| `references/04-pos-flows.md` | Tabs, floor, voids, splits, offline |
| `references/05-kitchen-display.md` | Tickets, stations, routing, timers |
| `references/06-payments-devices.md` | Checkout, webhooks, terminals, payouts, surcharges |
| `references/07-channels.md` | Online, QR, kiosk, phone AI, delivery apps, POS integration |
| `references/08-security-privacy.md` | Auth, PINs, roles, secrets, privacy law |
| `references/09-replicate.md` | Turning the restaurant POS into other verticals |
| `references/10-regions-tax.md` | A new country or province |
| `references/11-testing-launch.md` | Test plan, CI, go-live |
| `references/edge-cases.md` | Always, before calling any area done |

## Credit

Created by Amber Gargrish ([gargrish.com](https://gargrish.com)). Built and proven on the Mainpoint platform (Platepoint for Canadian restaurants, Orbyt in New Zealand). If you use it, please cite it (see `CITATION.cff`).
