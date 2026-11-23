# Edge case catalog

Every case here broke, or would have broken, a real flow. Each entry has an id, a priority, what goes wrong and the rule that prevents it.

- **P0**: money, data leaks between businesses, legal exposure, or a stuck service. Must have a passing automated test before go-live.
- **P1**: wrong numbers in reports, bad guest or staff experience, support load. Test before the area is called done.
- **P2**: polish and rare paths. Test when touched.

Copy the ids into `templates/edge-case-matrix.csv` and link each to its test.

---

## 1. Money and pricing (MON)

- **MON-01 (P0) Floating point totals.** `0.1 + 0.2` gives bills off by a cent and journals that never balance. **Rule:** integer cents everywhere, rates in basis points, one rounding step per tax calculation.
- **MON-02 (P0) Client-sent prices.** A tampered request orders a $28 dish at $0.01. **Rule:** the client sends ids and quantities only; price from the database on every request and ignore any price field.
- **MON-03 (P0) Negative quantities or zero.** Qty -3 turns an order into a refund. **Rule:** integers 1 to 50; reject strings that are not whole numbers; accept numeric strings ("2") only after conversion.
- **MON-04 (P0) Duplicated option ids.** `mods: [cheese, cheese, cheese]` charged three times, or used to sneak a free option. **Rule:** treat chosen options as a set; reject unknown option ids for that item.
- **MON-05 (P1) Single-choice group with nothing picked.** Order goes to the kitchen with no size. **Rule:** default to the first option of a "pick one" group and charge it; reject more than one pick.
- **MON-06 (P0) Percent promo above 100.** A misconfigured 150% code makes the bill negative. **Rule:** clamp every discount to between 0 and the subtotal.
- **MON-07 (P0) Stacked discounts.** Promo + manual discount + reward exceed the bill. **Rule:** apply in a fixed order (promo, manual, reward) and cap each at what is left; the base before tax never goes below zero.
- **MON-08 (P1) Promo minimum spend.** Guest removes items after applying a code. **Rule:** re-check the minimum on every re-price, including on tabs after a void.
- **MON-09 (P1) Inactive or expired promo still on an open tab.** **Rule:** re-validate on recalc; drop it with a visible note rather than silently.
- **MON-10 (P0) Tax inclusive vs exclusive mixed up.** NZ prices include 15% GST (tax = total x 15/115); Canada adds tax on top. **Rule:** a `tax_inclusive` flag per tenant, one `totals()` function with both branches, tests for each.
- **MON-11 (P0) Rounding tax per line vs per bill.** Per-line rounding drifts a cent from the receipt the provider shows. **Rule:** round once on the whole base; document it; match the receipt.
- **MON-12 (P1) Half-cent rounding.** 6.5c must become 7c consistently (round half up) in server and browser. **Rule:** one shared rounding helper; test 6.5 and 6.49.
- **MON-13 (P0) Discounts after tax.** Taxing the pre-discount price overcharges tax. **Rule:** discounts and rewards come off before tax; delivery is taxed like the food (check the local rule).
- **MON-14 (P1) Free items.** A $0 dish or 100% discount produces divide-by-zero in margin reports or a $0 card charge. **Rule:** allow $0 lines; skip the card step when the total is $0 and close the bill as "No charge".
- **MON-15 (P1) Empty cart.** **Rule:** reject with a clear message; never create an order with no lines.
- **MON-16 (P1) Oversized cart.** 5,000 lines time out the request and the kitchen printer. **Rule:** cap lines per order (50) and per QR round (40).
- **MON-17 (P1) Kitchen notes.** Multi-line notes or emoji break printers and layouts; very long notes hide the next ticket. **Rule:** collapse whitespace, trim to 140 characters, escape on output.
- **MON-18 (P0) Item deactivated mid-checkout.** Guest pays for a dish removed a minute ago. **Rule:** re-price at payment time; refuse inactive items with "please refresh".
- **MON-19 (P0) Sold out between cart and pay.** **Rule:** check the branch's sold-out set when pricing and again before the ticket goes out; refund automatically if it fails after payment.
- **MON-20 (P1) Price change on an open tab.** Manager changes a price while a table is eating. **Rule:** order lines store `unit_cents` at the time of adding; recalc uses stored line prices, not today's menu.
- **MON-21 (P1) Channel pricing.** Delivery price differs from dine-in. **Rule:** per-dish delivery price or a markup rounded to the cent; the same price goes to the delivery apps.
- **MON-22 (P1) Currency display.** "$12.5", "12.50 $" in French Canada, missing value shown as "NaN". **Rule:** one formatter per side (server and browser); missing values format as zero.
- **MON-23 (P2) Marketing prices.** "$49.00" on a price page. **Rule:** drop ".00" only on marketing pages, never on receipts.
- **MON-24 (P0) Tip abuse online.** A $9,999 tip on a $10 order used to launder a stolen card. **Rule:** cap tips (30% and a fixed maximum); record tips separately with no sales tax.
- **MON-25 (P1) Tips switched off.** Owner turns tips off but an old checkout page still sends one. **Rule:** server ignores tips when the tenant has them off.
- **MON-26 (P1) Small-bill tax rebates.** Ontario restaurants do not charge the provincial part of HST on prepared food and drinks of $4.00 or less (no alcohol). **Rule:** apply on food after discounts, not counting delivery; test $4.00 and $4.01.
- **MON-27 (P1) Combined tax rates.** Quebec style 14.975% must round once on the whole bill, and needs two tax lines on the receipt. **Rule:** model multi-component tax as components summed, rounded per component as the law requires; do not ship a region you have not modelled.
- **MON-28 (P1) Rates are defaults, not truth.** Province default rates change and some items are taxed differently (alcohol PST). **Rule:** tenant can edit its rate; note that an accountant has the final say.

## 2. Tabs and the POS (POS)

