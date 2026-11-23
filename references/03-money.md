# Money

Reference implementation: `scripts/money.js`, tests in `scripts/money.test.mjs` (`node --test scripts/money.test.mjs`).

## Pricing a cart

Input from the client: `[{ itemId, qty, mods: [optionId], note }]`. Nothing else.

1. Reject empty carts and carts over 50 lines.
2. For each line: item must exist, be active, not sold out at this branch; qty an integer 1 to 50.
3. Options: a "pick one" group takes exactly one (default to the first); a "pick many" group takes any subset; unknown option ids are rejected; chosen ids are a set (duplicates do not charge twice).
4. `unit_cents = item.price_cents + sum(option.price_cents)`.
5. Clean the note: one line, 140 characters.

## Totals

```
subtotal  = sum(unit_cents * qty)
discount  = clamp(promo, 0, subtotal)            promo only if active and subtotal >= min
discount  = min(subtotal, discount + manual)     manual discounts stack, capped
reward    = clamp(reward, 0, subtotal - discount)
base      = subtotal - discount - reward + delivery
inclusive: total = base; tax = round(total * bp / (10000 + bp))
exclusive: tax = round(base * bp' / 10000); total = base + tax
           bp' = rebate rate when the food part is under the rebate limit
```

Then tip (not taxed) on top, gift card and deposit payments against the total.

## Surcharges

A card surcharge is a bill line, so it is taxed and reported like any sale. Compute it from the rest of the bill before tax, cap it (2.4% in Canada), recompute on every recalc, never send it to the kitchen, never apply it to debit, never in Quebec.

## Tips

Separate from sales and tax. Online: capped at 30% and a fixed maximum. Terminal: as returned by the terminal. Pooled by hours worked; delivery tips go to the driver who delivered.

## Split bills

- Even split: shares from what is still due; the last share takes the remainder so they always sum.
- By item or seat: unseated items shared evenly.
- Online share (QR): its own order, moved onto the tab when paid, excluded from sales totals so nothing counts twice.

## Balances

Points, gift cards, deposits, `paid_cents`: atomic SQL update plus a ledger row.

```sql
UPDATE giftcards SET balance_cents = balance_cents - ?1
 WHERE tenant_id = ?2 AND id = ?3 AND balance_cents >= ?1 RETURNING balance_cents;
-- no row: not enough balance (or someone spent it first)
```

## Refunds

Against a specific payment. Claim first, in one statement, so two taps can never refund the same money:

```sql
INSERT INTO payments (id, tenant_id, order_id, kind, method, amount_cents, ref)
SELECT ?, ?, ?, 'refund', p.method, ?, p.id FROM payments p
 WHERE p.tenant_id = ? AND p.id = ? AND p.kind = 'payment'
   AND ? + COALESCE((SELECT SUM(amount_cents) FROM payments r WHERE r.tenant_id = p.tenant_id AND r.ref = p.id AND r.kind = 'refund'), 0) <= p.amount_cents;
```

Then call the provider. If the provider call fails, mark the refund row failed and show it; never delete it silently.

## Sharing amounts across lines

Three helpers in `scripts/money.js` keep shares summing exactly:

- `allocate(amount, lineValues)`: a discount over chosen dishes or a seat, by value; the last line takes the remainder; no share above its line (POS-26).
- `lineRefundCents(lineNet, allNet, charged, tip, paid)`: one dish's share of what was actually charged, tip left out, capped at what was paid (REF-10).
- `splitTips(pot, scores)`: tip pools by hours or weighted hours in whole cents, leftover cents to the highest score (STF-09).

## Daily journal (accounting export)

One balanced journal per business day.

| Side | Lines |
|---|---|
| Debit | Money in by method (cash, card, online, gift card spent from liability) |
| Credit | Sales before tax, tax, tips, gift cards sold (liability), deposits held (liability) |

Refunds reverse their method and sale. Online table shares are already counted on the tab payment, so they are skipped. Lines mapping to the same account merge; a negative line flips side; zero lines drop. Test: debits minus credits is 0 for every day in a random month of generated data.

## Reports

Z report per business day (cutoff, not midnight): sales by method, tax, tips, discounts, voids, refunds, covers. X report mid-shift. Every number reproducible from rows, never stored totals alone.
