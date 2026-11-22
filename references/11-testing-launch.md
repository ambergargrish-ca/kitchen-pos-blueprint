# Testing and launch

## Test layers

| Layer | What | When |
|---|---|---|
| Unit | Money (pricing, totals, tax per region, surcharge, split, journal balance), time (hours past midnight, DST, slots), phone and postcode parsing, signature checks, code generation | Every change in that area |
| Integration | Repository functions against a real SQL database: atomic balances, optimistic locks, idempotency, refunds claimed once | Every change in that area |
| End-to-end | A local server with migrations and a fresh seed (two tenants), scripted flows per channel | Before each deploy batch |
| Accessibility | axe scans of guest, staff, driver, kiosk and admin screens (WCAG 2.1 AA) | Before each deploy batch |
| Load | A Friday-night script: 30 tablets, 200 orders an hour, kitchen screens connected | Before launch and after big changes |

## End-to-end flows to script

1. Guest orders online, pays, kitchen bumps, guest gets ready text, receipt correct.
2. POS: open table, two rounds, void a sent item with manager PIN, split three ways (cash, terminal, gift card), close, Z report.
3. QR pay at the end: two phones open the same table at once; rounds; two guests pay shares at once; tab closes; shares not double counted in sales.
4. Offline: drop network, open a tab, add items, take cash, restore network, replay; replay again; nothing doubles.
5. Webhook replay: send the same payment event twice and a forged one.
6. Refund twice in parallel.
7. Cross-tenant: tenant B tries every tenant A id it can find.
8. Module off: call each switched-off route directly.
9. Live mode guard: test key with live mode on; mock switch with live mode on.
10. Per product: each vertical's own flows (appointments, memberships, claims, barcodes) and a word-rewrite snapshot.

## CI

Syntax check, unit tests, then migrations + seed + end-to-end against a local worker, then deploy every product. Mock switches on in CI only.

## Edge-case gate

`templates/edge-case-matrix.csv` lists every case id with priority, test file and status. CI can fail when a P0 row has no test (see `scripts/check_matrix.py`).

## Launch

Run `templates/go-live-checklist.md`, then a soft launch: one friendly business, one week, staff on site for the first two services, daily review of the audit log, refunds and offline queue banners.
