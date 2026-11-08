import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorNote, Spinner, fmtDate, useLoad } from '../ui.jsx';

const LEAD_TEXT = {
  new: 'We have your enquiry. Please confirm your bill details to continue.',
  scored: 'We have your details. Our team will call you shortly.',
  surveyed: 'Your roof visit is done. Your quote is being prepared.',
  quoted: 'Your quote has been prepared. Our team will walk you through it.',
  lost: 'This enquiry is closed. Call us any time if things change.',
};

export default function Status() {
  const { token } = useParams();
  const { data, error, loading, reload } = useLoad(() => api.get(`/public/status/${token}`), [token]);
  if (loading) return <Spinner />;
  if (error) return <main className="narrow"><ErrorNote error={error} retry={reload} /></main>;
  const { project, stages } = data;
  return (
    <main className="narrow stack">
      <div><h1>Hello {data.firstName}</h1><p className="muted">Reference {data.leadId}</p></div>
      {!project ? (
        <div className="panel"><p style={{ margin: 0 }}>{LEAD_TEXT[data.leadStatus] || LEAD_TEXT.scored}</p></div>
      ) : (
        <div className="panel">
          <h2>Your solar project</h2>
          <ol className="steps">
            {stages.map((s, i) => {
              const h = project.history.find((x) => x.stageIndex === i);
              const cls = i < project.stageIndex ? 'done' : i === project.stageIndex ? 'now' : 'todo';
              return <li key={s} className={cls} aria-current={cls === 'now' ? 'step' : undefined}>{s}{h && <small>{fmtDate(h.at)}</small>}</li>;
            })}
          </ol>
        </div>
      )}
    </main>
  );
}
