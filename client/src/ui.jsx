import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export const money = (n) => (n == null ? 'n/a' : `₹${Math.round(n).toLocaleString('en-IN')}`);
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    set((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => set({ data, error: null, loading: false })).catch((error) => set({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}

/** Fetch a protected file as a blob URL (images cannot send auth headers). */
export function useBlobUrl(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!path) return undefined;
    let made;
    api.blob(path).then((b) => { made = URL.createObjectURL(b); setUrl(made); }).catch(() => setUrl(null));
    return () => made && URL.revokeObjectURL(made);
  }, [path]);
  return url;
}

export async function openFile(path, filename) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  if (filename) { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); }
  else window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const Spinner = ({ label = 'Loading' }) => <div className="center muted" role="status"><span className="spinner" aria-hidden /> {label}</div>;
export const ErrorNote = ({ error, retry }) => (
  <div className="note error" role="alert">
    <p>{error?.message || 'Something went wrong.'}</p>
    {retry && <button className="btn ghost" onClick={retry}>Try again</button>}
  </div>
);
export const Empty = ({ title, children }) => <div className="empty"><h3>{title}</h3><p className="muted">{children}</p></div>;

export const ScoreBadge = ({ label }) => (label ? <span className={`badge ${label.toLowerCase()}`}>{label}</span> : <span className="badge none">Not scored</span>);

export function Field({ label, hint, error, flag, children }) {
  return (
    <label className={`field${error ? ' has-error' : ''}${flag ? ' flagged' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {flag && <span className="hint warn">Please check this one</span>}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="hint err">{error}</span>}
    </label>
  );
}

export function CopyButton({ text, children = 'Copy link' }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn ghost" type="button" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); })}>
      {done ? 'Copied' : children}
    </button>
  );
}
