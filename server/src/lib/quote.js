import { activeAt, buildOption, effectiveTariff } from './pricing.js';
import { today } from './dates.js';
import { HttpError } from './http.js';
import { getSettings, PriceList, Quote, SubsidyRule } from '../models.js';

export class QuoteError extends HttpError {
  constructor(message) { super(422, message); }
}

/** Build and save a quote using the subsidy rule and price list in force on `date`. */
export async function createQuote(lead, { sizes, primaryKw, date = today() }, userId) {
  const [settings, subsidyRules, priceLists] = await Promise.all([getSettings(), SubsidyRule.find().lean(), PriceList.find().lean()]);
  const priceList = activeAt(priceLists, date);
  if (!priceList) throw new QuoteError(`No price list is active on ${date}. Add one in Rules.`);
  const subsidyRule = activeAt(subsidyRules, date);
  const warnings = subsidyRule ? [] : [`No subsidy rule is active on ${date}; subsidy shown as zero.`];

  const unitsUsed = lead.bill?.monthlyUnits || lead.score?.unitsUsed || 0;
  const tariff = effectiveTariff(lead.monthlyBill, unitsUsed, settings.defaultTariff);
  const options = [];
  for (const kw of [...new Set(sizes)].sort((a, b) => a - b)) {
    const item = priceList.items.find((i) => i.kw === kw);
    if (!item) throw new QuoteError(`The price list has no price for ${kw} kW.`);
    options.push(buildOption({ kw, gross: item.price, subsidyRule, genPerKw: settings.genPerKw, tariff, annualUnitsUsed: unitsUsed * 12 }));
  }
  if (!options.some((o) => o.kw === primaryKw)) throw new QuoteError('The main option must be one of the chosen sizes.');

  const quote = await Quote.create({
    lead: lead._id, date, options, primaryKw, genPerKw: settings.genPerKw, tariff, annualUnitsUsed: unitsUsed * 12,
    subsidyRule: subsidyRule ? { name: subsidyRule.name, effectiveFrom: subsidyRule.effectiveFrom } : undefined,
    priceListFrom: priceList.effectiveFrom, warnings, createdBy: userId,
  });
  if (['new', 'scored', 'surveyed'].includes(lead.status)) { lead.status = 'quoted'; await lead.save(); }
  return quote;
}
