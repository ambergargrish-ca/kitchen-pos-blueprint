# Replicate to other businesses

The restaurant POS is the hardest vertical: tabs, kitchen routing, delivery, tips, many channels. Once it works, most other businesses are the same primitives with different words and one or two new modules.

## Step 1: map the primitives

| Restaurant | Salon / spa | Clinic / dental | Gym / studio | Shop |
|---|---|---|---|---|
| Menu item | Service (length, buffer, deposit) | Treatment (insurer code) | Plan, class, session | Product (barcode, SKU, PLU) |
| Modifier | Add-on, length option | Area, tooth/surface | Add-on | Variant |
| Table | Chair, room | Room | Studio, court | Till |
| Tab | Visit bill | Visit bill (insurer + patient share) | Member account | Basket |
| Kitchen ticket | Appointment card | Appointment | Check-in | n/a |
| Booking | Appointment with a provider | Appointment with a practitioner | Session booking | n/a |
| Guest | Client | Patient | Member | Customer |
| Delivery | n/a | n/a | n/a | Optional |

## Step 2: decide what is genuinely new

| Vertical | New modules |
|---|---|
| Salon | Appointments: providers, their services and hours, time off, 15-minute grid, buffers, no double-booking (checked in the insert), deposits, reminders, self-cancel cut-off, retail at checkout |
| Clinic, dental | Appointments plus insurer direct billing: insurance on file with consent, sealed identifiers, claims routed by insurer, insurer/patient split, second plan, denials to a patient pay link, deposits matched to claims, receivables by age. Not a clinical record |
| Gym | Memberships: plans, saved-card renewals, dunning (day 0, 3, 7, expire day 10), freezes, cancel now or at period end, check-in by member number or mobile, online join |
| Shop | Barcode lookup (UPC-A and EAN-13 match), stock counts and moves, reorder levels, age checks at the till, open-price items |

Everything else (POS bill, payments, terminals, refunds, gift cards, loyalty, texts, staff, schedule, payroll, accounting, website, AI receptionist) is reused as is.

## Step 3: write the vertical profile

`python3 scripts/new_vertical.py salon` copies `templates/vertical-profile.json` to `verticals/salon.json`. Fill in:

- `product`: key used by `PRODUCT` in deployment config
- `brand`: name, domain, colours, tagline
- `words`: `[singular, plural, Singular, Plural]` pairs (restaurant -> salon, dish -> service, guest -> client, table -> chair)
- `modules`: the modules this product sells (others hidden and refused)
- `itemFields`: extra fields on items (duration, buffer, insurer code, barcode)
- `rules`: vertical rules (no online notes, age checks, self-cancel hours)
- `compliance`: laws and disclaimers to show

## Step 4: rewrite words safely

The server rewrites visible words on the way out so screens stay shared:

- Only whole words, with look-arounds so `S.menu`, `body.restaurant`, `guest-foot` and `"menu":` never change.
- In JavaScript, rewrite only string and template literal text, never code and never inside `${...}`.
- Protect tokens first (tax names like "GST/HST no.", HTTP header names, slugs, links), then rewrite, then restore.
- Test with a snapshot of every screen per product and a scan that the rewritten JavaScript still parses.

## Step 5: deploy as its own product

Own worker, own database, own secrets, own domain (or a path on the parent site while starting). Shared code, shared CI: every push deploys every product after the tests pass for each.

## Step 6: parent brand

A parent site that lists every product with a live demo per product, one sign-in model, one platform admin across products if you want consolidated billing. Keep each product's own brand on its guest-facing pages.

## Order of attack

Go deep on one vertical first (real customers, real revenue), then add verticals in order of how much they reuse: salon (appointments) -> gym (memberships) -> shop (stock) -> clinic and dental (insurer billing and health privacy, the most regulated).

Edge cases for this step: `edge-cases.md`, section 20.
