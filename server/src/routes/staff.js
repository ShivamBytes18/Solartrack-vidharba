import { Router } from 'express';
import { z } from 'zod';
import { FileDoc, Lead, Project, Quote, getSettings } from '../models.js';
import { requireAdmin } from '../auth.js';
import { HttpError, sniffImage, upload, wrap } from '../lib/http.js';
import { LEAD_STATUSES, STAGES } from '../lib/stages.js';
import { createQuote } from '../lib/quote.js';
import { streamQuotePdf } from '../lib/pdf.js';
import { mockSend } from '../lib/notify.js';
import { isDate } from '../lib/dates.js';

const router = Router(); // mounted behind requireAuth
const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- Leads
router.get('/leads', wrap(async (req, res) => {
  const { label, status, q } = req.query;
  const filter = {};
  if (['High', 'Medium', 'Low'].includes(label)) filter['score.label'] = label;
  if (LEAD_STATUSES.includes(status)) filter.status = status;
  if (typeof q === 'string' && q.trim()) {
    const rx = new RegExp(esc(q.trim().slice(0, 40)), 'i');
    filter.$or = [{ name: rx }, { leadId: rx }, { pincode: rx }];
  }
  res.json(await Lead.find(filter).sort({ createdAt: -1 }).limit(200).select('-billFile -notes').lean());
}));

router.get('/leads/:id', wrap(async (req, res) => {
  const lead = await Lead.findById(req.params.id).lean();
  if (!lead) throw new HttpError(404, 'Lead not found.');
  const [quotes, project, settings] = await Promise.all([
    Quote.find({ lead: lead._id }).sort({ createdAt: -1 }).lean(), Project.findOne({ lead: lead._id }).select('_id stageIndex').lean(), getSettings(),
  ]);
  res.json({ lead: { ...lead, hasImage: !!lead.billFile }, quotes, project, settings });
}));

router.get('/leads/:id/bill', wrap(async (req, res) => {
  const lead = await Lead.findById(req.params.id).select('billFile');
  const file = lead?.billFile && (await FileDoc.findById(lead.billFile));
  if (!file) throw new HttpError(404, 'No bill photo.');
  res.set('Content-Type', file.mime).send(file.data);
}));

router.patch('/leads/:id', wrap(async (req, res) => {
  const body = z.object({ status: z.enum(LEAD_STATUSES).optional(), note: z.string().trim().min(1).max(500).optional() }).parse(req.body);
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new HttpError(404, 'Lead not found.');
  if (body.status) lead.status = body.status;
  if (body.note) lead.notes.push({ text: body.note, by: req.user.name });
  await lead.save();
  res.json({ ok: true });
}));

router.delete('/leads/:id', requireAdmin, wrap(async (req, res) => { // DPDP erasure request
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new HttpError(404, 'Lead not found.');
  const project = await Project.findOne({ lead: lead._id });
  const fileIds = [lead.billFile, ...(project?.documents.map((d) => d.file) || [])].filter(Boolean);
  await Promise.all([FileDoc.deleteMany({ _id: { $in: fileIds } }), Quote.deleteMany({ lead: lead._id }), Project.deleteMany({ lead: lead._id }), lead.deleteOne()]);
  res.json({ ok: true });
}));

// ---- Quotes
const quoteSchema = z.object({
  sizes: z.array(z.number().positive().max(100)).min(1, 'Choose at least one size').max(5, 'Choose up to five sizes'),
  primaryKw: z.number().positive(),
  date: z.string().refine(isDate, 'Use a valid date').optional(),
});

router.post('/leads/:id/quotes', wrap(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new HttpError(404, 'Lead not found.');
  if (!lead.billConfirmedAt) throw new HttpError(409, 'The customer has not confirmed their bill yet.');
  res.status(201).json(await createQuote(lead, quoteSchema.parse(req.body), req.user.id));
}));

router.get('/quotes/:id', wrap(async (req, res) => {
  const quote = await Quote.findById(req.params.id).populate('lead', 'leadId name phone token status').lean();
  if (!quote) throw new HttpError(404, 'Quote not found.');
  res.json({ ...quote, project: await Project.findOne({ quote: quote._id }).select('_id').lean() });
}));

router.get('/quotes/:id/pdf', wrap(async (req, res) => {
  const quote = await Quote.findById(req.params.id).populate('lead').lean();
  if (!quote) throw new HttpError(404, 'Quote not found.');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${quote.lead.leadId}-solar-quote.pdf"` });
  streamQuotePdf(res, quote, quote.lead);
}));

