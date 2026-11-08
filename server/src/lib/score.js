import { recommendKw } from './pricing.js';

/**
 * Explainable lead score. Never rejects a lead: Low only swaps the site survey for a short call.
 * `s` = settings {genPerKw, defaultTariff, sqftPerKw, maxKw, lowUnits, highUnits}
 */
export function scoreLead({ ownerType, monthlyBill, monthlyUnits, roofArea }, s) {
  const unitsKnown = monthlyUnits > 0;
  const unitsUsed = unitsKnown ? monthlyUnits : Math.round(monthlyBill / s.defaultTariff);
  const unitsSource = unitsKnown ? 'bill' : 'estimated from bill amount';
  const base = { unitsUsed, unitsSource };
  const kw = recommendKw(unitsUsed, { genPerKw: s.genPerKw, roofArea, sqftPerKw: s.sqftPerKw, maxKw: s.maxKw });

  if (ownerType === 'tenant') {
    return { ...base, label: 'Low', reasons: ['Tenant: usually cannot install on a rented roof'], recommendedKw: null, nextStep: 'call' };
  }
  if (roofArea && roofArea < s.sqftPerKw) {
    return { ...base, label: 'Low', reasons: [`Roof area under ${s.sqftPerKw} sq ft, too small for 1 kW`], recommendedKw: null, nextStep: 'call' };
  }
  if (unitsUsed < s.lowUnits) {
    return { ...base, label: 'Low', reasons: [`Small bill: about ${unitsUsed} units a month`], recommendedKw: kw, nextStep: 'call' };
  }
  const high = unitsUsed >= s.highUnits;
  return {
    ...base,
    label: high ? 'High' : 'Medium',
    reasons: [`Owner, about ${unitsUsed} units a month (${unitsSource})`, `Fits a ${kw} kW system`],
    recommendedKw: kw,
    nextStep: 'survey',
  };
}
