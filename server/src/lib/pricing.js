// Pure functions: no database, no clock. Everything here is unit tested.

/** The rule in force on `date`: latest effectiveFrom that has started and not ended (end date inclusive). */
export function activeAt(rules, date) {
  return (
    rules
      .filter((r) => r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date))
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0] || null
  );
}

/**
 * Subsidy in rupees for a system of `kw`.
 * Rule shape (from admin table): fullRatePerKw up to fullRateMaxKw, then extraPerKw for the next extraKw, capped.
 * Brief default: 30,000/kW up to 2 kW + 18,000 for the 3rd kW, cap 78,000.
 */
export function subsidyFor(kw, rule) {
  if (!rule || !(kw > 0)) return 0;
  const full = Math.min(kw, rule.fullRateMaxKw) * rule.fullRatePerKw;
  const extra = Math.min(Math.max(kw - rule.fullRateMaxKw, 0), rule.extraKw) * rule.extraPerKw;
  return Math.min(Math.round(full + extra), rule.cap);
}

/** Size suggested by yearly usage, limited by roof area and the largest size we sell. */
export function recommendKw(monthlyUnits, { genPerKw, roofArea, sqftPerKw, maxKw }) {
  const byUsage = Math.max(1, Math.round((monthlyUnits * 12) / genPerKw));
  const byRoof = roofArea ? Math.max(1, Math.floor(roofArea / sqftPerKw)) : maxKw;
  return Math.min(byUsage, byRoof, maxKw);
}

/** One quote option. Savings are capped at what the home actually uses (no credit for surplus). */
export function buildOption({ kw, gross, subsidyRule, genPerKw, tariff, annualUnitsUsed }) {
  const subsidy = subsidyFor(kw, subsidyRule);
  const net = gross - subsidy;
  const yearlyUnits = Math.round(kw * genPerKw);
  const usable = annualUnitsUsed > 0 ? Math.min(yearlyUnits, annualUnitsUsed) : yearlyUnits;
  const yearlySavings = Math.round(usable * tariff);
  const paybackYears = yearlySavings > 0 ? Math.round((net / yearlySavings) * 10) / 10 : null;
  return { kw, gross, subsidy, net, yearlyUnits, yearlySavings, paybackYears };
}

/** Effective ₹/unit from the customer's own bill, clamped to a sane band; falls back to the default. */
export function effectiveTariff(monthlyBill, monthlyUnits, fallback) {
  if (!(monthlyBill > 0 && monthlyUnits > 0)) return fallback;
  const t = monthlyBill / monthlyUnits;
  return Math.round(Math.min(14, Math.max(4, t)) * 100) / 100;
}
