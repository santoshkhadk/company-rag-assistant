import { useEffect, useState } from 'react';
import { dashboardAPI } from '../services/api';

export default function DashboardPage({ onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [tab,     setTab]     = useState('overview');

  useEffect(() => {
    dashboardAPI.get()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
          <span className="spinner" style={{ width:32, height:32, borderWidth:3 }} />
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={overlay}>
      <div style={modal}>
        <p style={{ color:'#dc2626', padding:20 }}>Error loading dashboard: {error}</p>
        <button onClick={onClose} style={closeStyle}>Close</button>
      </div>
    </div>
  );

  const { documents, chats, feedback } = data;

  return (
    <div style={overlay}>
      <div style={{ ...modal, maxWidth:860, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>📊 Dashboard</h2>
            <p style={{ fontSize:12, color:'#9ca3af', margin:0, marginTop:2 }}>Analytics & insights for your RAG assistant</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #e5e7eb', paddingBottom:0 }}>
          {[['overview','📈 Overview'],['documents','📚 Documents'],['feedback','💬 Feedback']].map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontSize:13, fontWeight:500, color: tab===t ? '#6366f1' : '#6b7280', borderBottom: tab===t ? '2px solid #6366f1' : '2px solid transparent', marginBottom:-1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Top stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                ['📄', 'Documents', documents.ready, 'ready'],
                ['🔤', 'Chunks', documents.total_chunks, 'indexed'],
                ['💬', 'Chats', chats.total_sessions, 'sessions'],
                ['❓', 'Questions', chats.user_messages, 'asked'],
              ].map(([icon, label, val, sub]) => (
                <div key={label} style={card}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:'#111' }}>{val}</div>
                  <div style={{ fontSize:12, fontWeight:500, color:'#374151' }}>{label}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Activity this week */}
            <div style={card}>
              <h3 style={cardTitle}>📅 Activity (last 7 days)</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                {[
                  ['Sessions today', chats.sessions_today],
                  ['Sessions this week', chats.sessions_week],
                  ['Messages this week', chats.messages_week],
                ].map(([label, val]) => (
                  <div key={label} style={{ textAlign:'center', padding:'10px', background:'#f9fafb', borderRadius:8 }}>
                    <div style={{ fontSize:20, fontWeight:700, color:'#4f46e5' }}>{val}</div>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Mini bar chart */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80 }}>
                {chats.daily_counts.map((d, i) => {
                  const max = Math.max(...chats.daily_counts.map(x => x.count), 1);
                  const h   = Math.max((d.count / max) * 70, d.count > 0 ? 4 : 2);
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:9, color:'#9ca3af' }}>{d.count}</span>
                      <div style={{ width:'100%', height:h, background: d.count > 0 ? '#6366f1' : '#e5e7eb', borderRadius:3, transition:'height .3s' }} title={`${d.date}: ${d.count} questions`} />
                      <span style={{ fontSize:9, color:'#9ca3af' }}>{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Satisfaction */}
            <div style={card}>
              <h3 style={cardTitle}>⭐ User Satisfaction</h3>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:40, fontWeight:700, color: feedback.satisfaction >= 70 ? '#16a34a' : feedback.satisfaction >= 40 ? '#d97706' : '#dc2626' }}>
                  {feedback.satisfaction}%
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ height:10, borderRadius:10, background:'#f3f4f6', overflow:'hidden', marginBottom:8 }}>
                    <div style={{ height:'100%', width:`${feedback.satisfaction}%`, background: feedback.satisfaction >= 70 ? '#22c55e' : feedback.satisfaction >= 40 ? '#f59e0b' : '#ef4444', borderRadius:10, transition:'width .5s' }} />
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:12 }}>
                    <span style={{ color:'#16a34a' }}>👍 {feedback.thumbs_up} helpful</span>
                    <span style={{ color:'#dc2626' }}>👎 {feedback.thumbs_down} not helpful</span>
                  </div>
                </div>
              </div>
              {feedback.thumbs_up + feedback.thumbs_down === 0 && (
                <p style={{ fontSize:12, color:'#9ca3af', marginTop:8 }}>No feedback received yet. Users can rate answers with 👍/👎.</p>
              )}
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {tab === 'documents' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[['Total', documents.total],['Ready', documents.ready],['Errors', documents.error]].map(([l,v]) => (
                <div key={l} style={card}>
                  <div style={{ fontSize:22, fontWeight:700 }}>{v}</div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <h3 style={cardTitle}>📊 File Types</h3>
              {documents.by_type.map(t => (
                <div key={t.file_type} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:12, width:40, color:'#6b7280' }}>.{t.file_type}</span>
                  <div style={{ flex:1, height:8, background:'#f3f4f6', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(t.count/documents.total)*100}%`, background:'#6366f1', borderRadius:10 }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, width:20, textAlign:'right' }}>{t.count}</span>
                </div>
              ))}
            </div>

            <div style={card}>
              <h3 style={cardTitle}>🕐 Recent Uploads</h3>
              {documents.recent.map(doc => (
                <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <span>📄</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{doc.name}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>{doc.chunk_count} chunks · {doc.file_type}</div>
                  </div>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: doc.status==='ready'?'#f0fdf4':'#fef2f2', color: doc.status==='ready'?'#16a34a':'#dc2626' }}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FEEDBACK TAB */}
        {tab === 'feedback' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {[
                ['👍 Helpful', feedback.thumbs_up, '#f0fdf4', '#16a34a'],
                ['👎 Not Helpful', feedback.thumbs_down, '#fef2f2', '#dc2626'],
                ['⭐ Satisfaction', `${feedback.satisfaction}%`, '#eef2ff', '#6366f1'],
              ].map(([l,v,bg,col]) => (
                <div key={l} style={{ ...card, background: bg, border: `1px solid ${col}22` }}>
                  <div style={{ fontSize:22, fontWeight:700, color:col }}>{v}</div>
                  <div style={{ fontSize:12, color:col }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <h3 style={cardTitle}>💬 Recent Feedback</h3>
              {feedback.recent.length === 0 && (
                <p style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'20px 0' }}>No feedback yet. Answers can be rated with 👍 or 👎.</p>
              )}
              {[...feedback.recent].reverse().map((fb, i) => (
                <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:16 }}>{fb.rating==='up' ? '👍' : '👎'}</span>
                    <span style={{ fontSize:11, color:'#9ca3af' }}>{fb.created_at?.slice(0,10)}</span>
                  </div>
                  <p style={{ fontSize:13, color:'#374151', margin:0, lineHeight:1.5 }}>{fb.content}…</p>
                  {fb.comment && <p style={{ fontSize:12, color:'#6b7280', margin:'4px 0 0', fontStyle:'italic' }}>"{fb.comment}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const overlay   = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 };
const modal     = { background:'#fff', borderRadius:14, width:'95%', padding:24, display:'flex', flexDirection:'column', gap:0 };
const card      = { padding:'16px', borderRadius:10, border:'1px solid #e5e7eb', background:'#fff' };
const cardTitle = { fontSize:14, fontWeight:600, margin:'0 0 12px' };
const closeStyle = { padding:'8px 20px', borderRadius:8, background:'#f3f4f6', border:'none', cursor:'pointer' };
