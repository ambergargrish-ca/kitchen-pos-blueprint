# Go-live checklist

Tick every line before the first real payment. Keep the dated copy in the repo.

## Money
- [ ] Every P0 edge case has a passing test (`python3 scripts/check_matrix.py`)
- [ ] Journal balances for 30 days of generated data
- [ ] Tax rates checked by an accountant for every region and province offered
- [ ] Receipts show the tax line and tax number as the law requires
- [ ] Refunds tested on every method, including a parallel double refund

## Payments
- [ ] Each provider and terminal certified in its sandbox
- [ ] Live keys added through the secret store; test-key guard removed deliberately; `LIVE_PAYMENTS=1`
- [ ] Webhook signatures, replays and mode mismatch tested on the live endpoints with provider test events
- [ ] Who carries negative balances is decided (processor managed risk or reserve)
- [ ] Surcharge settings off until the business confirms notice and signage

## Security
- [ ] Independent penetration test done; findings fixed or accepted in writing
- [ ] Platform admin behind SSO with two-factor
- [ ] All mock switches and dev routes off; startup refuses them in live mode
- [ ] WAF rate limits on sign-in and order creation
- [ ] Every seed password changed; peppers and encryption keys set and backed up
- [ ] Cross-tenant tests pass against the deployed build

## Data
- [ ] Point-in-time recovery on; scheduled exports; a restore tested
- [ ] Privacy policy and terms per region checked by a lawyer
- [ ] Processing terms for businesses (you process their guests' data)
- [ ] Breach response plan written

## Operations
- [ ] Offline mode tested on the real tablets and network
- [ ] Kitchen screens tested with the real chime, printers and Wi-Fi
- [ ] Support access rules (reason, one hour, banner, both audit logs) in place
- [ ] Error monitoring and alerts on webhook failures and payment mismatches
- [ ] Soft launch plan: one business, one week, on-site for the first two services
