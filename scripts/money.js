// Reference money core for a POS. Pure functions, integer cents, rates in basis points.
// Copy into your project and keep the tests (money.test.mjs) next to it.

export class MoneyError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
const bad = (m, c) => new MoneyError(m, c);

/** Round half up to a whole cent (works for negatives symmetrically). */
export const roundCents = (x) => Math.sign(x) * Math.round(Math.abs(x));

/**
 * Price a cart from the menu. The client sends ids and quantities only.
 * cart: [{ itemId, qty, mods: [optionId], note }]
 * itemsById: Map(id -> { id, name, active, price_cents, modifiers: [{ id, label, type: 'one'|'many', options: [{ id, label, price_cents }] }] })
 */
export function priceCart(cart, itemsById, soldOut = new Set(), { maxLines = 50, maxQty = 50 } = {}) {
  if (!Array.isArray(cart) || cart.length === 0) throw bad('Your order is empty.', 'empty_cart');
  if (cart.length > maxLines) throw bad('Too many lines in one order.', 'cart_too_large');
  return cart.map((line) => {
    const item = itemsById.get(String(line.itemId ?? ''));
    if (!item || !item.active) throw bad('One of the items is no longer available. Please refresh.', 'item_unavailable');
    if (soldOut.has(item.id)) throw bad(`${item.name} is sold out.`, 'sold_out');
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > maxQty) throw bad(`Quantity must be between 1 and ${maxQty}.`, 'bad_qty');
    const chosen = new Set(Array.isArray(line.mods) ? line.mods.map(String) : []);
    const known = new Set((item.modifiers || []).flatMap((g) => g.options.map((o) => o.id)));
    for (const id of chosen) if (!known.has(id)) throw bad(`Unknown option for ${item.name}. Please refresh.`, 'bad_mods');
    const labels = [];
    let extra = 0;
    for (const group of item.modifiers || []) {
      const picked = group.options.filter((o) => chosen.has(o.id));
      if (group.type === 'one') {
        if (picked.length > 1) throw bad(`Pick one ${group.label} for ${item.name}.`, 'bad_mods');
        const opt = picked[0] || group.options[0];
        if (opt) { labels.push(opt.label); extra += opt.price_cents || 0; }
      } else {
        for (const o of picked) { labels.push(o.label); extra += o.price_cents || 0; }
      }
    }
    const note = String(line.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
    return { itemId: item.id, name: item.name, qty, unit_cents: item.price_cents + extra, mods: labels, note };
  });
}

/**
 * Bill totals. Discounts and rewards come off before tax. Delivery is taxed like the food.
 * taxInclusive: prices include tax (NZ GST). Otherwise tax is added (Canada).
 * rebate: { limitCents, bp } a lower rate when the goods part is at or under the limit (Ontario $4 food rebate).
 */
export function totals(lines, { taxRateBp = 1500, taxInclusive = true, deliveryCents = 0, promo = null, rewardCents = 0, manualDiscountCents = 0, rebate = null } = {}) {
  const subtotal = lines.reduce((a, l) => a + l.unit_cents * l.qty, 0);
  let discount = 0;
  let promoCode = '';
  if (promo && promo.active && subtotal >= (promo.min_cents || 0)) {
    const raw = promo.type === 'pct' ? roundCents((subtotal * promo.value) / 100) : promo.value;
    discount = Math.max(0, Math.min(subtotal, raw));
    promoCode = promo.code;
  }
  if (manualDiscountCents > 0) discount = Math.min(subtotal, discount + manualDiscountCents);
  const reward = Math.max(0, Math.min(rewardCents, subtotal - discount));
  const goods = subtotal - discount - reward;
  const base = goods + deliveryCents;
  let tax;
  let total;
  if (taxInclusive) {
    total = base;
    tax = roundCents((total * taxRateBp) / (10000 + taxRateBp));
  } else {
    const bp = rebate && goods <= rebate.limitCents ? rebate.bp : taxRateBp;
    tax = roundCents((base * bp) / 10000);
    total = base + tax;
  }
  return { subtotal_cents: subtotal, discount_cents: discount, reward_cents: reward, delivery_cents: deliveryCents, tax_cents: tax, total_cents: total, promo_code: promoCode };
}

/** Credit card surcharge on the bill before tax, capped (2.4% in Canada). */
export const SURCHARGE_MAX_BP = 240;
export function surchargeCents(baseBeforeTaxCents, bp, { region = 'ca', province = '', method = 'credit' } = {}) {
  if (region !== 'ca' || province === 'QC' || method !== 'credit') return 0;
  if (baseBeforeTaxCents <= 0 || bp <= 0) return 0;
  return roundCents((baseBeforeTaxCents * Math.min(bp, SURCHARGE_MAX_BP)) / 10000);
}

/** Online tip: optional, capped at 30% of the amount and a fixed maximum. */
export function checkTip(tipCents, amountCents, { enabled = true, pctCap = 0.3, maxCents = 20000 } = {}) {
  if (!enabled || !tipCents) return 0;
  const tip = Number(tipCents);
  if (!Number.isInteger(tip) || tip < 0 || tip > Math.min(maxCents, Math.round(amountCents * pctCap))) throw bad('That tip is more than we can accept online.', 'bad_tip');
  return tip;
}