- **POS-01 (P0) Two tabs on one table.** Two phones (or a phone and a server) open the table's tab at the same moment. **Rule:** after insert, re-read open tabs for the table ordered by creation; keep the oldest and cancel the newer one.
- **POS-02 (P0) Two staff pay the same tab at once.** Both payments land and the guest is charged twice. **Rule:** optimistic lock: `UPDATE ... SET paid_cents = paid_cents + ? WHERE id = ? AND paid_cents = ?`; on no row, re-read and retry (up to 3 times), then surface the conflict.
- **POS-03 (P0) Overpaying.** Payment larger than what is due. **Rule:** cash allows overpay with change shown; card, gift card and online shares are capped at what is due; any excess from a late online share is logged for refund.
- **POS-04 (P0) Closing a tab that is not fully paid.** **Rule:** close only when `paid_cents >= total_cents`; record "Split: Cash + EFTPOS" style method summaries.
- **POS-05 (P0) Adding items after someone started paying.** Totals change under a half-paid bill. **Rule:** a partly paid tab is locked for guest rounds; staff can add only with a re-split prompt.
- **POS-06 (P0) Voiding an item already sent to the kitchen.** Staff void food that was cooked, hiding theft. **Rule:** voids of sent items need a manager (PIN), a reason, and an audit row; the kitchen sees a void ticket.
- **POS-07 (P1) Voiding the last item.** Tab total becomes zero but stays open forever. **Rule:** allow cancelling an empty tab; empty tabs older than the business day show on the close-of-day screen.
- **POS-08 (P1) Move tab to an occupied table.** **Rule:** refuse or merge explicitly; never create two open tabs on one table.
- **POS-09 (P1) Merge tabs with different promos or loyalty members.** **Rule:** pick one member and one promo; show the result before confirming.
- **POS-10 (P1) Split by seat when items have no seat.** **Rule:** unseated items go to a "shared" bucket split evenly; seat numbers are optional.
- **POS-11 (P0) Even split leaves a cent.** $100.00 / 3 = 33.33 x 3 = 99.99. **Rule:** the last share takes the remainder; shares always sum to the total.
- **POS-12 (P1) Split up to N ways.** Split 6 ways then one person leaves. **Rule:** shares are re-derived from what is still due, not stored as fixed amounts.
- **POS-13 (P1) Counter sale paid before sending.** Food not sent because no "Send" was pressed. **Rule:** when a counter tab closes as paid, send unsent lines to the kitchen automatically.
- **POS-14 (P1) Phone or web order paid at the counter.** **Rule:** a "pay at the counter" list; the same close-if-paid logic as tabs; status stays with the original order flow.
- **POS-15 (P0) Surcharge line drifting.** Card surcharge computed once, then items added. **Rule:** the surcharge is a special line that is recomputed from the rest of the bill (before tax) on every recalc and never goes to the kitchen.
- **POS-16 (P0) Surcharging debit.** Illegal in Canada (credit only), illegal in Quebec at all. **Rule:** staff add the surcharge only when the guest pays the whole bill by credit; remove it if they switch to debit; refuse in Quebec and outside the allowed region.
- **POS-17 (P1) Manual discount by floor staff.** **Rule:** manual discounts and comps need a manager; tag the sale ("Complimentary", "Staff meal").
- **POS-18 (P1) Print bill, then change.** The printed bill no longer matches. **Rule:** print shows a version or time; the payment screen always uses the live total.
- **POS-19 (P1) Open-price items.** "Misc food $?" used to hide sales. **Rule:** manager only above a threshold, logged, never sold online or by phone.
- **POS-20 (P1) Business day past midnight.** A bar closes at 2am; the Z report splits the night across two days. **Rule:** a business-day cutoff per branch (for example 5am); sales belong to the day the shift started.
- **POS-21 (P1) Z report run twice or mid-shift.** **Rule:** a Z report is a read of closed data for a business day; X reports are mid-shift; both reproducible.
- **POS-22 (P2) Handheld screens.** Long menus on a phone. **Rule:** two-column buttons and a fixed bottom bar with total, Send, Bill, Pay.
- **POS-23 (P0) Manager approval on a server's tablet.** A server needs a manager for a void or comp, and the manager signs in on the server's tablet and forgets to sign out. **Rule:** the manager types a PIN that authorises that one request only; allowed only for POS and order actions (voids, comps, discounts, refunds), never settings, people or payment setup; wrong PINs rate limited; the audit row names both the server and the manager.
- **POS-24 (P1) Courses fired too early or never.** Mains reach the kitchen with the starters, or a held course is forgotten when the table pays. **Rule:** later courses stay off the kitchen screen until the server fires them, each fired course is its own ticket, and paying the bill sends anything still held.
- **POS-25 (P1) Moving or merging dishes between tabs.** Dishes move but their tickets stay behind, or a dish moves off a bill someone already paid part of. **Rule:** moved dishes keep their kitchen ticket; a merge moves every dish and ticket and closes the old tab; refuse a move when either bill has a payment on it; handing a tab to another server is limited to managers or the server who has it.
- **POS-26 (P1) Discounts on single dishes or one seat.** A fixed amount off three dishes is split unevenly or leaves a cent over. **Rule:** share the amount by line value, round each share, let the last line take the remainder, never more than a line's own value, and take it off before tax like a bill discount, with a reason and a manager.
- **POS-27 (P1) A split payment that forgets what it paid for.** Seat 2 pays, then the bill is re-split and seat 2 is asked again. **Rule:** every payment records what it covered (a seat, one of N even shares, or a list of dishes); take cash first and send only the remainder to the card terminal.
- **POS-28 (P1) Reopening a paid tab.** A forgotten dessert after the bill closed. **Rule:** a manager may reopen a paid tab within a set window (for example 24 hours); logged with who and why; the reopened tab takes new dishes and a new payment, never edits the old one.
- **POS-29 (P1) Charging an amount without items.** A business keeping its own POS wants to use your terminal for a check total. **Rule:** an amount-only charge with a reference (their check number) records the payment only: no tax added (it was worked out on their POS), never a kitchen ticket, a receipt on approval.
- **POS-30 (P1) Guest-facing screens show too much.** The customer display or a pickup board leaks staff names, kitchen notes or guest names. **Rule:** the customer display shows dishes, discounts, tax, total and status only; a public "now serving" board shows order numbers only (no names) and leaves table orders off.
- **POS-31 (P0) House account limit passed by two tablets.** **Rule:** charge to an account with the limit check and the balance change in one SQL statement, a ledger row per change (charge, payment, refund, adjustment), a manager to go over the limit, and statements built from the ledger with opening and closing balances.
- **POS-32 (P1) Catering orders cooked at the wrong time.** **Rule:** minimum notice and a furthest date ahead; the quote is sent with a deposit link and the deposit lands on the catering bill once paid; the kitchen gets the order a set number of hours before the event, not when it is booked.

