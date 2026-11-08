import test from 'node:test';
import assert from 'node:assert/strict';
import { activeAt, buildOption, effectiveTariff, recommendKw, subsidyFor } from '../src/lib/pricing.js';

const rule = { fullRatePerKw: 30000, fullRateMaxKw: 2, extraKw: 1, extraPerKw: 18000, cap: 78000 };

test('subsidy follows the 30k/kW to 2 kW + 18k third kW, capped at 78k', () => {
  assert.equal(subsidyFor(1, rule), 30000);
  assert.equal(subsidyFor(2, rule), 60000);
  assert.equal(subsidyFor(3, rule), 78000);
  assert.equal(subsidyFor(10, rule), 78000);
});
test('subsidy is zero with no rule or no size', () => {
  assert.equal(subsidyFor(3, null), 0);
  assert.equal(subsidyFor(0, rule), 0);
});
test('the cap really bites when the tiers would exceed it', () => {
  assert.equal(subsidyFor(3, { ...rule, cap: 70000 }), 70000);
});

const rules = [
  { name: 'old', effectiveFrom: '2024-01-01', effectiveTo: '2025-12-31' },
  { name: 'new', effectiveFrom: '2026-01-01' },
];
test('activeAt picks by date, end date inclusive', () => {
  assert.equal(activeAt(rules, '2025-12-31').name, 'old');
  assert.equal(activeAt(rules, '2026-01-01').name, 'new');
  assert.equal(activeAt(rules, '2030-06-01').name, 'new');
});
test('activeAt returns null before any rule starts', () => assert.equal(activeAt(rules, '2023-12-31'), null));

test('recommendKw matches the brief samples (340 units -> 3 kW, 85 units -> 1 kW)', () => {
  const s = { genPerKw: 1400, sqftPerKw: 100, maxKw: 10 };
  assert.equal(recommendKw(340, { ...s, roofArea: 900 }), 3);
  assert.equal(recommendKw(85, { ...s, roofArea: 500 }), 1);
});
test('recommendKw is limited by roof area and max size', () => {
  const s = { genPerKw: 1400, sqftPerKw: 100, maxKw: 10 };
  assert.equal(recommendKw(520, { ...s, roofArea: 250 }), 2);
  assert.equal(recommendKw(5000, { ...s, roofArea: 9000 }), 10);
});

test('option: net cost, generation, savings capped at own usage, payback', () => {
  const o = buildOption({ kw: 3, gross: 170000, subsidyRule: rule, genPerKw: 1400, tariff: 9, annualUnitsUsed: 4080 });
  assert.equal(o.subsidy, 78000);
  assert.equal(o.net, 92000);
  assert.equal(o.yearlyUnits, 4200);
  assert.equal(o.yearlySavings, 36720); // 4080 usable units x 9, not 4200
  assert.equal(o.paybackYears, 2.5);
});
test('payback is null when there are no savings', () => {
  assert.equal(buildOption({ kw: 1, gross: 70000, subsidyRule: rule, genPerKw: 1400, tariff: 0, annualUnitsUsed: 100 }).paybackYears, null);
});
test('effectiveTariff is clamped and falls back', () => {
  assert.equal(effectiveTariff(3200, 340, 8), 9.41);
  assert.equal(effectiveTariff(5000, 100, 8), 14);
  assert.equal(effectiveTariff(0, 100, 8), 8);
});
