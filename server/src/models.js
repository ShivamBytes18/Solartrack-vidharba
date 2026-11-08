import mongoose from 'mongoose';
import { LEAD_STATUSES } from './lib/stages.js';

const { Schema, model } = mongoose;
const Id = Schema.Types.ObjectId;

export const DEFAULT_SETTINGS = {
  genPerKw: 1400, // units per kW per year (brief: editable)
  defaultTariff: 8, // assumed ₹/unit when the bill gives no usable tariff
  sqftPerKw: 100, // assumed roof area needed per kW
  maxKw: 10,
  lowUnits: 100, // below this a lead scores Low (small bill)
  highUnits: 250, // from this an owner scores High
  stuckDays: 7, // days in one stage before a project counts as stuck
};

export const User = model('User', new Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: { type: String, enum: ['sales', 'admin'], default: 'sales' },
}, { timestamps: true }));

export const Counter = model('Counter', new Schema({ _id: String, seq: Number }));
export const Setting = model('Setting', new Schema({ _id: String, value: Number }));

export const FileDoc = model('File', new Schema({
  data: Buffer, mime: String, name: String, size: Number,
}, { timestamps: true }));

const billFields = { consumerNumber: String, tariff: String, sanctionedLoadKw: Number, monthlyUnits: Number, billAmount: Number };

export const Lead = model('Lead', new Schema({
  leadId: { type: String, unique: true },
  token: { type: String, unique: true },
  name: String, phone: String,
  ownerType: { type: String, enum: ['owner', 'tenant'] },
  roofType: { type: String, enum: ['rcc', 'sheet', 'tile'] },
  roofArea: Number, monthlyBill: Number, pincode: String,
  consentAt: Date,
  billFile: { type: Id, ref: 'File' },
  reading: { status: String, reason: String, fields: billFields, confidence: Schema.Types.Mixed, lowConfidence: [String] },
  bill: billFields, // values the person confirmed
  correctedFields: [String], // fields where the person overruled the AI (feeds accuracy tracking)
  billConfirmedAt: Date,
  score: { label: String, reasons: [String], recommendedKw: Number, nextStep: String, unitsUsed: Number, unitsSource: String },
  status: { type: String, enum: LEAD_STATUSES, default: 'new' },
  notes: [{ text: String, by: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));

const optionSchema = new Schema({ kw: Number, gross: Number, subsidy: Number, net: Number, yearlyUnits: Number, yearlySavings: Number, paybackYears: Number }, { _id: false });
export const Quote = model('Quote', new Schema({
  lead: { type: Id, ref: 'Lead', index: true },
  date: String, // the date whose rules were applied
  options: [optionSchema],
  primaryKw: Number,
  genPerKw: Number, tariff: Number, annualUnitsUsed: Number,
  subsidyRule: { name: String, effectiveFrom: String },
  priceListFrom: String,
  warnings: [String],
  createdBy: { type: Id, ref: 'User' },
  accepted: { type: Boolean, default: false },
}, { timestamps: true }));

export const Project = model('Project', new Schema({
  lead: { type: Id, ref: 'Lead', unique: true },
  quote: { type: Id, ref: 'Quote' },
  stageIndex: { type: Number, default: 0 },
  stageEnteredAt: { type: Date, default: Date.now },
  history: [{ stageIndex: Number, at: Date, note: String, by: String }],
  documents: [{ name: String, file: { type: Id, ref: 'File' }, at: { type: Date, default: Date.now } }],
  notifications: [{ channel: String, to: String, message: String, at: Date }],
}, { timestamps: true }));

export const SubsidyRule = model('SubsidyRule', new Schema({
  name: String, effectiveFrom: String, effectiveTo: String,
  fullRatePerKw: Number, fullRateMaxKw: Number, extraKw: Number, extraPerKw: Number, cap: Number,
}, { timestamps: true }));

export const PriceList = model('PriceList', new Schema({
  effectiveFrom: String, effectiveTo: String,
  items: [{ _id: false, kw: Number, price: Number }],
}, { timestamps: true }));

export async function getSettings() {
  const rows = await Setting.find().lean();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r._id, r.value])) };
}