## 3. Offline mode (OFF)

- **OFF-01 (P0) Internet drops mid-service.** **Rule:** the POS keeps working: open tabs, add and void items, send to kitchen, take cash, standalone card or other payments; changes saved locally (IndexedDB).
- **OFF-02 (P0) Replay runs twice.** Reconnect, timeout, retry: the item is added twice. **Rule:** every change carries an Idempotency-Key generated on the device; the server stores key + response and returns the stored response on repeats.
- **OFF-03 (P0) Replay out of order.** Pay arrives before the items it pays for. **Rule:** replay strictly in order; stop at the first network failure; a refused change is set aside (and shown) and the queue continues.
- **OFF-04 (P0) Offline tab opens twice.** An offline tab is created locally, then again on replay. **Rule:** the device's local tab id maps to one server tab (idempotent create).
- **OFF-05 (P0) Actions that cannot work offline.** Integrated terminals, gift cards, loyalty spending, discounts that need a server check, deposits. **Rule:** disable them offline with a clear reason; never fake success.
- **OFF-06 (P1) First request still running when offline starts.** **Rule:** treat "unknown result" as "retry with the same key", never as failure.
- **OFF-07 (P1) Tablet wiped or cache cleared while offline.** Changes lost. **Rule:** a banner always shows how many changes are waiting; warn on sign-out with a non-empty queue.
- **OFF-08 (P1) App shell offline.** **Rule:** service worker caches the shell, menu and floor plan; version the cache so a deploy does not strand old code.
- **OFF-09 (P1) Menu changed while a device was offline.** **Rule:** replayed lines keep the price at the time they were added; flag items that no longer exist instead of failing the whole queue.
- **OFF-10 (P1) Clock skew on the device.** **Rule:** the server stamps times; the device time is kept only as "happened at" for the audit trail.

## 4. Kitchen display (KDS)

- **KDS-01 (P0) Ticket never arrives.** Live connection dropped silently. **Rule:** WebSocket push plus a polling fallback; a visible "connected / reconnecting" dot; chime on new tickets.
- **KDS-02 (P0) Ticket sent twice.** Retry or double tap sends a round twice and two dishes are cooked. **Rule:** a round is a set of unsent lines; sending marks them sent in the same statement; repeats send nothing.
- **KDS-03 (P1) Station routing.** A dish with no station never shows anywhere. **Rule:** unrouted sections fall back to the main kitchen; the expo screen sees everything.
- **KDS-04 (P1) Partial bump.** One station is done, the ticket disappears for others. **Rule:** stations mark their part done; only the pass/expo bumps the whole ticket.
- **KDS-05 (P1) Bumped by mistake.** **Rule:** recall a bumped ticket for 30 minutes.
- **KDS-06 (P1) Voids and changes after sending.** **Rule:** send a change ticket ("VOID 1 Butter chicken") rather than editing a ticket the cook already read.
- **KDS-07 (P1) Order-ahead tickets fire too early.** A 7pm pickup cooked at 4pm. **Rule:** hold paid future orders and release at slot time minus prep time; show the target time on the ticket.
- **KDS-08 (P1) Kitchen overwhelmed.** **Rule:** throttle online orders per 15 minutes and a "pause online orders until" switch on the kitchen screen.
- **KDS-09 (P2) Timers.** **Rule:** amber after 8 minutes, red after 15, measured from when the ticket was sent (not when the order was created).
- **KDS-10 (P1) All-day counts.** **Rule:** count only unbumped, unvoided lines.
- **KDS-11 (P1) Unpaid online orders reaching the kitchen.** **Rule:** online orders go to the kitchen only after payment is confirmed; pay-at-counter orders go straight away by design and are marked.
- **KDS-12 (P1) Delivery app cancels after cooking started.** **Rule:** show a cancel ticket loudly; do not delete the original.
- **KDS-13 (P2) Ready-time estimates that ignore the room.** A fixed "20 minutes" on a slammed night. **Rule:** record each ticket's queue size and cook time, fit minutes-to-ready from recent history blended with sensible starting values until there is enough data, drop outliers (tickets left on screen overnight), and show how far off the estimate usually is.

## 5. Online ordering and guests (ORD)

