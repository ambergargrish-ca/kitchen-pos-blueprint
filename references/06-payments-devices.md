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
- Answer fast (some providers need a reply within seconds), do slow work after.

## Live mode guard

```
if (LIVE_PAYMENTS !== '1' && key.startsWith('sk_live_')) refuse
if (LIVE_PAYMENTS === '1' && key.startsWith('sk_test_')) refuse
if (LIVE_PAYMENTS === '1' && anyMockSwitchOn) refuse to start
```

## Payouts (platform model)

Use a Connect-style marketplace product so each business has its own processor account and the platform fee is taken as an application fee on each charge. Decide before launch who carries negative balances (the processor's managed-risk option, or a reserve you hold). Processors without Connect: invoice the commission monthly.

## Card terminals

- Integrated: the POS sends the amount (server-driven readers such as Stripe Terminal; host-initiated APIs such as Windcave HIT). Show the terminal's messages. One payment per terminal at a time. Claim the result once (polling and webhooks may both report it). Staff can cancel.
- Standalone: record the method and amount staff confirm.
- Readers belong to the business's processor account; every call carries that account id.
- Mock terminal for tests (for example: amounts ending in 05 cents decline), dead in live mode.

## Surcharges (Canada)

Credit only, never debit or prepaid, capped at the merchant's cost and 2.4%, 30 days notice to the processor and networks, signs at the door and till, a separate receipt line, not in Quebec. Owner confirms the notice in settings before the switch turns on.

## Card fee calculator (optional sales tool)

Compare flat pricing vs interchange-plus using card sales, average bill, online share and debit share; show what a surcharge would recover. Date the published rates.

## Other devices

Kiosk (paired by one-time link, device token, idle reset), receipt printers (copy, reprint), cash drawer (opens on cash payment only, logged), handhelds (same app, phone layout).
