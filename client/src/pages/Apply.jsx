import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Field } from '../ui.jsx';

export default function Apply() {
  const nav = useNavigate();
  const [f, setF] = useState({ ownerType: '', roofType: 'rcc', roofArea: '', monthlyBill: '', pincode: '', name: '', phone: '', consent: false });
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setFail('');
    const form = new FormData();
    Object.entries({ ...f, consent: String(f.consent) }).forEach(([k, v]) => form.append(k, v));
    if (photo) form.append('bill', photo);
    try {
      const lead = await api.upload('/public/leads', form);
      nav(`/check/${lead.token}`);
    } catch (err) {
      setErrors(err.fields || {});
      setFail(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="narrow">
      <h1>Find out if solar suits your home</h1>
      <p className="muted">Answer a few questions and add your electricity bill. You will see the system size we recommend in about a minute.</p>
      <form className="panel" onSubmit={submit} noValidate>
        <Field label="Do you own the house?" error={errors.ownerType}>
          <div className="seg" role="radiogroup">
            {[['owner', 'I own it'], ['tenant', 'I rent it']].map(([v, t]) => (
              <label key={v}><input type="radio" name="ownerType" value={v} checked={f.ownerType === v} onChange={set('ownerType')} /><span>{t}</span></label>
            ))}
          </div>
        </Field>
        <Field label="Roof type" error={errors.roofType}>
          <select value={f.roofType} onChange={set('roofType')}>
            <option value="rcc">Concrete (RCC) slab</option><option value="sheet">Metal sheet</option><option value="tile">Tiled</option>
          </select>
        </Field>
        <Field label="Roof area (sq ft)" error={errors.roofArea}><input inputMode="numeric" value={f.roofArea} onChange={set('roofArea')} placeholder="e.g. 800" /></Field>
        <Field label="Monthly electricity bill (₹)" error={errors.monthlyBill}><input inputMode="numeric" value={f.monthlyBill} onChange={set('monthlyBill')} placeholder="e.g. 3000" /></Field>
        <Field label="Pincode" error={errors.pincode}><input inputMode="numeric" maxLength={6} value={f.pincode} onChange={set('pincode')} placeholder="440010" /></Field>
        <Field label="Photo of your latest bill" hint="Keep the whole bill in the frame. JPG, PNG or WebP, up to 5 MB.">
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setPhoto(e.target.files[0] || null)} />
        </Field>
        <Field label="Your name" error={errors.name}><input autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Mobile number" error={errors.phone}><input inputMode="tel" autoComplete="tel-national" maxLength={10} value={f.phone} onChange={set('phone')} /></Field>
        <div className="field">
          <label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} />
            <span>I agree that Company A Solar may use my details and bill to assess solar for my home and contact me about it. I can ask for them to be deleted at any time.</span></label>
          {errors.consent && <span className="hint err">{errors.consent}</span>}
        </div>
        {fail && !Object.keys(errors).length && <p className="note error" role="alert">{fail}</p>}
        <button className="btn block" style={{ marginTop: '1.25rem' }} disabled={busy}>{busy ? 'Reading your bill…' : 'Check my home'}</button>
      </form>
    </main>
  );
}
