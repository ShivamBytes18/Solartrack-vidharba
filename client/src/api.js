const KEY = 'solar_session';
export const session = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set: (s) => localStorage.setItem(KEY, JSON.stringify(s)),
  clear: () => localStorage.removeItem(KEY),
};

async function request(path, { method = 'GET', body, form, blob } = {}) {
  const headers = {};
  const s = session.get();
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(`/api${path}`, { method, headers, body: payload }); }
  catch { throw Object.assign(new Error('No connection. Check your network and try again.'), { offline: true }); }
  if (res.ok) return blob ? res.blob() : res.json();
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && s?.token) { session.clear(); window.dispatchEvent(new Event('signed-out')); }
  throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, fields: data.fields || {} });
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, form) => request(p, { method: 'POST', form }),
  blob: (p) => request(p, { blob: true }),
};
