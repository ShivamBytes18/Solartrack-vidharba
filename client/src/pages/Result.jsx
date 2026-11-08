import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CopyButton, ErrorNote, ScoreBadge, Spinner, useLoad } from '../ui.jsx';

export default function Result() {
  const { token } = useParams();
  const { data: lead, error, loading, reload } = useLoad(() => api.get(`/public/leads/${token}`), [token]);
  if (loading) return <Spinner />;
  if (error) return <main className="narrow"><ErrorNote error={error} retry={reload} /></main>;
  if (!lead.score) return <main className="narrow"><p>Your bill is not confirmed yet.</p><Link className="btn" to={`/check/${token}`}>Confirm bill details</Link></main>;
  const { score } = lead;
  const survey = score.nextStep === 'survey';
  return (
    <main className="narrow stack">
      <div>
        <ScoreBadge label={score.label} />
        <h1 style={{ marginTop: '.5rem' }}>{survey ? `Solar looks like a good fit, ${lead.firstName}` : `Thanks, ${lead.firstName}`}</h1>
      </div>
      {score.recommendedKw && (
        <div className="panel">
          <div className="muted">Suggested system size</div>
          <div style={{ fontSize: '3.2rem', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.1 }}>{score.recommendedKw} kW</div>
          <p className="muted">Based on about {score.unitsUsed} units a month.</p>
        </div>
      )}
      <div className="note info">
        {survey
          ? <p style={{ margin: 0 }}>We will call you to book a free roof visit. After the visit you get a quote the same day, with the subsidy and payback worked out.</p>
          : <p style={{ margin: 0 }}>{score.reasons[0]}. Instead of a visit, one of our team will call you for a short chat and tell you honestly what will work. Nothing is rejected.</p>}
      </div>
      <div className="panel stack">
        <h2>Track your enquiry</h2>
        <p className="muted">Save this link. It shows where your project stands, without needing to call us.</p>
        <div className="row"><Link className="btn" to={`/s/${token}`}>Open status page</Link><CopyButton text={`${location.origin}/s/${token}`} /></div>
      </div>
      <p className="muted">Reference {lead.leadId}</p>
    </main>
  );
}
