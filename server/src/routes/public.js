import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Counter, FileDoc, Lead, Project, getSettings } from '../models.js';
import { readBill } from '../lib/billReader.js';
import { scoreLead } from '../lib/score.js';
import { STAGES } from '../lib/stages.js';
import { HttpError, sniffImage, upload, wrap } from '../lib/http.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please try again in a few minutes.' } });

const leadSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
  ownerType: z.enum(['owner', 'tenant'], { message: 'Choose owner or tenant' }),
  roofType: z.enum(['rcc', 'sheet', 'tile'], { message: 'Choose a roof type' }),
  roofArea: z.coerce.number({ message: 'Enter the roof area' }).min(50, 'Roof area is at least 50 sq ft').max(100000),
  monthlyBill: z.coerce.number({ message: 'Enter your monthly bill' }).min(100, 'Bill is at least ₹100').max(500000),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  consent: z.literal('true', { message: 'Please agree to the use of your details' }),
});

const confirmSchema = z.object({
  consumerNumber: z.string().trim().max(20).optional(),
  tariff: z.string().trim().max(40).optional(),
  sanctionedLoadKw: z.coerce.number().min(0.1).max(1000).optional(),
  monthlyUnits: z.coerce.number().min(1, 'Units must be at least 1').max(100000).optional(),
});

async function storeImage(file) {
  if (!file) return null;
  const mime = sniffImage(file.buffer);
  if (!mime) throw new HttpError(400, 'Upload a JPG, PNG or WebP photo of your bill.');
  const doc = await FileDoc.create({ data: file.buffer, mime, name: file.originalname.slice(0, 80), size: file.size });
  return { doc, mime };
}

const byToken = async (token) => {
  const lead = await Lead.findOne({ token });
  if (!lead) throw new HttpError(404, 'This link is not valid.');
  return lead;
};

/** What a homeowner may see about their own lead. */
const view = (doc) => {
  const lead = doc.toObject();
  return {
    token: lead.token, leadId: lead.leadId, firstName: lead.name.split(' ')[0], ownerType: lead.ownerType,
    monthlyBill: lead.monthlyBill, hasImage: !!lead.billFile, reading: lead.reading, bill: lead.bill,
    confirmed: !!lead.billConfirmedAt, score: lead.score,
  };
};

async function applyReading(lead, image) {
  const reading = await readBill({ buffer: image.doc.data, mime: image.mime });
  lead.reading = reading;
}

router.post('/leads', limiter, upload.single('bill'), wrap(async (req, res) => {
  const data = leadSchema.parse(req.body);
  const image = await storeImage(req.file);
  const { seq } = await Counter.findOneAndUpdate({ _id: 'lead' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  const lead = new Lead({
    ...data, leadId: `LD-${seq}`, token: crypto.randomBytes(18).toString('hex'), consentAt: new Date(),
    billFile: image?.doc._id,
  });
  if (image) await applyReading(lead, image);
  else lead.reading = { status: 'manual', reason: 'No bill photo added. Please type the values from your bill.', fields: {}, confidence: {}, lowConfidence: [] };
  await lead.save();
  res.status(201).json(view(lead));
}));

router.get('/leads/:token', wrap(async (req, res) => res.json(view(await byToken(req.params.token)))));

router.get('/leads/:token/bill', wrap(async (req, res) => {
  const lead = await byToken(req.params.token);
  const file = lead.billFile && (await FileDoc.findById(lead.billFile));
  if (!file) throw new HttpError(404, 'No bill photo.');
  res.set({ 'Content-Type': file.mime, 'Cache-Control': 'private, max-age=300' }).send(file.data);
}));

router.post('/leads/:token/reupload', limiter, upload.single('bill'), wrap(async (req, res) => {
  const lead = await byToken(req.params.token);
  if (lead.billConfirmedAt) throw new HttpError(409, 'This bill is already confirmed.');
  const image = await storeImage(req.file);
  if (!image) throw new HttpError(400, 'Choose a photo to upload.');
  await FileDoc.findByIdAndDelete(lead.billFile);
  lead.billFile = image.doc._id;
  await applyReading(lead, image);
  await lead.save();
  res.json(view(lead));
}));

router.post('/leads/:token/confirm', limiter, wrap(async (req, res) => {
  const lead = await byToken(req.params.token);
  if (lead.billConfirmedAt) throw new HttpError(409, 'This bill is already confirmed.');
  const bill = confirmSchema.parse(req.body);
  const ai = lead.toObject().reading?.fields || {};
  lead.correctedFields = Object.keys(bill).filter((k) => ai[k] !== undefined && ai[k] !== null && String(ai[k]) !== String(bill[k]));
  lead.bill = bill;
  lead.billConfirmedAt = new Date();
  lead.score = scoreLead({ ownerType: lead.ownerType, monthlyBill: lead.monthlyBill, monthlyUnits: bill.monthlyUnits, roofArea: lead.roofArea }, await getSettings());
  lead.status = 'scored';
  await lead.save();
  res.json(view(lead));
}));

// Customer status page. No consumer number, address or bill image is exposed here.
router.get('/status/:token', wrap(async (req, res) => {
  const lead = await byToken(req.params.token);
  const project = await Project.findOne({ lead: lead._id }).lean();
  res.json({
    firstName: lead.name.split(' ')[0], leadId: lead.leadId, stages: STAGES, leadStatus: lead.status,
    nextStep: lead.score?.nextStep || null,
    project: project ? { stageIndex: project.stageIndex, history: project.history.map((h) => ({ stageIndex: h.stageIndex, at: h.at })) } : null,
  });
}));

export default router;
