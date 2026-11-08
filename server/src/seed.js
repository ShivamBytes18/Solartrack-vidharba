import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from './config.js';
import { Counter, Lead, PriceList, Project, Quote, SubsidyRule, User, getSettings } from './models.js';
import { scoreLead } from './lib/score.js';
import { createQuote } from './lib/quote.js';
import { STAGES } from './lib/stages.js';
import { mockSend } from './lib/notify.js';

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const PRICES_V1 = [[1, 70000], [2, 120000], [3, 170000], [4, 215000], [5, 260000], [6, 305000], [7, 350000], [8, 395000], [9, 440000], [10, 485000]];
const bump = (p) => Math.round((p * 1.04) / 1000) * 1000;

// Fictional people only. First three rows are the sample leads from the brief.
const LEADS = [
  { leadId: 'LD-30881', name: 'Prashant Wankhede', phone: '9000000001', ownerType: 'owner', roofType: 'rcc', roofArea: 900, monthlyBill: 3200, pincode: '440010', units: 340, ago: 25 },
  { leadId: 'LD-30902', name: 'Rohit Meshram', phone: '9000000002', ownerType: 'tenant', roofType: 'rcc', roofArea: 600, monthlyBill: 1900, pincode: '440022', units: 210, ago: 12 },
  { leadId: 'LD-30915', name: 'Ayesha Siddiqui', phone: '9000000003', ownerType: 'owner', roofType: 'tile', roofArea: 500, monthlyBill: 650, pincode: '440015', units: 85, ago: 6 },
  { leadId: 'LD-30921', name: 'Sandeep Kale', phone: '9000000004', ownerType: 'owner', roofType: 'rcc', roofArea: 1200, monthlyBill: 5400, pincode: '440012', units: 520, ago: 5 },
  { leadId: 'LD-30927', name: 'Meena Deshpande', phone: '9000000005', ownerType: 'owner', roofType: 'sheet', roofArea: 700, monthlyBill: 2300, pincode: '440024', units: 230, ago: 3 },
  { leadId: 'LD-30930', name: 'Imran Sheikh', phone: '9000000006', ownerType: 'owner', roofType: 'rcc', roofArea: 80, monthlyBill: 1500, pincode: '440008', units: 170, ago: 2 },
  { leadId: 'LD-30933', name: 'Kavita Raut', phone: '9000000007', ownerType: 'owner', roofType: 'rcc', roofArea: 800, monthlyBill: 2800, pincode: '440030', units: null, ago: 1 }, // bill not yet confirmed
];

export async function seed({ reset = false } = {}) {
  if (reset) await Promise.all([User, Lead, Quote, Project, SubsidyRule, PriceList, Counter].map((m) => m.deleteMany({})));
  const passwordHash = await bcrypt.hash(config.seedPassword, 10);
  const [sales, admin] = await User.create([
    { name: 'Neha (Sales)', email: 'sales@demo.test', passwordHash, role: 'sales' },
    { name: 'Anil (Admin)', email: 'admin@demo.test', passwordHash, role: 'admin' },
  ]);

  await SubsidyRule.create({ name: 'Central residential scheme, as stated by client (verify before launch)', effectiveFrom: '2024-02-01', fullRatePerKw: 30000, fullRateMaxKw: 2, extraKw: 1, extraPerKw: 18000, cap: 78000 });
  await PriceList.create([
    { effectiveFrom: '2025-01-01', effectiveTo: '2026-03-31', items: PRICES_V1.map(([kw, price]) => ({ kw, price })) },
    { effectiveFrom: '2026-04-01', items: PRICES_V1.map(([kw, price]) => ({ kw, price: bump(price) })) },
  ]);
  await Counter.findByIdAndUpdate('lead', { seq: 30933 }, { upsert: true });

  const settings = await getSettings();
  const leads = [];
  for (const l of LEADS) {
    const confirmed = l.units != null;
    const lead = await Lead.create({
      leadId: l.leadId, token: crypto.randomBytes(18).toString('hex'), name: l.name, phone: l.phone, ownerType: l.ownerType,
      roofType: l.roofType, roofArea: l.roofArea, monthlyBill: l.monthlyBill, pincode: l.pincode, consentAt: daysAgo(l.ago),
      reading: { status: 'manual', reason: 'Seeded sample, no photo', fields: {}, confidence: {}, lowConfidence: [] },
      ...(confirmed && {
        bill: { consumerNumber: `1700${l.leadId.slice(3)}00`, tariff: 'LT-I Residential', sanctionedLoadKw: 5, monthlyUnits: l.units },
        billConfirmedAt: daysAgo(l.ago),
        score: scoreLead({ ownerType: l.ownerType, monthlyBill: l.monthlyBill, monthlyUnits: l.units, roofArea: l.roofArea }, settings),
        status: 'scored',
      }),
      createdAt: daysAgo(l.ago),
    });
    leads.push(lead);
  }

  // Prashant: quoted, accepted, stuck at net metering for 10 days (shows the stuck-project dashboard).
  const prashant = leads[0];
  const quote = await createQuote(prashant, { sizes: [2, 3, 4], primaryKw: 3, date: '2026-04-15' }, sales._id);
  quote.accepted = true; await quote.save();
  prashant.status = 'won'; await prashant.save();
  const project = new Project({ lead: prashant._id, quote: quote._id, stageIndex: 3, stageEnteredAt: daysAgo(10) });
  project.history = [0, 1, 2, 3].map((i) => ({ stageIndex: i, at: daysAgo(30 - i * 6), by: sales.name }));
  project.notifications = [0, 1, 2, 3].map((i) => ({ ...mockSend({ lead: prashant, stageIndex: i, baseUrl: 'http://localhost:4000' }), at: daysAgo(30 - i * 6) }));
  await project.save();

  // Sandeep: a fresh quote waiting for a decision.
  await createQuote(leads[3], { sizes: [4, 5, 6], primaryKw: 5 }, sales._id);
  console.log(`Seeded ${leads.length} leads. Stages: ${STAGES.length}. Demo users: sales@demo.test, admin@demo.test`);
}

if (process.argv[1].endsWith('seed.js')) {
  await mongoose.connect(config.mongoUri);
  await seed({ reset: process.argv.includes('--reset') });
  await mongoose.disconnect();
}
