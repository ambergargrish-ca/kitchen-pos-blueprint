# Payments and devices

## Online checkout

1. Create the order as `pending_payment` with server totals.
2. Create a hosted checkout session (Stripe Checkout, Windcave hosted page, HelcimPay.js or similar) for exactly `total + tip - gift card`. Card data never touches your servers.
3. If session creation fails, cancel the order and tell the guest.
4. Mark paid only from a verified webhook or a server-side read of the transaction: approved, same amount, same currency, not used before, same live/test mode.
5. On paid: send to the kitchen (or hold for order ahead), award points, text the guest, push to their POS if connected.
6. Clean-up job cancels unpaid orders after 45 minutes and returns held balances. A late payment for a cancelled order raises a refund task.

## Webhooks

- Verify signatures on the raw body (HMAC, constant-time compare). Each provider has its own scheme; some send two destinations (platform account and connected accounts) with different secrets.
- Insert `(provider, event_id)` into `webhook_events` first; on conflict, return 200 and stop.
- If the work after that insert fails, delete the row and answer with an error so the provider's retry is processed (PAY-13). Only a final result (paid, refunded) should block later notifications for the same payment; an early "not complete yet" notification must not.
- Answer fast (some providers need a reply within seconds), do slow work after.

## Live mode guard

```
if (LIVE_PAYMENTS !== '1' && /^(sk|rk)_live_/.test(key)) refuse
if (LIVE_PAYMENTS === '1' && !/^(sk|rk)_live_/.test(key)) refuse
if (LIVE_PAYMENTS === '1' && anyMockSwitchOn) refuse to start
```

Accept restricted keys (`rk_`) as well as secret keys (`sk_`) of the right mode (PAY-16). A demo business may keep a built-in test checkout after go-live as long as it never charges a card and real businesses never see it.

## Card holds for order ahead

For scheduled orders, authorise the card at checkout and capture it when the order is released to the kitchen. Cancelling before release only voids the hold, so there is no refund and no card fee. Keep order-ahead shorter than the provider's hold window (Stripe documents about 7 days for most online card holds; check yours). If the capture fails at release, cancel before anything is cooked and tell the guest; retry temporary errors on the next run. See PAY-14.

## Card disputes

Listen for dispute events, match each to its order (and check the connected account on the event owns that order), record the status and alert the business once with the evidence due date. Build the evidence from the order record: items, when it was placed, paid, ready, collected or delivered (with the courier's proof of delivery), or that it was kept and not collected. See PAY-15.

## Payouts (platform model)

Use a Connect-style marketplace product so each business has its own processor account and the platform fee is taken as an application fee on each charge. Create each connected account with the business's own country and an idempotency key (PAY-17). Decide per plan whether commission is taken at checkout or billed on the invoice, in one place (TEN-10), and on refunds ask for the fee back or reverse a transfer only when the charge had them (PAY-18). Decide before launch who carries negative balances (the processor's managed-risk option, or a reserve you hold). Processors without Connect: invoice the commission monthly.

## Card terminals

- Integrated: the POS sends the amount (server-driven readers such as Stripe Terminal; host-initiated APIs such as Windcave HIT). Show the terminal's messages. One payment per terminal at a time. Claim the result once (polling and webhooks may both report it). Staff can cancel.
- Some terminal APIs answer "sent to the device" and the payment shows up later as a transaction carrying your invoice number; a decline leaves nothing and there may be no cancel call. Poll for your reference and wait until staff cancel (TRM-08).
- Standalone: record the method and amount staff confirm. An owner can require connected terminals only, so a keyed payment needs a manager (TRM-09).
- Amount-only charges (a business keeping its own POS): no tax added, never a kitchen ticket (POS-29).
- Readers belong to the business's processor account; every call carries that account id.
- Mock terminal for tests (for example: amounts ending in 05 cents decline), dead in live mode.

## Surcharges (Canada)

Credit only, never debit or prepaid, capped at the merchant's cost and 2.4%, 30 days notice to the processor and networks, signs at the door and till, a separate receipt line, not in Quebec. Owner confirms the notice in settings before the switch turns on. (Network rules checked 22 November 2026: Mastercard Canada still lists a 2.4% cap and 30 days notice.)

New Zealand: a bill to ban surcharges on in-person card payments was before Parliament and not yet law as of 21 November 2026. Build the surcharge as a per-region switch with an effective date (REG-06). Check the current law with a lawyer before relying on either rule.

## Card fee calculator (optional sales tool)

Compare flat pricing vs interchange-plus using card sales, average bill, online share and debit share; show what a surcharge would recover. Date the published rates.

## Other devices

Kiosk (paired by one-time link, device token, idle reset), receipt printers (copy, reprint), cash drawer (opens on cash payment only, logged), handhelds (same app, phone layout).

- Cloud printers that poll for work (for example Star CloudPRNT, Epson Server Direct Print) need no PC on site. A job sent but not confirmed returns to the queue after about a minute (DEV-06).
- Cash drawer on the printer's drawer port: opens on a live cash payment, not on an offline replay; drawer jobs go first, once, and expire after a couple of minutes; a manual "open till" is a logged no-sale on the Z report (DEV-07).
- Customer-facing display and a public pickup board: dishes, money and order numbers only (POS-30).
