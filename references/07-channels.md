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

Photos, dietary tags, allergens, spice, portion and deal lines; options; pickup, delivery or dine in; promo codes; open/closed state; sold-out items hidden; live tracking by random token; retry payment; tips (optional); order ahead up to 7 days; guest accounts by texted code; reorder; saved addresses; favourites; referrals; reviews and problem reports; "Powered by <platform>" in the footer of a branded site.

## Phone AI agent

- Telephony (for example Twilio Media Streams) to a realtime voice model, one stateful session per call.
- Greeting uses the business's name. No IVR menus. Transfer to a staff number on request or on failure.
- Tools only: read menu and hours, price a cart (same function), place a pickup order, book a table, look up or cancel a booking, transfer. The model never states a price the server did not return.
- Transcripts saved for staff. Monthly usage credit per tenant, then billed per minute or per outcome.

## Delivery apps

One aggregator integration covers many apps. Reply within the time limit, verify the signature, convert minor units with the given decimal digits, match items by PLU, push status changes back, push the menu with channel prices.

## Keep their POS

For businesses that buy only a module (for example the AI phone agent): import their menu (update by external id, no duplicates), push every order into their POS with tax as charged and online payments recorded as external payments, queue with back-off, show status and a retry button, encrypt their tokens at rest. Offer a signed generic webhook and a scoped API for any other system.

## Booking marketplace and bookings-only plans

Sell bookings on their own as a module, and list every restaurant with bookings on in one booking marketplace.

- **Tag the source on every booking** (own website, phone, AI phone, staff, marketplace, Google). Charge per booking only for the ones the platform sent (marketplace, Reserve with Google), only on pick-and-choose plans at list price, and never for cancelled or no-show bookings. The restaurant's own channels stay free. Show the source in the staff Bookings list.
- **Bookings-only setup:** sign-up with only the bookings module on, a short go-live checklist (address and phone, hours, seats) that works without the website module, and a guest booking page the owner can link from their own site and Google profile.
- **Marketplace search on a phone:** one search pill opens a full-screen sheet that asks where, when and who one at a time, folds answered steps to one line, shows recent searches and "Near me" before typing, and puts the live count on the button ("Show 3 restaurants"). Free times near the wanted time appear as buttons on each card; deposits apply as on the restaurant's own page.

## Owner assistant ("ask your business anything")

- **Tools, not guesses.** The assistant answers only from tool calls that read the tenant's own data (sales, bookings, labour, stock, reviews, agent findings) and proposes actions as cards the owner presses. It never sends or changes anything on its own except what the owner put on autopilot.
- **Show the work.** Stream each step as it happens in plain words ("Looking at your sales", "Asking your marketing agent") with a spinner then a tick, then reveal the answer paragraph by paragraph and fold the steps into "Worked through N steps". A newline-delimited JSON stream from the server is enough; keep a non-streaming response for tests and old clients.
- **Cap the spend.** A monthly AI budget per platform and a rate limit per tenant, checked before every call.
