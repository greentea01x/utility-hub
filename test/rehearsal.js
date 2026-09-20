import assert from 'node:assert/strict';

const water = (1260 - 1250) * 18;
const electric = (5350 - 5280) * 8;
const common = 30 * 35;
const total = water + electric + common;
assert.equal(water.toFixed(2), '180.00');
assert.equal(electric.toFixed(2), '560.00');
assert.equal(common.toFixed(2), '1050.00');
assert.equal(total.toFixed(2), '1790.00');
console.log(
  'room 205 · water 1,250 → 1,260 = 10 × 18.00 = 180.00 · electric 5,280 → 5,350 = 70 × 8.00 = 560.00 · common 30.00 × 35.00 = 1,050.00 · total 1,790.00',
);
