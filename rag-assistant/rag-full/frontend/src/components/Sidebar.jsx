import { useEffect } from 'react';
import { useStore } from '../store/store';
import { useDocuments, useChat } from '../hooks/useRag';

const EXT_ICON = { pdf: '📄', txt: '📝', docx: '📋', md: '📑', csv: '📊' };
const STATUS_STYLE = {
  ready:      { bg: '#f0fdf4', color: '#16a34a' },
  processing: { bg: '#eff6ff', color: '#3b82f6' },
  error:      { bg: '#fef2f2', color: '#dc2626' },
  pending:    { bg: '#f9fafb', color: '#9ca3af' },
};

export default function Sidebar() {
  const { state, dispatch } = useStore();
  const docs = useDocuments();
  const chat = useChat();

  useEffect(() => { docs.load(); chat.loadSessions(); }, []); // eslint-disable-line

  const tab = state.sidebarTab;

  return (
    <aside style={{ width: 260, flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fafafa', height: '100%', overflow: 'hidden' }}>

      {/* Brand */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 700 }}>R</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>RAG Assistant</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>Powered by Groq</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        {[['docs', '📚 Docs'], ['sessions', '💬 Chats']].map(([t, label]) => (
          <button key={t} onClick={() => dispatch({ type: 'SET_TAB', payload: t })}
            style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: tab === t ? '#6366f1' : '#6b7280', borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 'docs'
          ? <DocsTab docs={docs} dispatch={dispatch} />
          : <ChatsTab chat={chat} />
        }
      </div>
    </aside>
  );
}

/* ─── Docs tab ──────────────────────────────── */
function DocsTab({ docs, dispatch }) {
  const { documents, loading, selectedDocIds, toggleDoc, selAll, selNone, remove, reprocess } = docs;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => dispatch({ type: 'SET_UPLOAD', payload: true })}
          style={{ padding: '5px 12px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Upload
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn onClick={selAll}>All</Btn>
          <Btn onClick={selNone}>None</Btn>
        </div>
      </div>

      {selectedDocIds.length > 0 && (
        <div style={{ fontSize: 11, background: '#eef2ff', color: '#6366f1', padding: '4px 10px', borderRadius: 6, textAlign: 'center', fontWeight: 500 }}>
          {selectedDocIds.length} doc{selectedDocIds.length > 1 ? 's' : ''} active for RAG
        </div>
      )}

      {loading && <p style={empty}><span className="spinner" /></p>}
      {!loading && documents.length === 0 && <p style={empty}>No documents yet.<br />Upload a file to start.</p>}

      {documents.map(doc => {
        const ext = doc.file_type || 'txt';
        const sc  = STATUS_STYLE[doc.status] || STATUS_STYLE.pending;
        const sel = selectedDocIds.includes(doc.id);
        return (
          <div key={doc.id} style={{ borderRadius: 8, border: `1px solid ${sel ? '#a5b4fc' : '#e5e7eb'}`, background: sel ? '#eef2ff' : '#fff', padding: '8px 10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginBottom: 5 }}>
              <input type="checkbox" checked={sel} disabled={doc.status !== 'ready'} onChange={() => toggleDoc(doc.id)} style={{ accentColor: '#6366f1' }} />
              <span style={{ fontSize: 15 }}>{EXT_ICON[ext] || '📄'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>{doc.name}</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>{doc.status}</span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{doc.chunk_count} chunks · {doc.file_size_display}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {doc.status === 'error' && (
                  <button onClick={() => reprocess(doc.id)} title="Retry" style={iconBtn}>🔄</button>
                )}
                <button onClick={() => { if (window.confirm(`Delete "${doc.name}"?`)) remove(doc.id); }} title="Delete" style={{ ...iconBtn, color: '#fca5a5' }}>🗑</button>
              </div>
            </div>
          </div>
        );
      })}

      {documents.some(d => d.status === 'ready') && selectedDocIds.length === 0 && (
        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
          💡 Check docs to restrict RAG search,<br />or leave all unchecked to use all docs.
        </p>
      )}
    </>
  );
}

/* ─── Chats tab ─────────────────────────────── */
function ChatsTab({ chat }) {
  const { sessions, activeSessionId, newChat, openSession, delSession } = chat;
  return (
    <>
      <button onClick={newChat}
        style={{ padding: '7px 0', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
        + New Chat
      </button>
      {sessions.length === 0 && <p style={empty}>No chats yet.</p>}
      {sessions.map(s => (
        <div key={s.id} onClick={() => openSession(s.id)}
          style={{ padding: '9px 10px', paddingRight: 28, borderRadius: 8, border: `1px solid ${s.id === activeSessionId ? '#a5b4fc' : '#e5e7eb'}`, background: s.id === activeSessionId ? '#eef2ff' : '#fff', cursor: 'pointer', position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{s.title}</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{s.message_count} messages</div>
          <button onClick={e => { e.stopPropagation(); if (window.confirm('Delete chat?')) delSession(s.id); }}
            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      ))}
    </>
  );
}

const Btn = ({ onClick, children }) => (
  <button onClick={onClick} style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#6b7280' }}>{children}</button>
);
const empty   = { textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: '20px 8px', lineHeight: 1.7 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2, color: '#9ca3af' };