- **ORD-01 (P0) Ordering while closed.** **Rule:** check opening hours on the server, in the branch's time zone, at order time and at payment time.
- **ORD-02 (P0) Hours past midnight.** "Friday 17:00 to 02:00" stored as 1020 to 1560 minutes. **Rule:** close may exceed 1440; Saturday 1am belongs to Friday's opening.
- **ORD-03 (P1) DST change.** A 2:30am slot that does not exist, or happens twice. **Rule:** convert local wall time to UTC with two passes; test both DST transitions.
- **ORD-04 (P1) Order-ahead limits.** **Rule:** later today or a few days out, only inside opening hours, only in slots that exist; when the card is held rather than charged (PAY-14), stop before the provider's hold expires (the case study allows 6 days against an online hold of about 7).
- **ORD-05 (P0) Abandoned checkout.** Order sits at "pending payment" forever, holding points or gift card money. **Rule:** a clean-up job cancels unpaid online orders after 45 minutes and returns held points and gift card balances.
- **ORD-06 (P0) Payment arrives after the order was cancelled.** **Rule:** the late webhook marks it paid-but-cancelled and raises a refund task; never silently drop money.
- **ORD-07 (P1) Retry payment.** Card declined. **Rule:** the same order can start a new checkout; old sessions are invalidated.
- **ORD-08 (P1) Delivery outside the zone.** **Rule:** zones by postcode (Canada: first three characters, the FSA); fee, minimum and time per zone; invalid postcodes rejected.
- **ORD-09 (P1) Minimum order.** **Rule:** pick one base and use it everywhere (the case study uses the subtotal before discounts for both the branch minimum and promo minimums), show it at checkout, and re-check on every re-price.
- **ORD-10 (P1) Reorder from history.** Dishes removed since. **Rule:** reorder against today's menu and list what is missing.
- **ORD-11 (P1) Phone number formats.** "021 123 4567", "+64 21...", "(416) 555-0199". **Rule:** normalise to E.164 per region; reject non-mobiles for texts; Canadian deployments text Canada and US numbers only.
- **ORD-12 (P0) Guest sign-in by code.** Brute force of a 6-digit code. **Rule:** hash codes, 5 tries per code counted before checking (in one statement), single use even if two correct requests arrive together.
- **ORD-13 (P1) Order tracking link guessable.** **Rule:** random public token per order, never the sequential number.
- **ORD-14 (P1) Receipts.** **Rule:** tokenised receipt link; tax shown on its own line with the tax number; 80mm print layout.
- **ORD-15 (P1) Reviews and problem reports.** A guest claims "missing item" a week later. **Rule:** problem reports for 48 hours, refund request capped at the order, manager resolves.
- **ORD-16 (P2) Allergens and spice.** Junk values from the editor. **Rule:** allowed allergen list only, deduplicated; spice clamped 0 to 3.
- **ORD-17 (P0) Blocked guests still ordering.** A known abuser orders again with the same number in a new format. **Rule:** a per-business block list of normalised phones and emails checked on orders, bookings and gift card sales; the message is neutral ("please call the restaurant"), never "you are blocked".
- **ORD-18 (P0) Card testing through checkout.** Someone runs stolen cards through many small unpaid checkouts, or turns them into gift cards. **Rule:** refuse new checkouts from a number with too many unpaid ones in a short window; cap gift card spend per buyer per day; both limits editable per business.
- **ORD-19 (P1) Fake big orders.** A large first order or a burst of orders from one number is cooked and never collected. **Rule:** hold such orders for a staff check before any ticket is created, alert the location, and release with a conditional update (only while still held) so it cannot be sent twice; regulars who have collected before are never held for ordering again; demo businesses get relaxed limits.
- **ORD-20 (P1) Pay at the counter by phone abused.** **Rule:** offer it only to numbers that have collected an order before, below a limit, and never after a no-show; everyone else gets a card link by text, and the order notes why.
- **ORD-21 (P1) Pickups nobody collects.** **Rule:** one reminder a set time after the order is ready (claimed once), then close it as not collected after a few hours; paid orders are not refunded; remember the number for ORD-20. Applies to web and phone orders, not POS tabs.

## 6. QR table ordering (QR)

- **QR-01 (P0) Guest changes the table in the request.** **Rule:** the server takes the table from the QR code token, never from the browser.
- **QR-02 (P1) Lost or photographed QR card.** Someone orders to table 7 from home. **Rule:** replaceable codes per table; opening hours and "pay first" by default.
- **QR-03 (P0) Pay at the end, guest leaves.** **Rule:** off by default; per branch switch; the floor map shows unpaid QR tabs; staff can close at the POS.
- **QR-04 (P0) Online share double counted.** A guest's online share is an order and also a payment on the tab. **Rule:** shares are their own order type, moved onto the tab when paid, and left out of sales totals, Z report methods and accounting exports.
- **QR-05 (P0) Share paid after the tab closed.** **Rule:** log "already settled, refund from Sales"; never apply to a closed tab.
- **QR-06 (P0) Share larger than what is left.** Two guests pay at once. **Rule:** apply `min(share, due)` under the optimistic lock; log the excess for refund.
- **QR-07 (P1) Call staff spam.** **Rule:** one open call per kind per table; rate limit per table.
- **QR-08 (P1) Guest Wi-Fi leaked.** **Rule:** shown only behind a table's QR session, never in the public config.
- **QR-09 (P1) Who ordered what.** **Rule:** each line notes the guest name given on the phone.
- **QR-10 (P0) Restricted items from the table.** **Rule:** no age-restricted products, appointments or open-price items through QR.

## 7. Payments (PAY)

- **PAY-01 (P0) Trusting the redirect.** "success_url" reached means nothing. **Rule:** mark paid only from a signed webhook or a server-side read of the payment; check amount, currency and that the transaction has not been used before.
- **PAY-02 (P0) Webhook replay.** **Rule:** store every event id (`webhook_events`) and process once; reject events whose live/test mode does not match the deployment. Storing the id must not block a retry when the work failed (PAY-13).
- **PAY-03 (P0) Unsigned or forged webhook.** **Rule:** verify the signature on the raw body with constant-time compare; reject missing signatures; staging bypasses only with a flag that dies in live mode.
- **PAY-04 (P0) Amount mismatch.** Provider says $10, order is $40. **Rule:** do not mark paid; flag the order for a human.
- **PAY-05 (P0) Test keys in production, live keys in dev.** **Rule:** refuse live keys unless `LIVE_PAYMENTS=1`; refuse test keys when it is on. Treat restricted keys the same as secret keys of their mode (PAY-16).
- **PAY-06 (P0) Mocks in production.** A fake terminal that approves everything. **Rule:** every mock switch and dev route stops working in live mode, checked at runtime.
- **PAY-07 (P0) Test money spent live.** Gift cards bought with test money. **Rule:** mark them and refuse them once live.
- **PAY-08 (P1) Provider outage.** Checkout cannot start. **Rule:** cancel the just-created order cleanly and tell the guest; never leave a pending order with no session.
- **PAY-09 (P1) Payouts per business.** **Rule:** Connect-style accounts so money lands in the business's own account with the platform fee taken at checkout; refunds reverse both; providers without Connect get invoiced the fee instead.
- **PAY-10 (P1) Negative balances.** Refunds after payout push a connected account negative. **Rule:** decide who carries the loss (a managed-risk option from the processor, or a reserve) before launch.
- **PAY-11 (P0) Card data in your system.** **Rule:** hosted checkout and terminals only; card numbers never reach your server or logs.
- **PAY-12 (P1) Partial capture or tip adjust.** **Rule:** record the final captured amount from the provider, not the requested one.
- **PAY-13 (P0) Webhook marked as seen before the work succeeded.** The event id is stored, marking the order paid fails, and the provider's retry is ignored as a duplicate: a paid order never reaches the kitchen. **Rule:** record the event and do the work as one unit, or forget the event id when the work fails and answer with an error so the provider retries; only a final (paid) result may block later notifications for the same payment.
- **PAY-14 (P0) Card hold on an order-ahead.** Charging at checkout means refund fees for every cancellation; holding the card too long means the hold expires. **Rule:** authorise at checkout and capture when the order is released to the kitchen; keep order-ahead inside the provider's hold window; accept the checkout only once the provider confirms the hold for the full amount; a refused or expired capture cancels the order before cooking and tells the guest, a temporary error retries; cancelling before release voids the hold; a partial refund before release captures less.
- **PAY-15 (P0) Card disputes noticed too late.** **Rule:** handle dispute events, match them to the order and check the event's connected account owns it, record the status, alert the business once, and build evidence from the order's own record (items, times, how it was handed over, proof of delivery, not collected) to submit before the due date; never resubmit once the provider has it under review.
- **PAY-16 (P1) Restricted keys refused.** A live-mode check that only accepts secret keys rejects a restricted key of the same mode. **Rule:** key-prefix checks accept both secret and restricted keys, and still refuse any key of the wrong mode.
- **PAY-17 (P0) Connected account created wrong.** Accounts created with the platform's home country for businesses in another, or two accounts from a double click. **Rule:** create the connected account with the business's own country and currency, and send an idempotency key with the create call.
- **PAY-18 (P1) Refund asks for money that was never taken.** The provider refuses a refund that asks for the platform fee back on a charge that had none, or a transfer reversal on a charge that was not a destination charge. **Rule:** ask for the fee back only when the charge carried one and reverse a transfer only for destination charges; expect the fee to come back in proportion to the amount refunded.

