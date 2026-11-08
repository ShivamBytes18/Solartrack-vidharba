import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorNote, Field, Spinner, useLoad } from '../ui.jsx';

const FIELDS = [
  ['monthlyUnits', 'Units used in the month', 'numeric', 'Shown as “Units consumed” on your bill'],
  ['consumerNumber', 'Consumer number', 'text'],
  ['tariff', 'Tariff category', 'text'],
  ['sanctionedLoadKw', 'Sanctioned load (kW)', 'decimal'],
];

export default function Confirm() {
  const { token } = useParams();
  const nav = useNavigate();
  const { data: lead, error, loading, reload } = useLoad(() => api.get(`/public/leads/${token}`), [token]);
  const [vals, setVals] = useState({});
  const [manual, setManual] = useState(false);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [imgKey, setImgKey] = useState(0);

  useEffect(() => {
    if (lead) setVals(Object.fromEntries(FIELDS.map(([k]) => [k, lead.reading?.fields?.[k] ?? ''])));
  }, [lead]);

  if (loading) return <Spinner label="Opening your bill" />;
  if (error) return <main className="narrow"><ErrorNote error={error} retry={reload} /></main>;
  if (lead.confirmed) return <Navigate to={`/check/${token}/result`} replace />;

  const r = lead.reading || {};
  const needsPhoto = r.status === 'reupload' && !manual;
  const flagged = (k) => r.status === 'review' && r.lowConfidence?.includes(k);

  async function reupload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setMsg('');
    const form = new FormData(); form.append('bill', file);
    try { await api.upload(`/public/leads/${token}/reupload`, form); setImgKey((k) => k + 1); reload(); }
    catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMsg('');
    const body = Object.fromEntries(Object.entries(vals).filter(([, v]) => String(v).trim() !== '').map(([k, v]) => [k, String(v).trim()]));
    try { await api.post(`/public/leads/${token}/confirm`, body); nav(`/check/${token}/result`); }
    catch (err) { setErrors(err.fields || {}); setMsg(err.message); setBusy(false); }
  }

  return (
    <main className="narrow">
      <h1>Check your bill details</h1>
      {r.status === 'review' && <p className="muted">We read these from your photo. Please correct anything that looks wrong. Nothing is saved until you confirm.</p>}
      {r.status === 'manual' && <p className="note info">{r.reason}</p>}
      {needsPhoto && (
        <div className="note warn stack" role="alert">
          <p>{r.reason}</p>
          <label className="btn block">{busy ? 'Reading…' : 'Upload a clearer photo'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={reupload} disabled={busy} /></label>
          <button className="btn ghost block" onClick={() => setManual(true)}>Type the values instead</button>
        </div>
      )}
      {lead.hasImage && <img key={imgKey} className="billimg" style={{ margin: '1rem 0' }} src={`/api/public/leads/${token}/bill?v=${imgKey}`} alt="Your uploaded electricity bill" />}
      {!needsPhoto && (
        <form className="panel" onSubmit={confirm} noValidate>
          {FIELDS.map(([k, label, mode, hint]) => (
            <Field key={k} label={label} hint={hint} error={errors[k]} flag={flagged(k)}>
              <input inputMode={mode === 'text' ? undefined : mode} value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
            </Field>
          ))}
          {msg && !Object.keys(errors).length && <p className="note error" role="alert" style={{ marginTop: '1rem' }}>{msg}</p>}
          <p className="hint">Not sure of the units? Leave it empty and we will estimate from your bill amount (₹{lead.monthlyBill}).</p>
          <button className="btn block" style={{ marginTop: '1rem' }} disabled={busy}>{busy ? 'Saving…' : 'These are correct'}</button>
        </form>
      )}
    </main>
  );
}
