import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CopyButton, ErrorNote, Field, Spinner, fmtDate, money, openFile, useLoad } from '../ui.jsx';

export default function ProjectDetail() {
  const { id } = useParams();
  const { data: p, error, loading, reload } = useLoad(() => api.get(`/projects/${id}`), [id]);
  const [note, setNote] = useState('');
  const [docName, setDocName] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  const main = p.quote.options.find((o) => o.kw === p.quote.primaryKw);
  const done = p.stageIndex >= p.stages.length - 1;

  const run = async (fn) => { setBusy(true); setMsg(''); try { await fn(); await reload(); } catch (e) { setMsg(e.message); } setBusy(false); };
  const advance = () => run(async () => { await api.post(`/projects/${id}/advance`, { note: note || undefined }); setNote(''); });
  const addDoc = () => run(async () => { const f = new FormData(); f.append('name', docName); f.append('file', file); await api.upload(`/projects/${id}/documents`, f); setDocName(''); setFile(null); });

  return (
    <div className="stack">
      <Link to="/staff/projects">← Projects</Link>
      <h1>{p.lead.name}</h1>
      <p className="muted" style={{ margin: 0 }}>{p.lead.leadId} · {main.kw} kW · pays {money(main.net)} · <Link to={`/staff/leads/${p.lead._id}`}>lead</Link></p>
      {msg && <p className="note error" role="alert">{msg}</p>}
      <div className="grid2">
        <section className="panel">
          <h2>Progress</h2>
          <ol className="steps">
            {p.stages.map((s, i) => {
              const h = p.history.find((x) => x.stageIndex === i);
              const cls = i < p.stageIndex || (done && i === p.stageIndex) ? 'done' : i === p.stageIndex ? 'now' : 'todo';
              return <li key={s} className={cls}>{s}{h && <small>{fmtDate(h.at)}{h.by ? ` · ${h.by}` : ''}{h.note ? ` · ${h.note}` : ''}</small>}</li>;
            })}
          </ol>
          {!done && (
            <div className="stack">
              <Field label={`Move to “${p.stages[p.stageIndex + 1]}”`}><input placeholder="Optional note (e.g. file number)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
              <button className="btn" onClick={advance} disabled={busy}>{busy ? 'Updating…' : 'Mark stage complete and notify customer'}</button>
            </div>
          )}
        </section>
        <section className="stack">
          <div className="panel stack">
            <h2>Customer status link</h2>
            <p className="muted" style={{ margin: 0 }}>The customer sees stages and dates only.</p>
            <div className="row"><a className="btn ghost" href={p.statusUrl} target="_blank" rel="noreferrer">Open</a><CopyButton text={p.statusUrl} /></div>
          </div>
          <div className="panel stack">
            <h2>Documents</h2>
            {p.documents.length === 0 && <p className="muted" style={{ margin: 0 }}>No documents yet. Add the net metering form, sanction letters or photos.</p>}
            {p.documents.map((d) => <p key={d._id} style={{ margin: 0 }}><button className="btn ghost small" onClick={() => openFile(`/files/${d.file}`).catch((e) => setMsg(e.message))}>{d.name}</button> <span className="muted">{fmtDate(d.at)}</span></p>)}
            <Field label="Add document"><input placeholder="Name, e.g. Net metering application" value={docName} onChange={(e) => setDocName(e.target.value)} maxLength={80} /></Field>
            <input type="file" aria-label="Document file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} />
            <button className="btn ghost" onClick={addDoc} disabled={busy || !file || !docName.trim()}>Upload</button>
          </div>
          <div className="panel stack">
            <h2>Messages sent</h2>
            <p className="hint" style={{ margin: 0 }}>Simulated in this build: nothing is actually sent.</p>
            {[...p.notifications].reverse().map((n, i) => <div key={i} className="note"><strong>{n.channel}</strong> to {n.to} · {fmtDate(n.at)}<br />{n.message}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
