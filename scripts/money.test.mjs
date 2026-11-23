// node --test scripts/money.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceCart, totals, surchargeCents, checkTip, splitEven, applyPayment, canRefund, balanceJournal, isOpenAt, allocate, lineRefundCents, splitTips } from './money.js';

const menu = new Map([
  ['curry', { id: 'curry', name: 'Butter chicken', active: true, price_cents: 2400, modifiers: [
    { id: 'size', label: 'size', type: 'one', options: [{ id: 'reg', label: 'Regular', price_cents: 0 }, { id: 'lg', label: 'Large', price_cents: 400 }] },
    { id: 'add', label: 'extras', type: 'many', options: [{ id: 'naan', label: 'Naan', price_cents: 450 }, { id: 'rice', label: 'Rice', price_cents: 350 }] }
  ] }],
  ['water', { id: 'water', name: 'Water', active: true, price_cents: 0, modifiers: [] }],
  ['old', { id: 'old', name: 'Old dish', active: false, price_cents: 1000, modifiers: [] }]
]);

test('MON-02/04/05 prices from the menu, options as a set, default single choice', () => {
  const [l] = priceCart([{ itemId: 'curry', qty: 2, mods: ['naan', 'naan', 'lg'], price_cents: 1 }], menu);
  assert.equal(l.unit_cents, 2400 + 400 + 450);
  const [d] = priceCart([{ itemId: 'curry', qty: 1 }], menu);
  assert.deepEqual(d.mods, ['Regular']);
});

test('MON-03/15/16/18/19 rejects bad carts', () => {
  assert.throws(() => priceCart([], menu), { code: 'empty_cart' });
  assert.throws(() => priceCart([{ itemId: 'curry', qty: -1 }], menu), { code: 'bad_qty' });
  assert.throws(() => priceCart([{ itemId: 'curry', qty: 1.5 }], menu), { code: 'bad_qty' });
  assert.throws(() => priceCart([{ itemId: 'old', qty: 1 }], menu), { code: 'item_unavailable' });
  assert.throws(() => priceCart([{ itemId: 'curry', qty: 1 }], menu, new Set(['curry'])), { code: 'sold_out' });
  assert.throws(() => priceCart([{ itemId: 'curry', qty: 1, mods: ['reg', 'lg'] }], menu), { code: 'bad_mods' });
  assert.throws(() => priceCart([{ itemId: 'curry', qty: 1, mods: ['ghost'] }], menu), { code: 'bad_mods' });
  assert.throws(() => priceCart(Array(51).fill({ itemId: 'water', qty: 1 }), menu), { code: 'cart_too_large' });
  assert.equal(priceCart([{ itemId: 'curry', qty: '2' }], menu)[0].qty, 2);
});

test('MON-17 cleans notes', () => {
  const [l] = priceCart([{ itemId: 'water', qty: 1, note: 'no\n\nice   please' + 'x'.repeat(300) }], menu);
  assert.ok(l.note.startsWith('no ice please'));
  assert.equal(l.note.length, 140);
});

test('MON-10 NZ GST inclusive: 3/23 of the total', () => {
  const t = totals([{ unit_cents: 2300, qty: 1 }], { taxRateBp: 1500, taxInclusive: true });
  assert.equal(t.total_cents, 2300);
  assert.equal(t.tax_cents, 300);
});

test('MON-10/12 Canada exclusive: Ontario 13% on top, half cent rounds up', () => {
  assert.equal(totals([{ unit_cents: 1000, qty: 1 }], { taxRateBp: 1300, taxInclusive: false }).total_cents, 1130);
  assert.equal(totals([{ unit_cents: 50, qty: 1 }], { taxRateBp: 1300, taxInclusive: false }).tax_cents, 7); // 6.5c -> 7c
});

test('MON-06/07 discounts clamp and stack, never negative', () => {
  const lines = [{ unit_cents: 1000, qty: 1 }];
  assert.equal(totals(lines, { promo: { active: true, type: 'pct', value: 150, code: 'X', min_cents: 0 } }).total_cents, 0);
  const t = totals(lines, { promo: { active: true, type: 'amt', value: 700, code: 'Y', min_cents: 0 }, manualDiscountCents: 500, rewardCents: 900 });
  assert.equal(t.discount_cents, 1000);
  assert.equal(t.reward_cents, 0);
  assert.equal(t.total_cents, 0);
});

test('MON-08 promo minimum spend', () => {
  const t = totals([{ unit_cents: 900, qty: 1 }], { promo: { active: true, type: 'amt', value: 200, code: 'MIN10', min_cents: 1000 } });
  assert.equal(t.discount_cents, 0);
});

test('MON-13 discount before tax, delivery taxed', () => {
  const t = totals([{ unit_cents: 2000, qty: 1 }], { taxRateBp: 1300, taxInclusive: false, deliveryCents: 500, manualDiscountCents: 500 });
  assert.equal(t.tax_cents, 260); // (2000 - 500 + 500) * 13%
});

