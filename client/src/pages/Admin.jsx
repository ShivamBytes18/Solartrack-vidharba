import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty, ErrorNote, Field, Spinner, money, todayIso, useLoad } from '../ui.jsx';

const range = (r) => `${r.effectiveFrom} to ${r.effectiveTo || 'now'}`;
const inForce = (r) => r.effectiveFrom <= todayIso() && (!r.effectiveTo || r.effectiveTo >= todayIso());
const num = (v) => Number(v);

function Subsidy() {
  const { data, error, loading, reload } = useLoad(() => api.get('/admin/subsidy-rules'), []);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data?.[0] && !f) { const r = data[0]; setF({ name: '', effectiveFrom: '', fullRatePerKw: r.fullRatePerKw, fullRateMaxKw: r.fullRateMaxKw, extraKw: r.extraKw, extraPerKw: r.extraPerKw, cap: r.cap }); } }, [data, f]);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault(); setMsg('');
    try { await api.post('/admin/subsidy-rules', { ...f, fullRatePerKw: num(f.fullRatePerKw), fullRateMaxKw: num(f.fullRateMaxKw), extraKw: num(f.extraKw), extraPerKw: num(f.extraPerKw), cap: num(f.cap) }); setF(null); reload(); setMsg('Saved. The previous rule now ends the day before.'); }
    catch (x) { setMsg(x.message); }
  }
  return (
    <div className="stack">
      {data.length === 0 ? <Empty title="No subsidy rules">Add the first rule below.</Empty> : (
        <div className="panel scroll" style={{ padding: 0 }}><table>
          <thead><tr><th>Rule</th><th>Effective</th><th className="num">Per kW</th><th className="num">Up to kW</th><th className="num">Extra</th><th className="num">Cap</th></tr></thead>
          <tbody>{data.map((r) => <tr key={r._id} className={inForce(r) ? 'pick' : ''}><td>{r.name}{inForce(r) && <div className="muted">In force today</div>}</td><td>{range(r)}</td><td className="num">{money(r.fullRatePerKw)}</td><td className="num">{r.fullRateMaxKw}</td><td className="num">{r.extraKw} kW × {money(r.extraPerKw)}</td><td className="num">{money(r.cap)}</td></tr>)}</tbody></table></div>
      )}
      {f && (
        <form className="panel" onSubmit={save}>
          <h2>Add a new version</h2>
          <p className="muted">Old rules are never edited, so past quotes can always be explained.</p>
          <Field label="Name"><input value={f.name} onChange={set('name')} required /></Field>
          <Field label="Effective from"><input type="date" value={f.effectiveFrom} onChange={set('effectiveFrom')} required /></Field>
          <div className="grid2" style={{ gap: '0 1rem' }}>
            <Field label="Amount per kW (₹)"><input inputMode="numeric" value={f.fullRatePerKw} onChange={set('fullRatePerKw')} /></Field>
            <Field label="…for the first (kW)"><input inputMode="decimal" value={f.fullRateMaxKw} onChange={set('fullRateMaxKw')} /></Field>
            <Field label="Extra amount per kW (₹)"><input inputMode="numeric" value={f.extraPerKw} onChange={set('extraPerKw')} /></Field>
            <Field label="…for the next (kW)"><input inputMode="decimal" value={f.extraKw} onChange={set('extraKw')} /></Field>
            <Field label="Maximum subsidy (₹)"><input inputMode="numeric" value={f.cap} onChange={set('cap')} /></Field>
          </div>
          {msg && <p className="note info" role="status">{msg}</p>}
          <button className="btn" style={{ marginTop: '1rem' }}>Save rule</button>
        </form>
      )}
      {!f && msg && <p className="note info" role="status">{msg}</p>}
    </div>
  );
}

function Prices() {
  const { data, error, loading, reload } = useLoad(() => api.get('/admin/price-lists'), []);
  const [rows, setRows] = useState(null);
  const [from, setFrom] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data?.[0] && !rows) setRows(data[0].items.map((i) => ({ ...i }))); }, [data, rows]);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  async function save(e) {
    e.preventDefault(); setMsg('');
    try { await api.post('/admin/price-lists', { effectiveFrom: from, items: rows.map((r) => ({ kw: num(r.kw), price: num(r.price) })) }); setRows(null); setFrom(''); reload(); setMsg('Saved.'); }
    catch (x) { setMsg(x.message); }
  }
  return (
    <div className="stack">
      {data.map((l) => (
        <div key={l._id} className={`panel${inForce(l) ? ' pick' : ''}`}><strong>{range(l)}</strong>{inForce(l) && ' · in force today'}
          <div className="muted">{l.items.map((i) => `${i.kw} kW ${money(i.price)}`).join(' · ')}</div></div>
      ))}
      {rows && (
        <form className="panel" onSubmit={save}>
          <h2>Add a new price list</h2>
          <Field label="Effective from"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required /></Field>
          {rows.map((r, i) => (
            <div className="row" key={r.kw} style={{ marginTop: '.5rem' }}>
              <span style={{ width: 56 }}>{r.kw} kW</span>
              <input aria-label={`Price for ${r.kw} kW`} inputMode="numeric" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            </div>
          ))}
          {msg && <p className="note info" role="status" style={{ marginTop: '1rem' }}>{msg}</p>}
          <button className="btn" style={{ marginTop: '1rem' }}>Save price list</button>
        </form>
      )}
    </div>
  );
}

const LABELS = { genPerKw: 'Units per kW per year', defaultTariff: 'Default tariff (₹ per unit)', sqftPerKw: 'Roof area per kW (sq ft)', maxKw: 'Largest system (kW)', lowUnits: 'Low score below (units a month)', highUnits: 'High score from (units a month)', stuckDays: 'Stuck after (days in a stage)' };
function Settings() {
  const { data, error, loading, reload } = useLoad(() => api.get('/admin/settings'), []);
  const [v, setV] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setV(data); }, [data]);
  if (loading || !v) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  async function save(e) {
    e.preventDefault(); setMsg('');
    try { await api.put('/admin/settings', Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x)]))); setMsg('Saved. New quotes and scores use these values.'); }
    catch (x) { setMsg(x.message); }
  }
  return (
    <form className="panel" onSubmit={save}>
      {Object.keys(LABELS).map((k) => <Field key={k} label={LABELS[k]}><input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
      {msg && <p className="note info" role="status" style={{ marginTop: '1rem' }}>{msg}</p>}
      <button className="btn" style={{ marginTop: '1rem' }}>Save settings</button>
    </form>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('subsidy');
  const tabs = [['subsidy', 'Subsidy rules'], ['prices', 'Price lists'], ['settings', 'Settings']];
  return (
    <div className="stack">
      <h1>Rules</h1>
      <div className="chips" role="tablist">{tabs.map(([k, t]) => <button key={k} role="tab" className="chip" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => setTab(k)}>{t}</button>)}</div>
      {tab === 'subsidy' ? <Subsidy /> : tab === 'prices' ? <Prices /> : <Settings />}
    </div>
  );
}