## 8. Refunds (REF)

- **REF-01 (P0) Double refund.** Two taps or two tablets refund the same money. **Rule:** claim the amount in one SQL statement that inserts only while refunds of that payment stay within what was paid.
- **REF-02 (P0) Refund to the wrong method.** **Rule:** refunds are against a specific payment: online back through the provider, gift card back onto the card, cash and terminal recorded (money handed back or refunded on the terminal).
- **REF-03 (P0) Refunding a gift card purchase after the card was spent.** **Rule:** take the value back off the card; if it no longer holds that much, refuse.
- **REF-04 (P1) Loyalty after refunds.** **Rule:** a full refund takes back the points earned, never below zero.
- **REF-05 (P1) Refunding a booking deposit used on a bill.** **Rule:** frees the deposit again; it is still a liability until used or refunded.
- **REF-06 (P1) Parallel refunds and the order total.** **Rule:** add to the order's refunded total in SQL, not from a copy read earlier.
- **REF-07 (P1) Insurance payments.** **Rule:** not refundable from the bill; reversed through the claim instead.
- **REF-08 (P1) Refunds after the day closed.** **Rule:** refunds belong to the day they happen; journals move negatives to the other side.
- **REF-09 (P0) Guests cancelling their own order.** **Rule:** write the policy down by state: scheduled and not yet sent to the kitchen, full refund (or the card hold released); already with the kitchen, cancelled without a refund; cooking started, not cancellable online; never paid, simply cancelled. Change the status first with a conditional update so two taps cannot refund twice, then refund, return points and gift card value, and rate limit the endpoint.
- **REF-10 (P1) A dish on a paid online order is out of stock.** The kitchen is stuck waiting for the guest. **Rule:** the kitchen marks the dish, the guest picks a swap (same price or less, difference refunded), a refund for that dish, or a full cancel; no answer within a few minutes refunds the dish and the rest carries on. The dish's refund is its share of what was charged (tip left out, capped at what was paid), refunded across the order's payments newest first, each through its own provider.

## 9. Card terminals (TRM)

- **TRM-01 (P0) Busy terminal.** Second payment sent while one is in progress. **Rule:** a terminal accepts one payment at a time; refuse the second.
- **TRM-02 (P0) Result recorded twice.** Polling and webhook both report approval. **Rule:** claim the terminal transaction once.
- **TRM-03 (P0) Staff key the amount on a standalone terminal wrong.** **Rule:** integrated terminals get the amount from the POS; standalone "EFTPOS" payments are recorded with the amount staff confirm.
- **TRM-04 (P1) Cancel.** **Rule:** staff can cancel from the POS; the terminal's own cancel is pressed on the merchant's behalf where the API allows.
- **TRM-05 (P1) Tip on the terminal.** **Rule:** record the tip returned by the terminal separately from the bill.
- **TRM-06 (P1) Connection lost after approval.** **Rule:** status check on reconnect; never ask the guest to pay again until the first result is known.
- **TRM-07 (P1) Reader belongs to the business's own processor account.** **Rule:** every terminal call carries the connected account id.
- **TRM-08 (P1) Terminals that answer "sent", not "paid".** Some terminal APIs accept the request and the payment appears later as a transaction; a declined or cancelled payment leaves nothing, and there may be no cancel call. **Rule:** tag each payment with your own invoice number and poll for a transaction carrying it; keep waiting until staff cancel; respect the provider's idempotency key format; show device asleep or unknown messages plainly.
- **TRM-09 (P1) Amounts keyed into a separate card machine.** **Rule:** an owner setting for card payments only through connected terminals; recording a payment keyed elsewhere then needs a manager; payments taken while offline are still recorded on replay.

## 10. Gift cards and loyalty (GL)

- **GL-01 (P0) Codes leaked from the database.** **Rule:** store only a hash; show the code once; never log or re-text it.
- **GL-02 (P0) Balance race.** Two tills spend the same card. **Rule:** `UPDATE ... SET balance = balance - ? WHERE balance >= ?` plus a ledger row; spend returns the amount actually taken.
- **GL-03 (P1) Confusing characters.** **Rule:** 4 groups of 4 from an alphabet without 0/O/1/I; normalise spaces, dashes and case on input.
- **GL-04 (P0) Expiry law.** NZ: at least 3 years. Canada: most provinces ban expiry. **Rule:** expiry per region, never hard-coded.
- **GL-05 (P1) Amount limits.** **Rule:** $10 to $1,000 in whole cents.
- **GL-06 (P0) Spending points without owning the phone.** **Rule:** online points need a texted code; tokens last 30 minutes and are tied to the customer.
- **GL-07 (P1) Points on discounts.** **Rule:** points on the amount paid, not on discounts, rewards or tips; earned once per order.
- **GL-08 (P1) Points held at checkout.** **Rule:** held when the order is created and returned if it expires.
- **GL-09 (P1) Referral abuse.** Self-referral, repeated claims. **Rule:** pays once, on the new guest's first paid order, never to the same phone.
- **GL-10 (P1) Privacy removal.** **Rule:** a guest's loyalty record can be deleted on request; ledger rows keep amounts, lose identity.

