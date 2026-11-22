# kitchen-pos-blueprint

A Claude skill for building a production-grade restaurant POS (tabs, kitchen display, online and QR ordering, payments, card terminals, offline mode, back office) as one multi-tenant codebase, and then replicating it to salons, clinics, dental offices, gyms and shops by configuration instead of forks.

The core of the skill is an **edge-case catalog of 234 cases** across 23 areas, each with what goes wrong and the rule that prevents it, plus a CSV matrix and a gate script so no P0 case ships without a passing test.

Built and proven on the Mainpoint platform: one codebase running restaurant POS brands in two countries (Platepoint in Canada, Orbyt in New Zealand) and products for salons, clinics, dental offices, gyms and stores.

## What it covers

- **Architecture:** one codebase, one deployment per product and country, tenant isolation, switchable modules enforced on the server, roles
- **Money core:** integer cents, server-side pricing, inclusive and exclusive tax, Ontario's $4 food rebate, discounts, surcharges, tips, split bills, refunds claimed once, a balanced daily journal
- **POS:** floor and tabs, rounds, voids, moves, split payments, optimistic locks, close of day
- **Offline mode:** IndexedDB queue, idempotency keys, ordered replay, what must never work offline
- **Kitchen display:** stations, expo, recall, timers, order ahead, throttling, change tickets
- **Channels:** online, branded websites, QR (pay first or pay at the end), kiosk, AI phone agent, delivery apps, pushing orders into a POS the business already has
- **Payments and devices:** hosted checkout, webhook verification and replay protection, live-mode guards, Connect-style payouts, integrated terminals
- **Security and privacy:** PIN peppering, trusted devices, CSRF, CSP, audit, support access, privacy law notes for NZ and Canada
- **Replication:** primitive mapping per vertical, safe word rewriting, vertical profiles, what is genuinely new (appointments, memberships, insurer billing, age checks)
- **Regions and tax:** NZ and every Canadian province, and a ten-point checklist for any new region

## Layout

```
kitchen-pos-blueprint/
├── SKILL.md                       workflow and the ten rules (loaded first)
├── references/
│   ├── 01-architecture.md
│   ├── 02-data-model.md
│   ├── 03-money.md
│   ├── 04-pos-flows.md
│   ├── 05-kitchen-display.md
│   ├── 06-payments-devices.md
│   ├── 07-channels.md
│   ├── 08-security-privacy.md
│   ├── 09-replicate.md
│   ├── 10-regions-tax.md
│   ├── 11-testing-launch.md
│   └── edge-cases.md              234 cases, P0 / P1 / P2
├── scripts/
│   ├── money.js                   reference money core (pure functions)
│   ├── money.test.mjs             node --test scripts/money.test.mjs
│   ├── check_matrix.py            edge-case gate for CI (--sync to add new ids)
│   └── new_vertical.py            scaffold a vertical profile
└── templates/
    ├── schema.sql                 starter multi-tenant schema
    ├── vertical-profile.json      words, modules, fields, rules per vertical
    ├── edge-case-matrix.csv       every case id with test and status
    └── go-live-checklist.md
```

## Install

**Claude Code:** clone into your skills folder.

```bash
git clone https://github.com/ambergargrish-ca/kitchen-pos-blueprint ~/.claude/skills/kitchen-pos-blueprint
```

**Claude apps:** download the repo as a zip and upload it under Settings, Capabilities, Skills.

Then ask Claude things like "plan a POS for a three-branch cafe", "harden our tab payments against the edge cases", or "turn our restaurant POS into a salon product".

## Try the money core

```bash
node --test scripts/money.test.mjs
python3 scripts/check_matrix.py
```

## Companion skills

- [zero-to-live](https://github.com/ambergargrish-ca/zero-to-live): plan, build, test in tiers, secure and deploy the web app
- [brand-kit-builder](https://github.com/ambergargrish-ca/brand-kit-builder): brand each product in the family

## Not legal, tax or payments advice

Tax rates, surcharge rules, gift card law and privacy notes reflect public rules as of November 2026. Check them with an accountant and a lawyer in each region before taking real money, and certify every payment integration with its provider.

## Citation

If this skill helps your work, please cite it (`CITATION.cff`) or link back.

Created by Amber Gargrish, [gargrish.com](https://gargrish.com).

## License

MIT