/** Even split of what is still due. The last share takes the remainder, so shares always sum to the amount. */
export function splitEven(dueCents, ways) {
  if (!Number.isInteger(ways) || ways < 1 || ways > 20) throw bad('Split between 1 and 20 ways.', 'bad_split');
  if (dueCents <= 0) return Array(ways).fill(0);
  const each = Math.floor(dueCents / ways);
  const shares = Array(ways).fill(each);
  shares[ways - 1] += dueCents - each * ways;
  return shares;
}

/**
 * Share an amount across lines by value (an item discount over chosen dishes, a bill discount over seats).
 * Each share is rounded; the last line takes what is left, so the shares always sum to the amount.
 * No share is larger than its own line. weights: line values in cents.
 */
export function allocate(amountCents, weights) {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw bad('Amount must be whole cents.', 'bad_amount');
  const gross = weights.reduce((a, w) => a + w, 0);
  if (!weights.length || gross <= 0) return weights.map(() => 0);
  const amount = Math.min(amountCents, gross);
  let left = amount;
  return weights.map((w, i) => {
    const v = i === weights.length - 1 ? left : Math.min(w, Math.round((amount * w) / gross));
    left -= v;
    return v;
  });
}

/**
 * What one dish cost the guest, for a dish-level refund (out of stock, a wrong dish): its share of what was
 * actually charged (tax, delivery and discounts spread by value), the tip left out, never more than was paid.
 */
export function lineRefundCents(lineNetCents, allLinesNetCents, chargedCents, tipCents = 0, paidCents = chargedCents) {
  if (allLinesNetCents <= 0 || lineNetCents <= 0) return 0;
  const share = Math.round((lineNetCents * Math.max(0, chargedCents - tipCents)) / allLinesNetCents);
  return Math.max(0, Math.min(paidCents, share));
}

/**
 * Split a tip pot by score (hours worked, or hours times a role weight). Whole cents; leftover cents go to
 * whoever has the highest score, so the shares always add up to the pot. scores: { personId: number }.
 */
export function splitTips(potCents, scores) {
  const ids = Object.keys(scores).filter((k) => scores[k] > 0);
  const out = Object.fromEntries(Object.keys(scores).map((k) => [k, 0]));
  const total = ids.reduce((a, k) => a + scores[k], 0);
  if (potCents <= 0 || total <= 0) return out;
  let given = 0;
  for (const k of ids) { out[k] = Math.floor((potCents * scores[k]) / total); given += out[k]; }
  const top = ids.reduce((a, k) => (scores[k] > scores[a] ? k : a), ids[0]);
  out[top] += potCents - given;
  return out;
}

/**
 * Apply a payment to a bill as the optimistic lock would: returns { applied, changeCents, excessCents }.
 * Cash may overpay (change given). Other methods are capped at what is due; the excess is reported for refund.
 */
export function applyPayment(totalCents, paidCents, amountCents, method) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw bad('Enter an amount.', 'bad_amount');
  const due = Math.max(0, totalCents - paidCents);
  if (due === 0) return { applied: 0, changeCents: method === 'cash' ? amountCents : 0, excessCents: method === 'cash' ? 0 : amountCents };
  if (amountCents <= due) return { applied: amountCents, changeCents: 0, excessCents: 0 };
  if (method === 'cash') return { applied: due, changeCents: amountCents - due, excessCents: 0 };
  return { applied: due, changeCents: 0, excessCents: amountCents - due };
}

/** Refund guard: can we refund `amount` against a payment that already has `refunded` refunded? */
export function canRefund(paidCents, alreadyRefundedCents, amountCents) {
  return Number.isInteger(amountCents) && amountCents > 0 && alreadyRefundedCents + amountCents <= paidCents;
}

/**
 * Balance a day's journal. lines: [{ side: 'dr'|'cr', account, cents }].
 * Merges same account and side, flips negatives to the other side, drops zeros.
 */
export function balanceJournal(lines) {
  const map = new Map();
  for (const l of lines) {
    let { side, cents } = l;
    if (cents < 0) { side = side === 'dr' ? 'cr' : 'dr'; cents = -cents; }
    const k = `${side}:${l.account}`;
    map.set(k, (map.get(k) || 0) + cents);
  }
  const out = [...map].filter(([, c]) => c !== 0).map(([k, cents]) => { const [side, account] = k.split(/:(.*)/s); return { side, account, cents }; });
  const diff = out.reduce((a, l) => a + (l.side === 'dr' ? l.cents : -l.cents), 0);
  return { lines: out, balanced: diff === 0, diffCents: diff };
}

/** Is a branch open? hours = { "0": [openMin, closeMin], ... } (0 = Sunday). closeMin may exceed 1440 (past midnight). */
export function isOpenAt(hours, localDay, localMinute) {
  const today = hours[String(localDay)];
  if (today && localMinute >= today[0] && localMinute < today[1]) return true;
  const yesterday = hours[String((localDay + 6) % 7)];
  return !!(yesterday && yesterday[1] > 1440 && localMinute + 1440 < yesterday[1]);
}
