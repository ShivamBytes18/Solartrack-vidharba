import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import { Field } from '../ui.jsx';

export default function Login() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/staff" replace />;
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { signIn(await api.post('/auth/login', f)); nav('/staff'); }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <main className="narrow">
      <h1>Staff sign in</h1>
      <form className="panel" onSubmit={submit}>
        <Field label="Email"><input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {err && <p className="note error" role="alert" style={{ marginTop: '1rem' }}>{err}</p>}
        <button className="btn block" style={{ marginTop: '1.25rem' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