router.post('/quotes/:id/accept', wrap(async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw new HttpError(404, 'Quote not found.');
  const lead = await Lead.findById(quote.lead);
  if (await Project.exists({ lead: lead._id })) throw new HttpError(409, 'A project already exists for this customer.');
  const project = await Project.create({
    lead: lead._id, quote: quote._id, stageIndex: 0,
    history: [{ stageIndex: 0, at: new Date(), by: req.user.name }],
  });
  project.notifications.push(mockSend({ lead, stageIndex: 0, baseUrl: baseUrl(req) }));
  await project.save();
  quote.accepted = true; await quote.save();
  lead.status = 'won'; await lead.save();
  res.status(201).json({ id: project._id });
}));

// ---- Projects
router.get('/projects', wrap(async (req, res) => {
  const { stuckDays } = await getSettings();
  const rows = await Project.find().populate('lead', 'leadId name pincode').populate('quote', 'primaryKw').sort({ stageEnteredAt: 1 }).lean();
  res.json(rows.map((p) => {
    const days = Math.floor((Date.now() - new Date(p.stageEnteredAt)) / 86400000);
    return { ...p, daysInStage: days, stuck: p.stageIndex < STAGES.length - 1 && days >= stuckDays };
  }));
}));

router.get('/projects/:id', wrap(async (req, res) => {
  const p = await Project.findById(req.params.id).populate('lead', 'leadId name phone token pincode').populate('quote').lean();
  if (!p) throw new HttpError(404, 'Project not found.');
  res.json({ ...p, stages: STAGES, statusUrl: `${baseUrl(req)}/s/${p.lead.token}` });
}));

router.post('/projects/:id/advance', wrap(async (req, res) => {
  const { note } = z.object({ note: z.string().trim().max(300).optional() }).parse(req.body);
  const p = await Project.findById(req.params.id).populate('lead');
  if (!p) throw new HttpError(404, 'Project not found.');
  if (p.stageIndex >= STAGES.length - 1) throw new HttpError(409, 'This project is already complete.');
  p.stageIndex += 1; p.stageEnteredAt = new Date();
  p.history.push({ stageIndex: p.stageIndex, at: new Date(), note, by: req.user.name });
  p.notifications.push(mockSend({ lead: p.lead, stageIndex: p.stageIndex, baseUrl: baseUrl(req) }));
  await p.save();
  res.json({ ok: true });
}));

router.post('/projects/:id/documents', upload.single('file'), wrap(async (req, res) => {
  const name = z.string().trim().min(1, 'Name the document').max(80).parse(req.body.name);
  if (!req.file) throw new HttpError(400, 'Choose a file.');
  const isPdf = req.file.buffer.slice(0, 4).toString() === '%PDF';
  const mime = isPdf ? 'application/pdf' : sniffImage(req.file.buffer);
  if (!mime) throw new HttpError(400, 'Upload a PDF, JPG, PNG or WebP file.');
  const file = await FileDoc.create({ data: req.file.buffer, mime, name: req.file.originalname.slice(0, 80), size: req.file.size });
  const p = await Project.findByIdAndUpdate(req.params.id, { $push: { documents: { name, file: file._id } } });
  if (!p) throw new HttpError(404, 'Project not found.');
  res.status(201).json({ ok: true });
}));

router.get('/files/:id', wrap(async (req, res) => {
  const file = await FileDoc.findById(req.params.id);
  if (!file) throw new HttpError(404, 'File not found.');
  res.set('Content-Type', file.mime).send(file.data);
}));

// ---- Dashboard
router.get('/dashboard', wrap(async (req, res) => {
  const { stuckDays } = await getSettings();
  const [leads, projects] = await Promise.all([Lead.find().select('score.label status billConfirmedAt').lean(), Project.find().populate('lead', 'name leadId').lean()]);
  const count = (fn) => leads.filter(fn).length;
  const active = projects.filter((p) => p.stageIndex < STAGES.length - 1);
  const stuck = active
    .map((p) => ({ id: p._id, name: p.lead.name, leadId: p.lead.leadId, stage: STAGES[p.stageIndex], days: Math.floor((Date.now() - new Date(p.stageEnteredAt)) / 86400000) }))
    .filter((p) => p.days >= stuckDays).sort((a, b) => b.days - a.days);
  res.json({
    leads: leads.length, high: count((l) => l.score?.label === 'High'), medium: count((l) => l.score?.label === 'Medium'), low: count((l) => l.score?.label === 'Low'),
    awaitingBill: count((l) => !l.billConfirmedAt), activeProjects: active.length, stuckDays, stuck,
  });
}));

export default router;
