import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import { ErrorNote, ScoreBadge, Spinner, fmtDate, money, todayIso, useBlobUrl, useLoad } from '../ui.jsx';

const STATUS = ['new', 'scored', 'surveyed', 'quoted', 'won', 'lost'];

export default function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(() => api.get(`/leads/${id}`), [id]);
  const img = useBlobUrl(data?.lead.hasImage ? `/leads/${id}/bill` : null);
  const [sizes, setSizes] = useState([]);
  const [primary, setPrimary] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const rec = data?.lead.score?.recommendedKw;
  useEffect(() => {
    if (!data) return;
    const k = rec || 3, max = data.settings.maxKw;
    const pick = [k - 1, k, k + 1].filter((x) => x >= 1 && x <= max);
    setSizes(pick); setPrimary(k);
  }, [data, rec]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  const { lead, quotes, project, settings } = data;
  const toggle = (k) => setSizes((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length < 5 ? [...s, k] : s));

  async function createQuote() {
    setBusy(true); setMsg('');
    try { const q = await api.post(`/leads/${id}/quotes`, { sizes, primaryKw: sizes.includes(primary) ? primary : sizes[0], date }); nav(`/staff/quotes/${q._id}`); }
    catch (e) { setMsg(e.message); setBusy(false); }
  }
  const act = (fn) => async () => { try { await fn(); reload(); } catch (e) { setMsg(e.message); } };

  return (
    <div className="stack">
      <div className="row"><Link to="/staff">← Leads</Link></div>
      <div className="row"><h1 style={{ margin: 0 }}>{lead.name}</h1><ScoreBadge label={lead.score?.label} /><span className="muted">{lead.leadId}</span></div>
      <div className="grid2">
        <section className="panel stack">
          <h2>Customer and bill</h2>
          <dl className="facts">
            <dt>Phone</dt><dd>+91 {lead.phone}</dd><dt>Type</dt><dd>{lead.ownerType === 'owner' ? 'Owner' : 'Tenant'}</dd>
            <dt>Roof</dt><dd>{lead.roofType.toUpperCase()}, {lead.roofArea} sq ft</dd><dt>Pincode</dt><dd>{lead.pincode}</dd>
            <dt>Bill amount</dt><dd>{money(lead.monthlyBill)}</dd>
            {lead.bill && <><dt>Units / month</dt><dd>{lead.bill.monthlyUnits ?? 'not given'}</dd><dt>Consumer no.</dt><dd>{lead.bill.consumerNumber || '–'}</dd><dt>Tariff</dt><dd>{lead.bill.tariff || '–'}</dd><dt>Sanctioned load</dt><dd>{lead.bill.sanctionedLoadKw ? `${lead.bill.sanctionedLoadKw} kW` : '–'}</dd></>}
          </dl>
          {lead.correctedFields?.length > 0 && <p className="note warn">Customer changed what the AI read: {lead.correctedFields.join(', ')}.</p>}
          {!lead.billConfirmedAt && <p className="note info">The customer has not confirmed their bill yet.</p>}
          {lead.hasImage && (img ? <img className="billimg" src={img} alt="Customer electricity bill" /> : <Spinner label="Loading bill" />)}
        </section>
        <section className="stack">
          <div className="panel stack">
            <h2>Score and next step</h2>
            {lead.score ? (
              <>
                <p style={{ margin: 0 }}>{lead.score.reasons.join('. ')}.</p>
                <p className="note info" style={{ margin: 0 }}>{lead.score.nextStep === 'survey' ? 'Book a roof survey.' : 'Make a short call first. No survey needed yet.'}</p>
              </>
            ) : <p className="muted">Not scored until the customer confirms the bill.</p>}
            <label className="field"><span className="label">Status</span>
              <select value={lead.status} onChange={(e) => act(() => api.patch(`/leads/${id}`, { status: e.target.value }))()}>
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          {lead.billConfirmedAt && !project && (
            <div className="panel stack">
              <h2>New quote</h2>
              <div><span className="label">System sizes (up to 5)</span>
                <div className="chips">{Array.from({ length: settings.maxKw }, (_, i) => i + 1).map((k) => <button key={k} className="chip" aria-pressed={sizes.includes(k)} onClick={() => toggle(k)}>{k} kW{k === rec ? ' ★' : ''}</button>)}</div>
              </div>
              <label className="field"><span className="label">Main option shown first</span>
                <select value={primary ?? ''} onChange={(e) => setPrimary(Number(e.target.value))}>{[...sizes].sort((a, b) => a - b).map((k) => <option key={k} value={k}>{k} kW</option>)}</select>
              </label>
              <label className="field"><span className="label">Rules as on</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><span className="hint">Subsidy and prices are taken from the rules in force on this date.</span></label>
              {msg && <p className="note error" role="alert">{msg}</p>}
              <button className="btn" onClick={createQuote} disabled={busy || sizes.length === 0}>{busy ? 'Building…' : 'Create quote'}</button>
            </div>
          )}
          {project && <div className="note info"><Link to={`/staff/projects/${project._id}`}>Open this customer’s project →</Link></div>}
          {quotes.length > 0 && (
            <div className="panel"><h2>Quotes</h2>
              {quotes.map((q) => <p key={q._id} style={{ margin: '.4rem 0' }}><Link to={`/staff/quotes/${q._id}`}>{q.primaryKw} kW quote, {fmtDate(q.createdAt)}</Link>{q.accepted && ' · accepted'}</p>)}
            </div>
          )}
          <div className="panel stack">
            <h2>Notes</h2>
            {lead.notes?.map((n, i) => <p key={i} style={{ margin: 0 }}>{n.text}<span className="muted"> · {n.by}, {fmtDate(n.at)}</span></p>)}
            <div className="row"><input className="grow" aria-label="Add a note" placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn ghost" disabled={!note.trim()} onClick={act(async () => { await api.patch(`/leads/${id}`, { note }); setNote(''); })}>Add</button></div>
          </div>
          {user.role === 'admin' && <button className="btn danger" onClick={async () => { if (confirm('Delete this customer and all their data? This cannot be undone.')) { await api.del(`/leads/${id}`); nav('/staff'); } }}>Delete customer data</button>}
        </section>
      </div>
    </div>
  );
}
