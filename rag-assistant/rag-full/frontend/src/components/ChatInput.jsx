import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  'What are our main products?',
  'Explain the refund policy',
  'What is the leave policy?',
  'How do I contact support?',
  'Summarize the security policy',
];

export default function ChatInput({ onSend, loading, disabled, hasMessages }) {
  const [text,      setText]      = useState('');
  const [listening, setListening] = useState(false);
  const [transcript,setTranscript]= useState('');
  const [voiceSupported, setVS]   = useState(false);
  const textareaRef    = useRef();
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setVS(true);
    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(interim);
      if (final) {
        setText(prev => (prev + ' ' + final).trim());
        setTranscript('');
      }
    };
    rec.onend   = () => { setListening(false); setTranscript(''); };
    rec.onerror = () => { setListening(false); setTranscript(''); };
    recognitionRef.current = rec;
    return () => rec.abort();
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setText(''); setTranscript('');
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const submit = () => {
    const q = text.trim();
    if (!q || loading || disabled) return;
    setText(''); setTranscript('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(q);
  };

  const onKey  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };
  const resize = (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; };
  const canSend = text.trim() && !loading && !disabled;

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>

      {/* Suggestion chips */}
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

      {/* Live transcript */}
      {listening && (
        <div style={{ marginBottom: 8, padding: '6px 12px', borderRadius: 8, background: transcript ? '#f0fdf4' : '#fef2f2', border: `1px solid ${transcript ? '#bbf7d0' : '#fecaca'}`, fontSize: 13, color: transcript ? '#15803d' : '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'dot-pulse 1s ease-in-out infinite', flexShrink: 0 }} />
          {transcript ? `${transcript}…` : 'Listening… speak now'}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e); }}
          onKeyDown={onKey}
          placeholder={disabled ? 'Enter your Groq API key in Settings ⚙️' : listening ? 'Listening… speak your question' : 'Ask a question… (Enter to send)'}
          disabled={loading || disabled}
          rows={1}
          style={{
            flex: 1, resize: 'none', padding: '10px 14px', borderRadius: 12,
            border: `1px solid ${listening ? '#6366f1' : '#d1d5db'}`,
            fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none',
            maxHeight: 140, background: disabled ? '#f9fafb' : '#fff', transition: 'border-color .15s',
          }}
        />

        {/* Mic button */}
        {voiceSupported && (
          <button onClick={toggleVoice} disabled={disabled || loading}
            title={listening ? 'Stop' : 'Voice input'}
            style={{
              width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: listening ? '#dc2626' : '#f3f4f6',
              color: listening ? '#fff' : '#6b7280',
              fontSize: 18, cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: listening ? '0 0 0 4px rgba(220,38,38,0.2)' : 'none',
              transition: 'all .2s',
            }}>
            {listening ? '⏹' : '🎤'}
          </button>
        )}

        {/* Send button */}
        <button onClick={submit} disabled={!canSend}
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: canSend ? '#4f46e5' : '#e0e7ff',
            color: canSend ? '#fff' : '#a5b4fc',
            fontSize: 18, cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
          }}>
          {loading ? <span className="spinner" /> : '↑'}
        </button>
      </div>

      {!voiceSupported && (
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' }}>
          🎤 Voice input requires Chrome or Edge browser
        </p>
      )}

      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}