## 11. Bookings, deposits and waitlist (BKG)

- **BKG-01 (P0) Overbooking.** Two guests take the last slot together. **Rule:** check capacity inside the insert (one statement), not before it.
- **BKG-02 (P1) Slots near closing.** **Rule:** last slot 90 minutes before close; past-midnight closing never gives "24:00".
- **BKG-03 (P1) Deposit hold.** **Rule:** the slot is held 45 minutes while the deposit is paid, then freed.
- **BKG-04 (P0) Deposit used twice.** **Rule:** taken off the bill once at the POS; marked used.
- **BKG-05 (P1) Reminder sent twice.** **Rule:** a sent-at column; send once.
- **BKG-06 (P1) Waitlist position.** **Rule:** live position from the server; "table ready" text; seat or mark left.
- **BKG-07 (P2) Wait quotes that promise a booked table.** **Rule:** quote walk-ins by playing the floor forward: tables free up when their party should finish (learned stay by party size), today's bookings hold a table from shortly before their time, parties already waiting go first; save each quote and compare it with the real wait to correct future quotes.

## 12. Delivery and dispatch (DLV)

- **DLV-01 (P1) No driver free.** **Rule:** wait N minutes then book a courier, or courier always, per branch.
- **DLV-02 (P1) Batching.** **Rule:** add to a driver's batch only when their other drop is close and still at the pass.
- **DLV-03 (P0) Driver location privacy.** **Rule:** shared with a guest only while that driver carries their order and only if fresh; pings deleted after 7 days.
- **DLV-04 (P1) Proof of delivery.** **Rule:** hand-over code, photo when left at the door, or handed over; failed drop reported with a reason.
- **DLV-05 (P1) "On the way" too early.** **Rule:** send at pickup, not when the kitchen bumps.
- **DLV-06 (P1) Driver tips.** **Rule:** tips on orders a driver delivers go to that driver and are left out of the in-house pool.
- **DLV-07 (P1) No geocoder key.** **Rule:** fall back to the guest's pin or the zone centre.
- **DLV-08 (P0) Courier webhook replay.** **Rule:** claim once, like payments.
- **DLV-09 (P1) Guest phone on dispatch screen.** **Rule:** hidden; call through masked links only.
- **DLV-10 (P0) Delivery sold with nobody to deliver it.** **Rule:** a location with no drivers sends every delivery to a courier; checkout offers delivery only if a courier quote for that address succeeds right now; no courier booked within a few minutes, or a courier cancels or returns the food, alerts the business, tries the other courier, and texts the guest their choices (keep waiting, switch to pickup with the delivery fee back, or a refund).
- **DLV-11 (P1) Courier delivery fee shown is not the fee charged.** **Rule:** the guest pays the live courier quote minus what the business covers, capped, free over a set order value, rounded up to a tidy amount; refresh the quote as the address is typed and charge the fee that was shown.
- **DLV-12 (P1) Courier tips.** **Rule:** pass the guest's delivery tip to the courier driver in full (some couriers require it); set the tip when booking, since some couriers allow raising it later but never lowering it; keep courier tips out of the in-house pool.

## 13. Delivery apps and other POS systems (INT)

- **INT-01 (P0) Delivery app webhook needs a fast answer.** **Rule:** answer 200 within the provider's limit (for example 30s); do slow work after.
- **INT-02 (P1) Prices in minor units with a decimal count.** **Rule:** convert with the given `decimalDigits`; never negative; fall back to the line total.
- **INT-03 (P1) Items not on your menu.** **Rule:** match by PLU when possible, otherwise keep as sent so the kitchen still cooks it.
- **INT-04 (P1) Status mapping.** **Rule:** map your statuses onto theirs (accepted, preparing, ready, finalized, cancelled); a status push never throws into the kitchen flow.
- **INT-05 (P0) Pushing an online-paid order into the business's own POS.** It gets charged again at the counter. **Rule:** record the online payment in their POS as an external payment, with tax as the guest paid it.
- **INT-06 (P1) Their POS is down.** **Rule:** queue with back-off, show "sent to your POS" status and a manual retry.
- **INT-07 (P1) Menu import duplicates.** **Rule:** import updates mapped items by external id; adds only new ones.
- **INT-08 (P0) Their tokens at rest.** **Rule:** encrypt with a key from secrets (AES-GCM); never rotate the key without a re-entry plan.
- **INT-09 (P1) API keys for third parties.** **Rule:** shown once, hashed, scoped (orders:read, orders:write, menu:write), rate limited, revocable, one business each.

## 14. Phone AI agent (AI)

- **AI-01 (P1) Sounds like a robot menu.** **Rule:** natural greeting with the business's name; no "press 1"; transfer to a human on request.
- **AI-02 (P0) Agent invents prices or dishes.** **Rule:** the agent can only use tools that read the live menu and create orders through the same pricing function; it never states a total the server did not compute.
- **AI-03 (P1) Agent takes an order while closed.** **Rule:** same hours check as every channel.
- **AI-04 (P1) Payment by phone.** **Rule:** pay at the counter or by a texted link; never take card numbers by voice.
- **AI-05 (P1) Cost runaway.** **Rule:** per-tenant monthly credit, then billed usage; per-call time limit; daily caps.
- **AI-06 (P1) Transcripts.** **Rule:** stored for staff review; disclose recording where the law needs it.
- **AI-07 (P1) "Ask your data" assistants.** **Rule:** read-only tools, totals and first names only, daily question cap per business.
- **AI-08 (P1) AI-written marketing.** **Rule:** drafts only; nothing is sent or posted without the normal button.

## 15. Texts, email and marketing (MSG)