test('MON-26 Ontario $4 rebate: 4.00 pays 5%, 4.01 pays 13%, delivery not counted', () => {
  const rebate = { limitCents: 400, bp: 500 };
  const o = { taxRateBp: 1300, taxInclusive: false, rebate };
  assert.equal(totals([{ unit_cents: 400, qty: 1 }], o).tax_cents, 20);
  assert.equal(totals([{ unit_cents: 401, qty: 1 }], o).tax_cents, 52);
  assert.equal(totals([{ unit_cents: 400, qty: 1 }], { ...o, deliveryCents: 500 }).tax_cents, 45);
});

test('POS-15/16 surcharge: credit only, capped, never Quebec or outside Canada', () => {
  assert.equal(surchargeCents(10000, 300), 240);
  assert.equal(surchargeCents(10000, 240, { method: 'debit' }), 0);
  assert.equal(surchargeCents(10000, 240, { province: 'QC' }), 0);
  assert.equal(surchargeCents(10000, 240, { region: 'nz' }), 0);
});

test('MON-24/25 tips capped and switchable', () => {
  assert.equal(checkTip(300, 2000), 300);
  assert.throws(() => checkTip(700, 2000), { code: 'bad_tip' });
  assert.throws(() => checkTip(25000, 1000000), { code: 'bad_tip' });
  assert.equal(checkTip(300, 2000, { enabled: false }), 0);
});

test('POS-11 even split always sums', () => {
  for (const [due, n] of [[10000, 3], [1, 6], [9999, 7]]) assert.equal(splitEven(due, n).reduce((a, b) => a + b, 0), due);
  assert.deepEqual(splitEven(10000, 3), [3333, 3333, 3334]);
});

test('POS-03 overpay: cash gives change, card capped with excess', () => {
  assert.deepEqual(applyPayment(5000, 4000, 2000, 'cash'), { applied: 1000, changeCents: 1000, excessCents: 0 });
  assert.deepEqual(applyPayment(5000, 4000, 2000, 'card_terminal'), { applied: 1000, changeCents: 0, excessCents: 1000 });
  assert.deepEqual(applyPayment(5000, 5000, 500, 'tab_share'), { applied: 0, changeCents: 0, excessCents: 500 });
});

test('REF-01 refunds never exceed what was paid', () => {
  assert.equal(canRefund(5000, 3000, 2000), true);
  assert.equal(canRefund(5000, 3000, 2001), false);
  assert.equal(canRefund(5000, 0, 0), false);
});

test('BOF-01/02/03 journal merges, flips negatives, balances', () => {
  const j = balanceJournal([
    { side: 'dr', account: 'cash', cents: 1130 }, { side: 'dr', account: 'cash', cents: -200 },
    { side: 'cr', account: 'sales', cents: 1000 }, { side: 'cr', account: 'tax', cents: 130 },
    { side: 'cr', account: 'sales', cents: -200 }
  ]);
  assert.equal(j.balanced, true);
});

test('ORD-02 hours past midnight belong to the day they opened', () => {
  const hours = { 5: [1020, 1560] }; // Friday 17:00 to 02:00
  assert.equal(isOpenAt(hours, 5, 1100), true);
  assert.equal(isOpenAt(hours, 6, 60), true); // Saturday 01:00
  assert.equal(isOpenAt(hours, 6, 130), false); // Saturday 02:10
  assert.equal(isOpenAt(hours, 5, 600), false);
});

test('POS-26 item discounts shared by value, last line takes the rounding, never above a line', () => {
  assert.deepEqual(allocate(1000, [1000, 2000, 3000]), [167, 333, 500]);
  assert.equal(allocate(999, [333, 333, 334]).reduce((a, v) => a + v, 0), 999);
  assert.deepEqual(allocate(5000, [1000, 2000]), [1000, 2000]); // capped at the lines
  assert.deepEqual(allocate(500, [0, 0]), [0, 0]);
  assert.throws(() => allocate(-1, [100]));
});

test('REF-10 a dish refund is its share of what was charged, tip left out, capped at paid', () => {
  // Two dishes 2000 + 1000, charged 3690 including 13% tax and a 300 tip.
  assert.equal(lineRefundCents(1000, 3000, 3690, 300), 1130);
  assert.equal(lineRefundCents(2000, 3000, 3690, 300), 2260);
  assert.equal(lineRefundCents(3000, 3000, 3690, 300, 1000), 1000);
  assert.equal(lineRefundCents(0, 3000, 3690), 0);
});

test('STF-09 tip shares are whole cents and always add up to the pot', () => {
  const s = splitTips(10000, { ana: 6, ben: 3, cai: 3, dee: 0 });
  assert.deepEqual(s, { ana: 5000, ben: 2500, cai: 2500, dee: 0 });
  const r = splitTips(1000, { a: 1, b: 1, c: 1.5 });
  assert.equal(r.a + r.b + r.c, 1000);
  assert.equal(r.c, 430); // the longest shift takes the leftover cents
  assert.deepEqual(splitTips(500, { a: 0 }), { a: 0 });
});
