import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { session } from './api.js';
import { Auth, useAuth } from './auth.js';
import Home from './pages/Home.jsx';
import Apply from './pages/Apply.jsx';
import Confirm from './pages/Confirm.jsx';
import Result from './pages/Result.jsx';
import Status from './pages/Status.jsx';
import Login from './pages/Login.jsx';
import Leads from './pages/Leads.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import QuoteView from './pages/QuoteView.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Admin from './pages/Admin.jsx';

const Brand = ({ to = '/' }) => <Link className="brand" to={to}><i /> Company A Solar</Link>;

function PublicShell() {
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Brand />
          <nav className="right" aria-label="Main">
            <NavLink to="/staff/login">Staff sign in</NavLink>
            <Link className="btn small" to="/check">Check my home</Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </>
  );
}

function StaffShell() {
  const { user, signOut } = useAuth();
  if (!user) return <Navigate to="/staff/login" replace />;
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Brand to="/staff" />
          <nav aria-label="Main">
            <NavLink to="/staff" end>Leads</NavLink>
            <NavLink to="/staff/projects">Projects</NavLink>
            {user.role === 'admin' && <NavLink to="/staff/rules">Rules</NavLink>}
          </nav>
          <span className="right muted">{user.name}</span>
          <button className="btn ghost small" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(() => session.get()?.user || null);
  const navigate = useNavigate();
  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener('signed-out', out);
    return () => window.removeEventListener('signed-out', out);
  }, []);
  const value = {
    user,
    signIn: (data) => { session.set(data); setUser(data.user); },
    signOut: () => { session.clear(); setUser(null); navigate('/staff/login'); },
  };
  return (
    <Auth.Provider value={value}>
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/check" element={<Apply />} />
          <Route path="/check/:token" element={<Confirm />} />
          <Route path="/check/:token/result" element={<Result />} />
          <Route path="/s/:token" element={<Status />} />
          <Route path="/staff/login" element={<Login />} />
        </Route>
        <Route path="/staff" element={<StaffShell />}>
          <Route index element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="quotes/:id" element={<QuoteView />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="rules" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/staff" replace />} />
        </Route>
        <Route path="*" element={<main className="narrow"><h1>Page not found</h1><Link to="/">Go to the start</Link></main>} />
      </Routes>
    </Auth.Provider>
  );
}
