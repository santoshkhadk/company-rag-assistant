const BASE = process.env.REACT_APP_API_URL || '/api';

async function req(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  const res  = await fetch(`${BASE}${path}`, { headers, ...opts });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Pull out the first error message Django/DRF returns
    const first = Object.values(data)[0];
    throw new Error(Array.isArray(first) ? first[0] : (first || `HTTP ${res.status}`));
  }
  return data;
}

/* Documents */
export const docsAPI = {
  list:      ()      => req('/documents/'),
  get:       (id)    => req(`/documents/${id}/`),
  chunks:    (id)    => req(`/documents/${id}/chunks/`),
  delete:    (id)    => req(`/documents/${id}/`, { method: 'DELETE' }),
  reprocess: (id)    => req(`/documents/${id}/reprocess/`, { method: 'POST' }),
  upload:    (file, opts = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.name)           fd.append('name',          opts.name);
    if (opts.chunk_size)     fd.append('chunk_size',    String(opts.chunk_size));
    if (opts.chunk_overlap)  fd.append('chunk_overlap', String(opts.chunk_overlap));
    return req('/documents/upload/', { method: 'POST', body: fd });
  },
};

/* Chat */
export const chatAPI = {
  sessions:   ()     => req('/sessions/'),
  getSession: (id)   => req(`/sessions/${id}/`),
  newSession: (title)=> req('/sessions/create/', { method:'POST', body: JSON.stringify({ title }) }),
  delSession: (id)   => req(`/sessions/${id}/`, { method: 'DELETE' }),
  query:      (body) => req('/chat/', { method: 'POST', body: JSON.stringify(body) }),
};

/* Stats */
export const statsAPI = { get: () => req('/stats/') };