- **MSG-01 (P0) Consent.** Marketing texts without opt-in break anti-spam law (NZ UEMA, Canada CASL). **Rule:** opt-in unticked by default; segment only opted-in guests; every text names the business and ends "Reply STOP".
- **MSG-02 (P0) STOP replies.** **Rule:** a STOP removes the number from every list immediately.
- **MSG-03 (P1) Quiet hours.** **Rule:** send only between 9am and 8pm local time.
- **MSG-04 (P1) Long texts cost more.** **Rule:** two-segment limit with a live counter.
- **MSG-05 (P0) Platform number abused by a new signup.** **Rule:** platform sender used only for approved businesses (not trials in review, not demos); daily ceiling per business, hourly per number.
- **MSG-06 (P1) Codes in logs.** **Rule:** redact one-time and gift codes in the text log once sent.
- **MSG-07 (P1) No provider keys yet.** **Rule:** texts and emails go to an outbox log so flows can be tested.
- **MSG-08 (P1) Automatic texts sent twice or without consent.** Win-back, birthday, thank-you and reward texts run on a timer. **Rule:** the same consent, STOP and quiet-hour rules as campaigns; each kind at most once per guest per window; claim the send in the database before texting so two timer runs never text the same guest.

## 16. Inventory and purchasing (INV)

- **INV-01 (P1) When to deduct stock.** At order or at cook? **Rule:** deduct when food is sent to the kitchen (restaurants) or on sale (retail).
- **INV-02 (P1) Ingredient runs out.** **Rule:** mark every dish that uses it sold out at that branch, online and on the POS.
- **INV-03 (P1) Restock.** **Rule:** receiving stock clears sold-out flags that running out set (not ones staff set by hand).
- **INV-04 (P1) Negative stock.** **Rule:** allow it (sales must not stop) but flag it on the count screen.
- **INV-05 (P1) Dish cost.** **Rule:** from the recipe using the cheapest recorded unit cost per ingredient; show margin.
- **INV-06 (P2) Purchase orders.** **Rule:** drafted from items below par; receiving updates unit cost.
- **INV-07 (P1) Barcodes.** **Rule:** UPC-A and EAN-13 forms of the same code both match.

## 17. Staff, time and payroll (STF)

- **STF-01 (P0) PIN brute force from many IPs.** **Rule:** PIN lookup through an HMAC with a server pepper; failures from untrusted devices share a per-business limit (10 an hour) that never locks out the business's own trusted tablets; manager PINs 6 digits.
- **STF-02 (P0) Role escalation through the API.** **Rule:** role checks on the server for every route; kitchen < staff < manager < owner; drivers reach only the driver API.
- **STF-03 (P1) Forgot to clock out.** **Rule:** manager edits, logged with before and after.
- **STF-04 (P1) Overnight shifts.** **Rule:** shifts can cross midnight; hours belong to the start day.
- **STF-05 (P1) Double-booked staff.** **Rule:** no overlapping shifts per person; copy last week skips clashes.
- **STF-06 (P1) Overtime rules differ.** Ontario ESA 44 hours a week; NZ has no statutory weekly overtime threshold. **Rule:** per-business threshold with a regional default; overtime at 1.5x.
- **STF-07 (P1) Tip pooling.** **Rule:** card tips pooled by hours worked; driver tips excluded. Other tip rules in STF-09.
- **STF-08 (P1) Schedule changes.** **Rule:** publishing texts each person their week; deleting a published shift texts them too.
- **STF-09 (P1) Tip rules other than a plain pool.** **Rule:** support pooling by hours with a weight per role, servers keeping their own, and keeping their own minus a tip-out to other roles; split in whole cents with the leftover cents going to whoever worked longest, so shares always add up to the pot.

## 18. Back office, reports and accounting (BOF)

- **BOF-01 (P0) Journal does not balance.** **Rule:** debits (money in by method) equal credits (sales before tax, tax, tips, gift cards sold, deposits held); test that debits minus credits is zero for every day.
- **BOF-02 (P1) More refunds than sales on a method.** **Rule:** a negative line moves to the other side.
- **BOF-03 (P1) Same account on several lines.** **Rule:** merge lines that map to the same account and side.
- **BOF-04 (P1) Re-syncing a day.** **Rule:** update the same journal entry, never create a second.
- **BOF-05 (P1) Accounting app blocks tax accounts.** QuickBooks will not post journals to its own GST/HST accounts. **Rule:** map tax to an ordinary liability account.
- **BOF-06 (P0) CSV formula injection.** A guest named `=HYPERLINK(...)`. **Rule:** prefix cells starting with = + - @ with a quote on export.
- **BOF-07 (P1) Sales tags.** **Rule:** automatic tags (channel, deposit, staff meal) plus staff tags from presets.
- **BOF-08 (P1) Time zones in reports.** **Rule:** every report groups by the tenant's local business day.

## 19. Tenancy, platform and billing (TEN)

- **TEN-01 (P0) Cross-tenant read.** A missing `tenant_id` filter shows another business's orders. **Rule:** every query filters on tenant; repository functions take tenant first; end-to-end tests read across a second tenant and expect 404.
- **TEN-02 (P0) Slug or custom domain collision.** **Rule:** unique slugs; a domains table maps host to tenant; www redirects; unknown hosts get the platform site.
- **TEN-03 (P0) Self-signup goes public unreviewed.** **Rule:** draft until the owner finishes setup and sends for review; platform admin approves; platform-created tenants can go live straight away.
- **TEN-04 (P1) Suspended business.** **Rule:** can sign in and see why, nothing else; guest pages show "not taking orders".
- **TEN-05 (P0) Switched-off module still reachable.** **Rule:** module check on every staff, guest and API route; tenants created before modules existed get everything.
- **TEN-06 (P1) Billing re-run.** **Rule:** invoices safe to re-run (unique per tenant and month); pro rata after a trial or a mid-month start; usage (minutes, texts) added; commission only when not already taken at checkout.
- **TEN-07 (P0) Support access.** **Rule:** "open as owner" needs a written reason, lasts an hour, shows a banner to the business, logged in both audit logs.
- **TEN-08 (P1) Demo tenant abuse.** **Rule:** demo data resets; no real texts, emails or payments from demos.
- **TEN-09 (P0) Self-serve custom domains.** An owner claims a host that belongs to the platform, or a domain goes live before its certificate. **Rule:** the business buys and keeps the domain; add it as a custom hostname, route it only once both the DNS record and the certificate are active, refuse platform and provider hosts, turn a bare root into www (most registrars cannot put a CNAME on the root) and tell the owner to forward the root, do not reveal whether another platform already holds the host, one domain per business, and check with back-off plus a "check now" button.
- **TEN-10 (P1) Commission collected twice or never.** Checkout takes no platform fee because the plan bills it monthly, while the invoice skips it because "checkout took it". **Rule:** one function decides per plan where commission is collected (at checkout or on the invoice), and both sides ask it.
- **TEN-11 (P1) Bank debit for platform invoices.** **Rule:** bank debit (for example Canadian pre-authorised debit) suits fixed subscription invoices, never guest orders, because it takes days to clear; keep it off until the payment method is enabled in the provider's dashboard, or invoice creation fails.
- **TEN-12 (P1) Query parameter limits.** A busy day's "IN (...)" list passes the database's bound-parameter limit (100 on Cloudflare D1) and the screen fails at peak. **Rule:** chunk lists of ids into batches below the limit.

