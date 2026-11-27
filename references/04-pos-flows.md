# POS flows

## Floor and tabs

- Areas and tables with labels and covers. One open tab per table, enforced (see POS-01).
- Counter sales are tabs without a table.
- A tab holds lines; each line has seat (optional), sent_at, voided, unit price frozen at add time.
- Actions: add, change qty, void (manager if sent), send round, discount (manager), attach loyalty member, apply gift card, take deposit off, print bill, move, merge, split, pay, cancel (empty or manager).

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

Every payment goes through the optimistic lock on `paid_cents`. Close when covered.

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

## Screen behaviour on a busy shift

Staff tap fast, with wet hands, on a slow kitchen Wi-Fi. The money core protects the data; these keep the screens honest. (Same list, for websites: no-slop-web `references/interaction-details.md`.)

- **One tap, one action.** Pay, Send, Fire, Refund and Close tab lock the moment they are tapped and show they are working, then unlock on failure with the reason. The server is idempotent anyway (rule 4); the lock stops the second tap reaching it.
- **Targets sized for thumbs.** POS and kitchen buttons at least 44 by 44 pixels (bigger for bump and pay), with space between Remove and Add. Small icons get a larger invisible hit area, not a larger icon.
- **No theme flash.** Kitchen screens run dark; set the theme before first paint so a reload at 9pm doesn't flash white.
- **Reserve space.** Menu photos, the order rail and live-updating totals keep a fixed size so a tile doesn't jump under a finger as data loads.
- **Enter does the obvious thing.** PIN pads, search and payment amount fields submit on Enter (real forms), so a keyboard or barcode scanner works.
- **Validate when the field is left.** Phone numbers, emails and gift card codes check on blur and on submit, not on every keystroke.
- **Every state is a screen.** Loading has a time limit; offline says "Offline, 3 changes waiting" (never an endless spinner); a failed payment says what to do next; typed input is never lost.
- **Toasts that wait.** "Order sent" and "Undo void" pause while touched or hovered; errors stay until dismissed; announced with role="status" or "alert".
- **Share previews.** Guest-facing pages (menu, order tracking, bookings) carry a designed Open Graph image so the link looks right when a guest shares it.
- **Tablet and phone basics.** Inputs at 16px or more so iPad Safari doesn't zoom on focus (PIN and amount pads bigger still); `touch-action: manipulation` on every control so fast taps on +/- or the keypad count twice instead of zooming; hover styles only inside `@media (hover: hover)` so tapped buttons don't stay highlighted; tap flash replaced with a real `:active` state.
- **Right keyboard every time.** `inputmode="decimal"` for amounts and tips, `numeric` for PINs, table numbers and codes, `type="tel"` for guest phones, `type="email"` for receipts by email, `autocomplete="one-time-code"` on staff 2FA and guest verification codes, `enterkeyhint` on search (search) and the last field (done).
- **Scroll stays put.** `overscroll-behavior: contain` on the order panel, menus, modals and the kitchen lanes so the screen behind doesn't move and pull-to-refresh can't reload the POS mid-order; category and ticket rows snap to items. Fixed kiosks and customer displays may lock zoom; staff and guest screens never do.
