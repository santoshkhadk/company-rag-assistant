const BASE = process.env.REACT_APP_API_URL || '/api';

async function req(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  const res  = await fetch(`${BASE}${path}`, { headers, ...opts });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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

/* Chat — standard */
export const chatAPI = {
  sessions:   ()     => req('/sessions/'),
  getSession: (id)   => req(`/sessions/${id}/`),
  newSession: (title)=> req('/sessions/create/', { method:'POST', body: JSON.stringify({ title }) }),
  delSession: (id)   => req(`/sessions/${id}/`, { method: 'DELETE' }),
  query:      (body) => req('/chat/', { method: 'POST', body: JSON.stringify(body) }),
};

/* Streaming chat — returns an EventSource-like async generator */
export async function* streamChat(body) {
  const res = await fetch(`${BASE}/chat/stream/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const event = JSON.parse(jsonStr);
          yield event; // { token } or { done, message_id, session_id, sources, model }
        } catch (_) {}
      }
    }
  }
}

/* Feedback */
export const feedbackAPI = {
  submit: (messageId, rating, comment = '') =>
    req(`/messages/${messageId}/feedback/`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    }),
  list: () => req('/feedback/'),
};

/* Dashboard */
export const dashboardAPI = {
  get: () => req('/dashboard/'),
};

/* Stats */
export const statsAPI = { get: () => req('/stats/') };
