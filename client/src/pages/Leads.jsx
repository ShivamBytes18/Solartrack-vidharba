import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, ErrorNote, ScoreBadge, Spinner, fmtDate, money, useLoad } from '../ui.jsx';

const FILTERS = [['', 'All'], ['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low']];
const STATUS = { new: 'Awaiting bill', scored: 'Scored', surveyed: 'Surveyed', quoted: 'Quoted', won: 'Won', lost: 'Lost' };

export default function Leads() {
  const [label, setLabel] = useState('');
  const [q, setQ] = useState('');
  const dash = useLoad(() => api.get('/dashboard'), []);
  const leads = useLoad(() => api.get(`/leads?${new URLSearchParams({ ...(label && { label }), ...(q && { q }) })}`), [label, q]);
  const d = dash.data;

  return (
    <div className="stack">
      <h1>Leads</h1>
      {dash.error ? <ErrorNote error={dash.error} retry={dash.reload} /> : d && (
        <>
          <div className="tiles">
            <div className="tile"><b>{d.high}</b><span>High: worth a visit</span></div>
            <div className="tile"><b>{d.low}</b><span>Low: call first</span></div>
            <div className="tile"><b>{d.awaitingBill}</b><span>Awaiting bill</span></div>
            <div className="tile"><b>{d.activeProjects}</b><span>Active projects</span></div>
          </div>
          {d.stuck.length > 0 && (
            <div className="note warn">
              <strong>{d.stuck.length} project{d.stuck.length > 1 ? 's' : ''} stuck for {d.stuckDays}+ days</strong>
              <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem' }}>
                {d.stuck.map((s) => <li key={s.id}><Link to={`/staff/projects/${s.id}`}>{s.name}</Link>: {s.stage} for {s.days} days</li>)}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="row">
        <div className="chips" role="group" aria-label="Filter by score">
          {FILTERS.map(([v, t]) => <button key={t} className="chip" aria-pressed={label === v} onClick={() => setLabel(v)}>{t}</button>)}
        </div>
        <input className="right" style={{ maxWidth: 260 }} type="search" placeholder="Search name, ID or pincode" aria-label="Search leads" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {leads.loading ? <Spinner /> : leads.error ? <ErrorNote error={leads.error} retry={leads.reload} /> : leads.data.length === 0 ? (
        <Empty title="No leads match">Share the enquiry form link with customers, or clear the filters.</Empty>
      ) : (
        <div className="panel scroll" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Lead</th><th>Type</th><th className="num">Bill</th><th>Score</th><th className="num">Size</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              {leads.data.map((l) => (
                <tr key={l._id}>
                  <td><Link to={`/staff/leads/${l._id}`}><strong>{l.name}</strong></Link><div className="muted">{l.leadId} · {l.pincode}</div></td>
                  <td>{l.ownerType === 'owner' ? 'Owner' : 'Tenant'}</td>
                  <td className="num">{money(l.monthlyBill)}</td>
                  <td><ScoreBadge label={l.score?.label} /></td>
                  <td className="num">{l.score?.recommendedKw ? `${l.score.recommendedKw} kW` : '–'}</td>
                  <td>{STATUS[l.status]}</td>
                  <td>{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
