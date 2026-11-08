import { config } from '../config.js';

const FIELDS = ['consumerNumber', 'tariff', 'sanctionedLoadKw', 'monthlyUnits', 'billAmount'];
const THRESHOLD = 0.75;

const PROMPT = `You read photos of Indian electricity bills (MSEDCL or other DISCOMs).
Return ONLY a JSON object, no prose, with these keys:
consumerNumber (string), tariff (string, e.g. "LT-I Residential"), sanctionedLoadKw (number),
monthlyUnits (number, units consumed in the billing month), billAmount (number, rupees due),
photoQuality ("good" or "poor"), and confidence (object with the same five field names, each 0 to 1).
Use null for anything you cannot read. Never guess: a null is better than a wrong number.`;

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const str = (v) => (v == null || v === '' ? undefined : String(v).replace(/\s+/g, ' ').trim().slice(0, 40) || undefined);

/** Turn the model's raw JSON into a safe reading. Pure, so it is unit tested. */
export function interpret(raw) {
  if (!raw || typeof raw !== 'object') {
    return { status: 'manual', reason: 'The reading could not be understood. Please type the values.', fields: {}, confidence: {}, lowConfidence: FIELDS };
  }
  const fields = {
    consumerNumber: str(raw.consumerNumber),
    tariff: str(raw.tariff),
    sanctionedLoadKw: num(raw.sanctionedLoadKw),
    monthlyUnits: num(raw.monthlyUnits),
    billAmount: num(raw.billAmount),
  };
  if (fields.monthlyUnits > 100000) fields.monthlyUnits = undefined; // implausible: treat as unread
  if (fields.sanctionedLoadKw > 1000) fields.sanctionedLoadKw = undefined;
  const confidence = {};
  for (const k of FIELDS) {
    const c = Number(raw.confidence?.[k]);
    confidence[k] = fields[k] === undefined ? 0 : Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0;
  }
  const found = Object.values(fields).filter((v) => v !== undefined).length;
  if (raw.photoQuality === 'poor' || found < 2) {
    return { status: 'reupload', reason: 'The photo is too blurry or cropped to read. Please retake it with the whole bill in frame.', fields, confidence, lowConfidence: FIELDS };
  }
  const lowConfidence = FIELDS.filter((k) => fields[k] === undefined || confidence[k] < THRESHOLD);
  return { status: 'review', reason: '', fields, confidence, lowConfidence };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(model, { buffer, mime }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
    signal: AbortSignal.timeout(65000),
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: mime, data: buffer.toString('base64') } },
        { text: PROMPT },
      ] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  return interpret(json ? JSON.parse(json) : null);
}

export async function readBill({ buffer, mime }) {
  const manual = (reason) => ({ status: 'manual', reason, fields: {}, confidence: {}, lowConfidence: FIELDS });
  if (!config.geminiKey) return manual('Automatic reading is switched off. Please type the values from your bill.');

  // Main model, then an optional backup. Retry only temporary errors (network, 429, 5xx) with growing waits.
  const models = [config.geminiModel, config.geminiFallbackModel].filter(Boolean);
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await callGemini(model, { buffer, mime });
      } catch (err) {
        console.error(`bill reading failed (${model}, try ${attempt + 1}):`, err.message, err.cause?.code || '');
        const temporary = !err.status || err.status === 429 || err.status >= 500;
        if (!temporary) break; // 400/403/404: retrying the same model will not help
        await sleep(1000 * 3 ** attempt);
      }
    }
  }
  return manual('We could not read the bill automatically. Please type the values.');
}
