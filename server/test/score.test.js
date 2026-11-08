import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead } from '../src/lib/score.js';
import { interpret } from '../src/lib/billReader.js';

const s = { genPerKw: 1400, defaultTariff: 8, sqftPerKw: 100, maxKw: 10, lowUnits: 100, highUnits: 250 };

test('brief sample: owner, 340 units -> High, 3 kW, survey', () => {
  const r = scoreLead({ ownerType: 'owner', monthlyBill: 3200, monthlyUnits: 340, roofArea: 900 }, s);
  assert.deepEqual([r.label, r.recommendedKw, r.nextStep], ['High', 3, 'survey']);
});
test('brief sample: tenant -> Low, no size, call not survey', () => {
  const r = scoreLead({ ownerType: 'tenant', monthlyBill: 1900, monthlyUnits: 210, roofArea: 600 }, s);
  assert.deepEqual([r.label, r.recommendedKw, r.nextStep], ['Low', null, 'call']);
});
test('brief sample: owner, 85 units -> Low (small bill), 1 kW', () => {
  const r = scoreLead({ ownerType: 'owner', monthlyBill: 650, monthlyUnits: 85, roofArea: 500 }, s);
  assert.deepEqual([r.label, r.recommendedKw, r.nextStep], ['Low', 1, 'call']);
});
test('mid usage scores Medium', () => {
  assert.equal(scoreLead({ ownerType: 'owner', monthlyBill: 2300, monthlyUnits: 230, roofArea: 700 }, s).label, 'Medium');
});
test('roof too small is Low', () => {
  assert.equal(scoreLead({ ownerType: 'owner', monthlyBill: 1500, monthlyUnits: 170, roofArea: 80 }, s).label, 'Low');
});
test('with no units on the bill, usage is estimated from the amount', () => {
  const r = scoreLead({ ownerType: 'owner', monthlyBill: 2800, roofArea: 800 }, s);
  assert.equal(r.unitsUsed, 350);
  assert.equal(r.unitsSource, 'estimated from bill amount');
});

test('bill reading: clear photo goes to review, low confidence flagged', () => {
  const r = interpret({ consumerNumber: '170012345600', tariff: 'LT-I', sanctionedLoadKw: 5, monthlyUnits: '340', billAmount: 3200, photoQuality: 'good', confidence: { consumerNumber: 0.95, tariff: 0.6, sanctionedLoadKw: 0.9, monthlyUnits: 0.92, billAmount: 0.9 } });
  assert.equal(r.status, 'review');
  assert.equal(r.fields.monthlyUnits, 340);
  assert.deepEqual(r.lowConfidence, ['tariff']);
});
test('bill reading: poor photo asks for re-upload', () => {
  assert.equal(interpret({ photoQuality: 'poor', monthlyUnits: 300, tariff: 'x' }).status, 'reupload');
});
test('bill reading: too little read asks for re-upload; garbage goes manual', () => {
  assert.equal(interpret({ monthlyUnits: 300, photoQuality: 'good' }).status, 'reupload');
  assert.equal(interpret('nonsense').status, 'manual');
});
test('bill reading: implausible numbers are dropped, missing confidence counts as zero', () => {
  const r = interpret({ consumerNumber: '1', tariff: 'LT', monthlyUnits: 9999999, sanctionedLoadKw: 5, photoQuality: 'good' });
  assert.equal(r.fields.monthlyUnits, undefined);
  assert.equal(r.confidence.sanctionedLoadKw, 0);
});