## 20. Replicating to other verticals (VRT)

- **VRT-01 (P0) Word rewriting breaks code.** Replacing "menu" with "services" inside JavaScript renames `S.menu`. **Rule:** rewrite only visible text and string literals, whole words only, never identifiers, never inside `${...}`, never inside links or header names.
- **VRT-02 (P0) A module that does not fit leaks in.** A clinic sees "delivery". **Rule:** each product declares the modules it sells; others are hidden and refused whatever the tenant row says.
- **VRT-03 (P0) Double-booking a provider.** **Rule:** check provider availability inside the insert; buffers for clean-up time count.
- **VRT-04 (P1) Service length grid.** **Rule:** slots on a fixed grid (15 minutes); services carry length, buffer and an online flag.
- **VRT-05 (P1) External calendars.** **Rule:** read busy times only (never titles) from private iCal links from known hosts; handle repeats, exceptions, moved occurrences, all-day and overnight events.
- **VRT-06 (P0) Health data.** Clinics put notes in a booking system. **Rule:** no clinical notes online; state it is not a clinical record; seal insurance numbers and birth dates; showing full numbers is audit logged; follow health privacy law (for example PHIPA in Ontario).
- **VRT-07 (P0) Insurer direct billing.** **Rule:** consent recorded; claims split visits into insurer and patient shares; second plan bills what the first left; denials move to the patient with a pay link; mock mode never with live payments.
- **VRT-08 (P1) Memberships.** **Rule:** saved card for renewals, text before renewal, failed payment follow-ups (day 0, 3, 7), expiry on day 10, freeze adds days back, cancel now or at period end; local gym contract law is the business's responsibility.
- **VRT-09 (P0) Age-restricted products.** **Rule:** ID prompt at the till with the provincial age; never sold online, by phone or QR.
- **VRT-10 (P1) Retail sold-out at zero.** **Rule:** stock reaching zero marks the product sold out until received again.
- **VRT-11 (P1) Self-cancel cut-off.** **Rule:** clients cancel up to N hours before (4 by default); after that, staff only.
- **VRT-12 (P1) Book by text.** **Rule:** numbered replies, no free text stored, health businesses told not to text health details.

## 21. Regions and law (REG)

- **REG-01 (P0) Region not modelled.** Shipping Quebec without QST and French service. **Rule:** a region is off until tax, language and law are modelled; say so on the sign-up page.
- **REG-02 (P1) Province sets tax and time zone.** **Rule:** chosen at sign-up, editable in settings.
- **REG-03 (P1) Region wording.** NZ English vs Canadian English, "EFTPOS" vs "debit". **Rule:** region rewrite with protected tokens (tax names, header names) set aside and restored.
- **REG-04 (P1) Policies per country.** **Rule:** a privacy policy per region (NZ Privacy Act 2020, PIPEDA and CASL in Canada), checked by a local lawyer.
- **REG-05 (P1) Platform invoice tax.** **Rule:** your own subscription invoices carry the right tax for the customer's province or country.
- **REG-06 (P1) Surcharge law changes by region and date.** New Zealand has a bill to ban surcharges on in-person card payments; it had not passed as of 21 November 2026. **Rule:** the surcharge is a per-region switch with an effective date, in-person and online handled separately, so it can be turned off on the day a law commences; check the current law with a lawyer.

## 22. Security and web (SEC)

- **SEC-01 (P0) CSRF.** **Rule:** SameSite=Strict staff cookies plus a required custom header on every state-changing call.
- **SEC-02 (P0) XSS from dish names, notes and guest names.** **Rule:** escape all output; CSP with no inline scripts and no third-party scripts.
- **SEC-03 (P0) Clickjacking the POS.** **Rule:** `frame-ancestors 'none'`.
- **SEC-04 (P0) Rate limits.** **Rule:** sign-in per IP, per account and per business; order creation per IP; plus a WAF layer.
- **SEC-05 (P0) Secrets in the repo.** **Rule:** platform secret store only; CI fails on secrets.
- **SEC-06 (P1) Platform admin with password only.** **Rule:** put the admin behind SSO with two-factor before taking real money.
- **SEC-07 (P1) Backups.** **Rule:** point-in-time recovery plus scheduled exports, and a tested restore.

## 23. Devices and apps (DEV)

- **DEV-01 (P1) Kiosk left signed in as staff.** **Rule:** kiosks pair with a one-time link and keep a device token, never a staff login; unpair locks out at once; reset after 90 seconds idle.
- **DEV-02 (P1) Kiosk card vs counter payment.** **Rule:** card orders go to the kitchen once approved; counter orders go straight away and wait in "pay at the counter".
- **DEV-03 (P1) Stale cached code after deploy.** **Rule:** fingerprint assets and version the service worker.
- **DEV-04 (P2) Native wrappers.** **Rule:** the same web app inside Capacitor (staff, driver, branded ordering) so there is one code path.
- **DEV-05 (P1) Printers.** Printer offline or out of paper. **Rule:** the kitchen screen is the source of truth; printing is a copy with a reprint button.
- **DEV-06 (P1) Cloud printer loses a job mid-print.** **Rule:** the printer polls for work; a job sent but not confirmed goes back in the queue after about a minute, so a printer that lost power reprints instead of dropping the ticket; route kitchen tickets by station and print VOID slips.
- **DEV-07 (P1) Cash drawer opens at the wrong time.** **Rule:** open it on a cash payment (not when a payment taken offline is replayed later); drawer jobs jump the print queue, are never sent twice, and are dropped if the printer only comes back minutes later; an "open till" button logs who opened it and why as a no-sale, shown on the Z report.
