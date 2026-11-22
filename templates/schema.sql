-- Starter schema for a multi-tenant POS. SQLite / D1 syntax; works on Postgres with small type changes.
-- Money in integer cents, rates in basis points, times in epoch milliseconds (UTC).
-- Every tenant-owned row carries tenant_id and every query filters on it.

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'plate',          -- plate | salon | clinic | dental | fit | shelf
  region TEXT NOT NULL DEFAULT 'nz',              -- nz | ca | ...
  province TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL,
  currency TEXT NOT NULL,
  tax_rate_bp INTEGER NOT NULL,
  tax_inclusive INTEGER NOT NULL DEFAULT 1,
  tax_number TEXT NOT NULL DEFAULT '',
  tips_enabled INTEGER NOT NULL DEFAULT 1,
  surcharge_bp INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'trial',           -- trial | active | suspended | cancelled
  review_status TEXT NOT NULL DEFAULT 'live',     -- draft | pending | live (self-signups start as draft)
  created_at INTEGER NOT NULL
);

CREATE TABLE domains (host TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id));

CREATE TABLE tenant_modules (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, module)
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  hours TEXT NOT NULL,                            -- {"0":[open_min, close_min]}, close may exceed 1440
  business_day_cutoff_min INTEGER NOT NULL DEFAULT 300,  -- 05:00
  online INTEGER NOT NULL DEFAULT 1,
  paused_until INTEGER NOT NULL DEFAULT 0,
  max_orders_per_15 INTEGER NOT NULL DEFAULT 0,
  qr_pay_later INTEGER NOT NULL DEFAULT 0,
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);

CREATE TABLE staff_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,                             -- kitchen | staff | manager | owner | driver
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  pin_lookup TEXT,                                -- HMAC(pin, PIN_PEPPER)
  pin_hash TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, pin_lookup)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  station TEXT NOT NULL DEFAULT 'kitchen',
  days TEXT NOT NULL DEFAULT '',                  -- "12345" or '' for every day
  from_min INTEGER, to_min INTEGER,               -- served only in this window (to may pass midnight)
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  delivery_price_cents INTEGER,
  modifiers TEXT NOT NULL DEFAULT '[]',
  allergens TEXT NOT NULL DEFAULT '[]',
  spice INTEGER NOT NULL DEFAULT 0 CHECK (spice BETWEEN 0 AND 3),
  plu TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  age_check INTEGER NOT NULL DEFAULT 0,
  open_price INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 0,        -- appointments: length
  buffer_min INTEGER NOT NULL DEFAULT 0,
  external_id TEXT NOT NULL DEFAULT '',           -- id in the business's own POS
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_items_tenant ON menu_items(tenant_id, category_id);

CREATE TABLE sold_out (
  tenant_id TEXT NOT NULL, branch_id TEXT NOT NULL, item_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'manual',          -- manual | stock (stock is cleared on restock)
  PRIMARY KEY (tenant_id, branch_id, item_id)
);

CREATE TABLE tables_ (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL, branch_id TEXT NOT NULL,
  label TEXT NOT NULL, area TEXT NOT NULL DEFAULT '', covers INTEGER NOT NULL DEFAULT 4,
  qr_token_hash TEXT UNIQUE
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  branch_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,                           -- web | pos | phone | kiosk | app | qr
  mode TEXT NOT NULL,                             -- pickup | delivery | dine-in | tabpay
  status TEXT NOT NULL,                           -- pending_payment | paid | in_kitchen | ready | done | open | closed | cancelled
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  table_id TEXT, tab_order_id TEXT,
  customer_name TEXT NOT NULL DEFAULT '', customer_phone TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  manual_discount_cents INTEGER NOT NULL DEFAULT 0,
  reward_cents INTEGER NOT NULL DEFAULT 0,
  delivery_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT NOT NULL DEFAULT '',
  target_at INTEGER,                              -- order ahead
  payment_provider TEXT NOT NULL DEFAULT '', payment_ref TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, paid_at INTEGER, closed_at INTEGER,
  UNIQUE (tenant_id, number)
);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, branch_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at);
CREATE INDEX idx_orders_open_tab ON orders(tenant_id, table_id, status);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id),
  item_id TEXT NOT NULL, name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 50),
  unit_cents INTEGER NOT NULL,                    -- frozen at add time
  mods TEXT NOT NULL DEFAULT '[]', note TEXT NOT NULL DEFAULT '', seat INTEGER,
  sent_at INTEGER, voided INTEGER NOT NULL DEFAULT 0, void_reason TEXT NOT NULL DEFAULT '', voided_by TEXT
);
CREATE INDEX idx_items_order ON order_items(tenant_id, order_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL, order_id TEXT NOT NULL,
  kind TEXT NOT NULL,                             -- payment | refund
  method TEXT NOT NULL,                           -- cash | card_terminal | card_online | gift_card | deposit | tab_share | insurance | other
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  tip_cents INTEGER NOT NULL DEFAULT 0,
  ref TEXT NOT NULL DEFAULT '',                   -- provider ref, or the payment id a refund reverses
  status TEXT NOT NULL DEFAULT 'ok',              -- ok | failed (provider refund failed)
  label TEXT NOT NULL DEFAULT '',
  staff_id TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX idx_payments_order ON payments(tenant_id, order_id);
CREATE INDEX idx_payments_ref ON payments(tenant_id, ref);

CREATE TABLE kitchen_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL, branch_id TEXT NOT NULL, order_id TEXT NOT NULL,
  station TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'new',  -- new | change | void | cancel
  lines TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',         -- held | waiting | done | bumped
  release_at INTEGER, sent_at INTEGER NOT NULL, bumped_at INTEGER
);
CREATE INDEX idx_tickets_kitchen ON kitchen_tickets(tenant_id, branch_id, status);

CREATE TABLE customers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, phone TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), sms_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, UNIQUE (tenant_id, phone)
);
CREATE TABLE points_ledger (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, customer_id TEXT NOT NULL, order_id TEXT, delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX idx_points_earn_once ON points_ledger(tenant_id, order_id, reason) WHERE order_id IS NOT NULL;

CREATE TABLE giftcards (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, last4 TEXT NOT NULL,
  balance_cents INTEGER NOT NULL CHECK (balance_cents >= 0), status TEXT NOT NULL,  -- pending | active | void
  test_money INTEGER NOT NULL DEFAULT 0, expires_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE giftcard_ledger (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, card_id TEXT NOT NULL, order_id TEXT, delta_cents INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, branch_id TEXT NOT NULL,
  starts_at INTEGER NOT NULL, party INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
  provider_id TEXT, service_id TEXT, ends_at INTEGER,       -- appointments
  status TEXT NOT NULL, deposit_cents INTEGER NOT NULL DEFAULT 0, deposit_used INTEGER NOT NULL DEFAULT 0,
  hold_until INTEGER, reminder_sent_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX idx_bookings_slot ON bookings(tenant_id, branch_id, starts_at);

CREATE TABLE webhook_events (provider TEXT NOT NULL, event_id TEXT NOT NULL, received_at INTEGER NOT NULL, PRIMARY KEY (provider, event_id));
CREATE TABLE idempotency (tenant_id TEXT NOT NULL, key TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (tenant_id, key));

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '', before TEXT, after TEXT, reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at);
