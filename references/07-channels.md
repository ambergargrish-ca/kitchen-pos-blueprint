# Channels

Every channel creates the same order through the same pricing function and ends on the same kitchen screen. A channel adds intake, not a second money path.

| Channel | Intake | Paid | Kitchen when |
|---|---|---|---|
| Online (guest site, branded website) | Menu, cart, checkout | Hosted checkout | After payment (or at slot time for order ahead) |
| QR table, pay first | Menu locked to the table | Hosted checkout | After payment |
| QR table, pay at the end | Rounds on the table's tab | Shares online or at the POS | Straight away |
| Kiosk | Eat in or take away, name, optional mobile | Kiosk terminal or counter | Card: once approved. Counter: straight away |
| Phone AI agent | Voice, tools over the live menu | Counter or texted link | Straight away (pay at counter) or after link payment |
| Book by text | Numbered replies | Deposit link if needed | n/a |
| Delivery apps (via an aggregator such as Deliverect) | Signed order webhook | Paid by the app | On accept |
| POS (staff) | Floor and tabs | At the till | On Send |

## Online ordering essentials

Photos, dietary tags, allergens, spice, portion and deal lines; options; pickup, delivery or dine in; promo codes; open/closed state; sold-out items hidden; live tracking by random token; retry payment; tips (optional); order ahead for a few days (inside the card hold window when holding cards, PAY-14); guest self-cancel by a written policy (REF-09); out-of-stock swap or refund (REF-10); guest accounts by texted code; reorder; saved addresses; favourites; referrals; reviews and problem reports; "Powered by <platform>" in the footer of a branded site.

## Fake orders and no-shows

A block list for phones and emails (ORD-17), card-testing and gift card limits (ORD-18), a staff check before cooking for big first orders and bursts (ORD-19), pay at the counter by phone only for guests with a good history (ORD-20), and reminders then "not collected" for pickups (ORD-21). Card disputes are handled from the order record (PAY-15).

## Delivery with couriers

No drivers on the team means couriers do every delivery; offer delivery at checkout only when a courier can take that address now; alert, retry and give the guest choices when a courier does not show (DLV-10). Price the courier fee from the live quote (DLV-11) and pass tips to the courier in full (DLV-12).

## Phone AI agent

- Telephony (for example Twilio Media Streams) to a realtime voice model, one stateful session per call.
- Greeting uses the business's name. No IVR menus. Transfer to a staff number on request or on failure.
- Tools only: read menu and hours, price a cart (same function), place a pickup order, book a table, look up or cancel a booking, transfer. The model never states a price the server did not return.
- Transcripts saved for staff. Monthly usage credit per tenant, then billed per minute or per outcome.

## Delivery apps

One aggregator integration covers many apps. Reply within the time limit, verify the signature, convert minor units with the given decimal digits, match items by PLU, push status changes back, push the menu with channel prices.

## Keep their POS

For businesses that buy only a module (for example the AI phone agent): import their menu (update by external id, no duplicates), push every order into their POS with tax as charged and online payments recorded as external payments, queue with back-off, show status and a retry button, encrypt their tokens at rest. Offer a signed generic webhook and a scoped API for any other system.
