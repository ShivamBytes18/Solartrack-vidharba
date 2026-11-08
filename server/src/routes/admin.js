import { Router } from 'express';
import { z } from 'zod';
import { DEFAULT_SETTINGS, PriceList, Setting, SubsidyRule, getSettings } from '../models.js';
import { HttpError, wrap } from '../lib/http.js';
import { isDate, prevDay } from '../lib/dates.js';

const router = Router(); // mounted behind requireAuth + requireAdmin
const date = z.string().refine(isDate, 'Use a valid date');

/** Add a new version of a dated rule table. History stays intact: the open rule is closed the day before. */
async function addVersion(Model, doc) {
  const latest = await Model.findOne().sort({ effectiveFrom: -1 });
  if (latest && doc.effectiveFrom <= latest.effectiveFrom) throw new HttpError(409, `The new rule must start after ${latest.effectiveFrom}. Past rules are never edited.`);
  if (latest && !latest.effectiveTo) { latest.effectiveTo = prevDay(doc.effectiveFrom); await latest.save(); }
  return Model.create(doc);
}

const subsidySchema = z.object({
  name: z.string().trim().min(3).max(100), effectiveFrom: date,
  fullRatePerKw: z.number().min(0).max(1e6), fullRateMaxKw: z.number().min(0).max(100),
  extraKw: z.number().min(0).max(100), extraPerKw: z.number().min(0).max(1e6), cap: z.number().min(0).max(1e7),
});
router.get('/subsidy-rules', wrap(async (_req, res) => res.json(await SubsidyRule.find().sort({ effectiveFrom: -1 }).lean())));
router.post('/subsidy-rules', wrap(async (req, res) => res.status(201).json(await addVersion(SubsidyRule, subsidySchema.parse(req.body)))));

const priceSchema = z.object({
  effectiveFrom: date,
  items: z.array(z.object({ kw: z.number().positive().max(100), price: z.number().positive().max(1e8) })).min(1).max(20),
});
router.get('/price-lists', wrap(async (_req, res) => res.json(await PriceList.find().sort({ effectiveFrom: -1 }).lean())));
router.post('/price-lists', wrap(async (req, res) => {
  const body = priceSchema.parse(req.body);
  if (new Set(body.items.map((i) => i.kw)).size !== body.items.length) throw new HttpError(400, 'Each size can appear once.');
  res.status(201).json(await addVersion(PriceList, body));
}));

router.get('/settings', wrap(async (_req, res) => res.json(await getSettings())));
router.put('/settings', wrap(async (req, res) => {
  const body = z.object(Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, z.number().positive().max(1e6)]))).parse(req.body);
  await Promise.all(Object.entries(body).map(([k, v]) => Setting.findByIdAndUpdate(k, { value: v }, { upsert: true })));
  res.json(await getSettings());
}));

export default router;
