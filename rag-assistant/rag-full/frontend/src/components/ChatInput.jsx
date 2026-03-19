import { useState, useRef, useEffect, useCallback } from 'react';

const SUGGESTIONS = [
  'What are our main products?',
  'Explain the refund policy',
  'What is the leave policy?',
  'How do I contact support?',
  'Summarize the security policy',
];

const WAKE_WORDS  = ['activate agent', 'hey agent', 'ok agent', 'wake up'];
const SLEEP_WORDS = ['deactivate agent', 'stop agent', 'sleep agent', 'goodbye agent'];

export default function ChatInput({ onSend, loading, disabled, hasMessages }) {
  const [text,           setText]        = useState('');
  const [transcript,     setTranscript]  = useState('');
  const [voiceSupported, setVoiceSupp]   = useState(false);
  const [wakeEnabled,    setWakeEnabled] = useState(false); // eye button on/off
  const [agentActive,    setAgentActive] = useState(false); // after wake word spoken
  const [listening,      setListening]   = useState(false); // command mic active

  const textareaRef   = useRef();
  const wakeRecRef    = useRef(null);
  const cmdRecRef     = useRef(null);
  const wakeEnabled_  = useRef(false); // ref mirror for use inside callbacks
  const agentActive_  = useRef(false);

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  // ── Check support ─────────────────────────────────────────
  useEffect(() => {
    if (SR) setVoiceSupp(true);
    return () => {
      stopWakeListener();
      stopCommandListener();
    };
  }, []); // eslint-disable-line

  // ── Keep refs in sync with state ─────────────────────────
  useEffect(() => { wakeEnabled_.current = wakeEnabled; }, [wakeEnabled]);
  useEffect(() => { agentActive_.current = agentActive; }, [agentActive]);

  // ── Stop helpers ──────────────────────────────────────────
  const stopWakeListener = () => {
    if (wakeRecRef.current) {
      try { wakeRecRef.current.abort(); } catch(_) {}
      wakeRecRef.current = null;
    }
  };

  const stopCommandListener = () => {
    if (cmdRecRef.current) {
      try { cmdRecRef.current.abort(); } catch(_) {}
      cmdRecRef.current = null;
    }
    setListening(false);
    setTranscript('');
  };

  // ── Wake word listener (always-on background) ─────────────
  const startWakeListener = useCallback(() => {
    if (!SR || wakeRecRef.current) return;

    const rec        = new SR();
    rec.continuous     = true;
    rec.interimResults = false;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const said = e.results[i][0].transcript.toLowerCase().trim();
        console.log('Wake listener heard:', said);

        if (WAKE_WORDS.some(w => said.includes(w))) {
          // Activate agent
          setAgentActive(true);
          agentActive_.current = true;
          startCommandListener();
        }
      }
    };

    rec.onend = () => {
      wakeRecRef.current = null;
      // Only restart if wake is still enabled and agent is NOT active
      if (wakeEnabled_.current && !agentActive_.current) {
        setTimeout(() => startWakeListener(), 500);
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      wakeRecRef.current = null;
      if (wakeEnabled_.current && !agentActive_.current) {
        setTimeout(() => startWakeListener(), 1000);
      }
    };

    try {
      rec.start();
      wakeRecRef.current = rec;
    } catch(_) {}
  }, [SR]); // eslint-disable-line

  // ── Command listener (after wake word) ───────────────────
  const startCommandListener = useCallback(() => {
    if (!SR) return;
    stopCommandListener();

    const rec        = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = 'en-US';
    setListening(true);

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }

      setTranscript(interim);

      if (final) {
        const said = final.toLowerCase().trim();
        console.log('Command heard:', said);

        // Check sleep command
        if (SLEEP_WORDS.some(w => said.includes(w))) {
          console.log('Sleep command detected — deactivating agent');
          setAgentActive(false);
          agentActive_.current = false;
          setListening(false);
          setTranscript('');
          setText('');
          cmdRecRef.current = null;
          // Restart wake listener
          setTimeout(() => {
            if (wakeEnabled_.current) startWakeListener();
          }, 500);
          return;
        }

        // Normal command — set text
        setText(prev => (prev + ' ' + final).trim());
        setTranscript('');
      }
    };

    rec.onend = () => {
      cmdRecRef.current = null;
      setListening(false);
      setTranscript('');

      // Auto-submit captured text
      setText(prev => {
        if (prev.trim() && agentActive_.current) {
          setTimeout(() => {
            onSend(prev.trim());
            setText('');
            // After submitting, deactivate — user must say wake word again
            setAgentActive(false);
            agentActive_.current = false;
            // Restart wake listener
            if (wakeEnabled_.current) {
              setTimeout(() => startWakeListener(), 800);
            }
          }, 200);
        }
        return prev;
      });
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      cmdRecRef.current = null;
      setListening(false);
      setTranscript('');
      setAgentActive(false);
      agentActive_.current = false;
    };

    try {
      rec.start();
      cmdRecRef.current = rec;
    } catch(_) {}
  }, [SR, onSend, startWakeListener]); // eslint-disable-line

  // ── Toggle wake word feature ──────────────────────────────
  const toggleWakeWord = () => {
    if (wakeEnabled) {
      // Turn OFF everything
      setWakeEnabled(false);
      wakeEnabled_.current = false;
      setAgentActive(false);
      agentActive_.current = false;
      stopWakeListener();
      stopCommandListener();
    } else {
      // Turn ON
      setWakeEnabled(true);
      wakeEnabled_.current = true;
      startWakeListener();
    }
  };

  // ── Manual mic toggle ─────────────────────────────────────
  const toggleManualMic = () => {
    if (listening) {
      stopCommandListener();
    } else {
      startCommandListener();
    }
  };

  // ── Submit ────────────────────────────────────────────────
  const submit = () => {
    const q = text.trim();
    if (!q || loading || disabled) return;
    setText('');
    setTranscript('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    onSend(q);
  };

  const onKey  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };
  const resize = (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; };
  const canSend = text.trim() && !loading && !disabled;

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>

      {/* Status bar */}
      {wakeEnabled && (
        <div style={{
          marginBottom: 8, padding: '6px 12px', borderRadius: 8, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
          background: agentActive ? '#f0fdf4' : '#eff6ff',
          border:     agentActive ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
          color:      agentActive ? '#15803d' : '#1d4ed8',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: agentActive ? '#22c55e' : '#3b82f6', display: 'inline-block', animation: 'statusPulse 1.5s ease-in-out infinite' }} />
          {agentActive
            ? '🎤 Agent active — speak your command. Say "deactivate agent" to stop.'
            : '👂 Waiting for "activate agent"…'
          }
        </div>
      )}

      {/* Live transcript */}
      {listening && transcript && (
        <div style={{ marginBottom: 8, padding: '6px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#15803d', fontStyle: 'italic' }}>
          🎤 {transcript}…
        </div>
      )}

      {/* Listening pulse */}
      {listening && !transcript && (
        <div style={{ marginBottom: 8, padding: '6px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'statusPulse 1s ease-in-out infinite' }} />
          Listening…
        </div>
      )}

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

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); resize(e); }}
          onKeyDown={onKey}
          placeholder={
            disabled      ? 'Enter your Groq API key in Settings ⚙️' :
            listening     ? 'Listening… speak your command' :
            wakeEnabled   ? 'Say "activate agent" to use voice, or type here…' :
            'Ask a question… (Enter to send)'
          }
          disabled={loading || disabled}
          rows={1}
          style={{
            flex: 1, resize: 'none', padding: '10px 14px', borderRadius: 12,
            border: `1px solid ${listening ? '#6366f1' : '#d1d5db'}`,
            fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none',
            maxHeight: 140, background: disabled ? '#f9fafb' : '#fff', transition: 'border-color .15s',
          }}
        />

        {/* Wake word toggle button */}
        {voiceSupported && (
          <button onClick={toggleWakeWord} disabled={disabled || loading}
            title={wakeEnabled ? 'Disable wake word (currently ON)' : 'Enable wake word — say "activate agent"'}
            style={{
              width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: wakeEnabled ? '#4f46e5' : '#f3f4f6',
              color:      wakeEnabled ? '#fff'    : '#6b7280',
              fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: wakeEnabled ? '0 0 0 3px rgba(99,102,241,0.25)' : 'none',
              transition: 'all .2s',
            }}>
            👁️
          </button>
        )}

        {/* Manual mic */}
        {voiceSupported && (
          <button onClick={toggleManualMic} disabled={disabled || loading}
            title={listening ? 'Stop listening' : 'Click to speak'}
            style={{
              width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: listening ? '#dc2626' : '#f3f4f6',
              color:      listening ? '#fff'    : '#6b7280',
              fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: listening ? '0 0 0 4px rgba(220,38,38,0.2)' : 'none',
              transition: 'all .2s',
            }}>
            {listening ? '⏹' : '🎤'}
          </button>
        )}

        {/* Send */}
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

      {/* Hint */}
      {voiceSupported && !wakeEnabled && (
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'center' }}>
          👁️ Click eye to enable wake word · 🎤 Click mic to speak manually
        </p>
      )}

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}