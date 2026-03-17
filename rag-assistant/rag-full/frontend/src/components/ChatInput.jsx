import { useState, useRef } from 'react';

const SUGGESTIONS = [
  'What are our main products?',
  'Explain the refund policy',
  'What is the leave policy?',
  'How do I contact support?',
  'Summarize the security policy',
];

export default function ChatInput({ onSend, loading, disabled, hasMessages }) {
  const [text, setText] = useState('');
  const ref = useRef();

  const submit = () => {
    const q = text.trim();
    if (!q || loading || disabled) return;
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
    onSend(q);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const resize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const canSend = text.trim() && !loading && !disabled;

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>

      {/* Suggestion chips — shown on empty chat */}
      {!hasMessages && !disabled && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => onSend(s)} disabled={loading}
              style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e0e7ff', background: '#f5f3ff', color: '#6d28d9', fontSize: 12, cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Text row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={ref}
          value={text}
          onChange={e => { setText(e.target.value); resize(e); }}
          onKeyDown={onKey}
          placeholder={disabled ? 'Enter your Groq API key in Settings ⚙️' : 'Ask a question… (Enter to send, Shift+Enter for newline)'}
          disabled={loading || disabled}
          rows={1}
          style={{
            flex: 1, resize: 'none', padding: '10px 14px', borderRadius: 12,
            border: '1px solid #d1d5db', fontSize: 14, lineHeight: 1.5,
            fontFamily: 'inherit', outline: 'none', maxHeight: 140,
            background: disabled ? '#f9fafb' : '#fff', transition: 'border-color .15s',
          }}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e  => e.target.style.borderColor = '#d1d5db'}
        />
        <button onClick={submit} disabled={!canSend}
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: canSend ? '#4f46e5' : '#e0e7ff',
            color:      canSend ? '#fff'    : '#a5b4fc',
            fontSize: 18, cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
          }}>
          {loading ? <span className="spinner" /> : '↑'}
        </button>
      </div>
    </div>
  );
}
