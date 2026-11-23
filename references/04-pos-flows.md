# POS flows

## Floor and tabs

- Areas and tables with labels and covers. One open tab per table, enforced (see POS-01).
- Counter sales are tabs without a table.
- A tab holds lines; each line has seat (optional), sent_at, voided, unit price frozen at add time.
- Actions: add, change qty, void (manager if sent), send round, discount (manager), attach loyalty member, apply gift card, take deposit off, print bill, move, merge, split, pay, cancel (empty or manager).
- Manager approval on the server's tablet: a PIN authorises one request only (POS-23).
- Courses: hold later courses until fired; paying sends anything held (POS-24). Moves and merges carry their tickets and are refused once a bill has a payment (POS-25).
- Discounts can target one dish or one seat, shared by value (POS-26, `allocate()` in `scripts/money.js`). A manager can reopen a paid tab within a window (POS-28).

## Rounds

"Send" takes every unsent, unvoided line, marks it sent in the same statement and creates kitchen tickets per station. Pressing Send twice sends nothing new. Counter tabs paid before sending are sent automatically on close.

## Payments at the till

| Method | Notes |
|---|---|
| Cash | Overpay allowed, change shown |
| Card terminal (integrated) | Amount pushed to the terminal, one at a time per terminal, result claimed once |
| Card (standalone) | Staff confirm the amount; recorded only |
| Gift card | Atomic spend, returns the amount actually taken |
| Deposit | Booking deposit, used once |
| Online share | From QR guests, moved onto the tab |
| Insurance | Clinic verticals; not refundable from the bill |
| Other | Vouchers, house accounts; label required |

Every payment goes through the optimistic lock on `paid_cents` and records what it covered (a seat, a share or dishes, POS-27). Take cash first and send only the remainder to the terminal. Close when covered.

House accounts charge up to a limit in one statement with a ledger row and monthly statements (POS-31). Catering orders carry a deposit and reach the kitchen hours before the event (POS-32).

## Offline mode

```
action -> online and queue empty? -> send with Idempotency-Key -> ok: done
                 |                                   | network error / timeout
                 v                                   v
            save to IndexedDB queue  <---------------+
            update screen locally
reconnect -> replay in order -> network error: stop, try later
                             -> refused (4xx): set aside, show, continue
                             -> ok: drop from queue
```

Allowed offline: open tabs, add/void lines, send to kitchen (queued), cash, standalone card, other. Not allowed: integrated terminals, gift cards, loyalty, server-checked discounts, deposits. Show a banner with the waiting count and any refused changes. Cache the app shell, menu and floor plan in the service worker.

Server side: before running a POS change, look up `(tenant_id, idempotency_key)`; if present return the stored response; otherwise run and store the response in the same transaction.

## Live updates

One hub per tenant. Any change (paid order, bump, payment, booking, call for staff) broadcasts a small "refresh X" message; screens re-fetch. Polling every 15 to 30 seconds stays as a fallback. Show connection state.

## Close of day

Z report per branch, cash count vs expected, open tabs list, empty tabs to cancel, unsent lines warning, offline queue warning per device.
