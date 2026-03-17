/* Renders one chat bubble with inline markdown and source chips */

const EXT_ICON = { pdf: '📄', txt: '📝', docx: '📋', md: '📑', csv: '📊' };

/* Minimal markdown → HTML (no external lib needed) */
function md(text) {
  return text
    .replace(/```([\s\S]*?)```/g, (_, c) =>
      `<pre style="background:#1e1e2e;color:#cdd6f4;padding:12px 14px;border-radius:8px;overflow-x:auto;font-size:12px;margin:8px 0;font-family:'JetBrains Mono',monospace;white-space:pre-wrap">${esc(c.replace(/^\w+\n/, ''))}</pre>`)
    .replace(/`([^`]+)`/g, (_, c) =>
      `<code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:12px;font-family:'JetBrains Mono',monospace">${esc(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/^### (.+)/gm,   '<h3 style="font-size:13px;font-weight:600;margin:10px 0 4px">$1</h3>')
    .replace(/^## (.+)/gm,    '<h2 style="font-size:14px;font-weight:600;margin:10px 0 4px">$1</h2>')
    .replace(/^# (.+)/gm,     '<h1 style="font-size:16px;font-weight:700;margin:10px 0 6px">$1</h1>')
    .replace(/^[-*] (.+)/gm,  '<li style="margin:3px 0;padding-left:4px">$1</li>')
    .replace(/(<li[\s\S]+?<\/li>\n?)+/g, m => `<ul style="padding-left:20px;margin:6px 0">${m}</ul>`)
    .replace(/\n{2,}/g,        '</p><p style="margin:6px 0">')
    .replace(/\n/g,            '<br/>');
}
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* Typing indicator */
export function TypingBubble() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Avatar role="assistant" />
      <div style={{ ...bubble, padding: '13px 16px' }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span className="dot" /><span className="dot" /><span className="dot" />
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>Thinking…</span>
        </div>
      </div>
    </div>
  );
}

/* Main component */
export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <Avatar role={message.role} />

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: isUser ? 'flex-end' : 'flex-start' }}>

        {/* Bubble */}
        <div style={{
          ...bubble,
          background:   isUser ? '#4f46e5' : '#fff',
          color:        isUser ? '#fff'    : '#111827',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          border:       isUser ? '1px solid #4f46e5' : '1px solid #e5e7eb',
        }}>
          {isUser
            ? <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
            : <div style={{ lineHeight: 1.65, wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: `<p style="margin:0">${md(message.content)}</p>` }} />
          }
        </div>

        {/* Source chips */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {message.sources.map((src, i) => {
              const ext = (src.document_name || '').split('.').pop().toLowerCase();
              return (
                <span key={i} title={`Score: ${src.score} · Chunk #${src.chunk_index}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, background: '#f5f3ff', border: '1px solid #e0e7ff', fontSize: 11, color: '#6d28d9', cursor: 'help' }}>
                  {EXT_ICON[ext] || '📄'} {src.document_name}
                  <span style={{ color: '#a78bfa', fontSize: 10 }}>{Math.round(src.score * 100)}%</span>
                </span>
              );
            })}
            <span style={{ fontSize: 10, background: '#ede9fe', color: '#7c3aed', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
              RAG · {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Model badge */}
        {!isUser && message.model_used && (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>
            ⚡ {message.model_used.replace('-versatile','').replace('-instant',' fast')}
          </span>
        )}
      </div>
    </div>
  );
}

function Avatar({ role }) {
  const isUser = role === 'user';
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700,
      background: isUser ? '#ddd6fe' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      color:      isUser ? '#6d28d9' : '#fff',
    }}>
      {isUser ? 'U' : 'AI'}
    </div>
  );
}

const bubble = { padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.6 };
