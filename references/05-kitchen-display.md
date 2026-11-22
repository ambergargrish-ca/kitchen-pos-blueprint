# Kitchen display

## Ticket sources

Online (after payment), phone agent, kiosk, QR rounds, POS rounds, delivery apps. All become the same ticket shape: order number, channel, mode, table or name, target time, lines with options, notes and seat.

## Stations

- Each menu section routes to a station (grill, curry, tandoor, bar). Unrouted sections go to the main kitchen.
- Station screens show only their lines and mark their part done.
- The pass (expo) sees everything and bumps the whole ticket; "ready" texts and pickup status fire from the pass, not a station.
- Station board layout: a column per station plus the pass.

## Timing

- Timer from `sent_at`. Amber at 8 minutes, red at 15 (configurable).
- Order ahead: paid future orders wait and release at target time minus prep time; the ticket shows the target.
- Throttle: max online orders per 15 minutes per branch; pause online orders until a time, from the kitchen screen.

## Changes after sending

Never edit a ticket the cook has read. Send a change ticket (VOID, QTY, NOTE) that is visually loud, and keep the original for the audit trail. Cancellations from delivery apps behave the same.

## Recall and counts

Recall a bumped ticket for 30 minutes. All-day counts sum unbumped, unvoided lines by dish.

## Inventory hook

When a round is sent, deduct recipe ingredients; any dish whose ingredient hits zero becomes sold out at that branch everywhere (online, POS, phone agent, delivery apps).

## Reliability

Live push plus polling, connection dot, chime on new tickets (with a tap-to-enable for browsers that block audio), printing as a copy with reprint, never the source of truth.
