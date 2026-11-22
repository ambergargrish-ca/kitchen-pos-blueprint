# Data model

The full starter schema is `templates/schema.sql`. Conventions:

- Money: `INTEGER` cents. Rates: `INTEGER` basis points (`tax_rate_bp = 1300`).
- Time: `INTEGER` epoch milliseconds (UTC). Local dates are computed with the tenant's time zone.
- Ids: random text ids (not sequential) for anything in a URL. A per-tenant sequential `number` for humans ("Order #142").
- JSON columns for small, read-together structures (modifiers, hours). Anything you query or sum gets its own table.
- Soft states over deletes for money rows: `voided`, `cancelled`, `refunded`. Never delete an order, payment or ledger row.

## Core entities

| Table | Key columns | Notes |
|---|---|---|
| `tenants` | slug, name, timezone, currency, tax_rate_bp, tax_inclusive, province, product, status, review_status | One business |
| `branches` | tenant_id, hours JSON, online, throttle, business_day_cutoff | One location |
| `domains` | host -> tenant_id | Custom domains |
| `staff_users` | tenant_id, role, pass_hash, pin_lookup (HMAC), active | Unique (tenant_id, email) |
| `menu_items` | tenant_id, category_id, price_cents, modifiers JSON, active, station, age_check, open_price, duration_min | Items, services or products |
| `orders` | tenant_id, branch_id, number, source (web, pos, phone, kiosk, app), mode (pickup, delivery, dine-in, tabpay), status, payment_status, subtotal/discount/reward/tax/total/paid_cents, tip_cents, table_id, public_token | One bill |
| `order_items` | tenant_id, order_id, item_id, name, qty, unit_cents, mods JSON, note, seat, sent_at, voided | Price frozen at add time |
| `payments` | tenant_id, order_id, kind (payment, refund), method, amount_cents, ref, provider | Every money movement |
| `kitchen_tickets` | tenant_id, order_id, station, status, sent_at, bumped_at, release_at | One per round per station |
| `ledgers` | points_ledger, giftcard_ledger | Every balance change |
| `webhook_events` | provider, event_id (unique) | Processed once |
| `idempotency` | tenant_id, key (unique), response | Offline replays and retries |
| `audit_log` | tenant_id, actor, action, before, after, reason | Voids, discounts, refunds, settings, support access |

## Status machines

Order: `pending_payment -> paid -> in_kitchen -> ready -> done` (online), `open -> closed` (POS tab), any -> `cancelled`. Payment status: `unpaid -> partly_paid -> paid -> partly_refunded -> refunded`.

Write each transition as a guarded update: `UPDATE orders SET status = 'ready' WHERE id = ? AND status = 'in_kitchen'`. Zero rows changed means someone else moved it first: re-read, do not overwrite.

## Indexes that matter

`(tenant_id, status)`, `(tenant_id, created_at)`, `(tenant_id, table_id, status)` for open tabs, `(tenant_id, branch_id, status)` for the kitchen, unique `(provider, event_id)`, unique `(tenant_id, idempotency_key)`, unique `(tenant_id, slug)`.

## Migrations

Numbered SQL files applied in order, never edited after deploy. Add columns with defaults so old rows work. CI applies every migration to an empty database and seeds it on each run.
