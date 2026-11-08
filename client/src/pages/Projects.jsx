import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, ErrorNote, Spinner, useLoad } from '../ui.jsx';

export default function Projects() {
  const { data, error, loading, reload } = useLoad(() => api.get('/projects'), []);
  const [onlyStuck, setOnlyStuck] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} retry={reload} />;
  const rows = onlyStuck ? data.filter((p) => p.stuck) : data;
  const last = (p) => p.stageIndex >= 6;
  return (
    <div className="stack">
      <div className="row"><h1 style={{ margin: 0 }}>Projects</h1>
        <div className="chips right"><button className="chip" aria-pressed={!onlyStuck} onClick={() => setOnlyStuck(false)}>All</button><button className="chip" aria-pressed={onlyStuck} onClick={() => setOnlyStuck(true)}>Stuck</button></div></div>
      {rows.length === 0 ? <Empty title={onlyStuck ? 'Nothing is stuck' : 'No projects yet'}>{onlyStuck ? 'Every project has moved recently.' : 'A project starts when a customer pays the advance on a quote.'}</Empty> : (
        <div className="panel scroll" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Customer</th><th>Size</th><th>Stage</th><th className="num">Days in stage</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p._id}>
                <td><Link to={`/staff/projects/${p._id}`}><strong>{p.lead.name}</strong></Link><div className="muted">{p.lead.leadId}</div></td>
                <td>{p.quote?.primaryKw} kW</td>
                <td>{['Advance received', 'Materials dispatched', 'Installation done', 'Net metering applied', 'Net metering approved', 'Subsidy applied', 'Subsidy credited'][p.stageIndex]}</td>
                <td className={`num${p.stuck ? ' stuck' : ''}`}>{last(p) ? 'Complete' : p.daysInStage}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
