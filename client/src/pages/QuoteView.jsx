import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorNote, Spinner, money, openFile, useLoad } from '../ui.jsx';

export default function QuoteView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: q, error, loading, reload } = useLoad(() => api.get(`/quotes/${id}`), [id]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  const main = q.options.find((o) => o.kw === q.primaryKw);

  async function accept() {
    setBusy(true); setMsg('');
    try { const p = await api.post(`/quotes/${id}/accept`); nav(`/staff/projects/${p.id}`); } catch (e) { setMsg(e.message); setBusy(false); }
  }

  return (
    <div className="stack">
      <Link to={`/staff/leads/${q.lead._id}`}>← {q.lead.name}</Link>
      <h1>Quote for {q.lead.name}</h1>
      {q.warnings.map((w) => <p key={w} className="note warn">{w}</p>)}
      <div className="story">
        <div><b>{main.kw} kW</b><span>System size</span></div>
        <div><b>{money(main.net)}</b><span>Cost after {money(main.subsidy)} subsidy</span></div>
        <div><b>{main.paybackYears ?? 'n/a'}{main.paybackYears ? ' yrs' : ''}</b><span>Payback through lower bills</span></div>
      </div>
      <div className="panel scroll" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Size</th><th className="num">Price</th><th className="num">Subsidy</th><th className="num">You pay</th><th className="num">Units / yr</th><th className="num">Saving / yr</th><th className="num">Payback</th></tr></thead>
          <tbody>
            {q.options.map((o) => (
              <tr key={o.kw} className={o.kw === q.primaryKw ? 'pick' : ''}>
                <td><strong>{o.kw} kW</strong></td><td className="num">{money(o.gross)}</td><td className="num">{money(o.subsidy)}</td><td className="num"><strong>{money(o.net)}</strong></td>
                <td className="num">{o.yearlyUnits.toLocaleString('en-IN')}</td><td className="num">{money(o.yearlySavings)}</td><td className="num">{o.paybackYears ? `${o.paybackYears} yrs` : 'n/a'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>How this was worked out</h3>
        <p className="muted" style={{ margin: 0 }}>
          Rules as on {q.date}. Generation {q.genPerKw} units per kW per year. Saving = units produced (capped at the home’s own {Math.round(q.annualUnitsUsed).toLocaleString('en-IN')} units a year) × ₹{q.tariff} per unit.
          {q.subsidyRule ? ` Subsidy: ${q.subsidyRule.name}, from ${q.subsidyRule.effectiveFrom}.` : ' No subsidy applied.'} Prices from the list effective {q.priceListFrom}.
        </p>
      </div>
      {msg && <p className="note error" role="alert">{msg}</p>}
      <div className="row">
        <button className="btn ghost" onClick={() => openFile(`/quotes/${id}/pdf`, `${q.lead.leadId}-solar-quote.pdf`).catch((e) => setMsg(e.message))}>Download PDF</button>
        {q.project ? <Link className="btn" to={`/staff/projects/${q.project._id}`}>Open project</Link>
          : <button className="btn" onClick={accept} disabled={busy}>{busy ? 'Starting…' : 'Customer paid advance: start project'}</button>}
      </div>
    </div>
  );
}
