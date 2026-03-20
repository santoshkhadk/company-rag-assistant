import { useState } from 'react';
import { useStore } from '../store/store';

const MODELS = [
  ['llama-3.3-70b-versatile', 'Llama 3.3 · 70B',  'Best quality'],
  ['llama-3.1-8b-instant',    'Llama 3.1 · 8B',   'Fastest'],
  ['mixtral-8x7b-32768',      'Mixtral · 8×7B',   'Long context'],
  ['gemma2-9b-it',            'Gemma 2 · 9B',     'Compact'],
];

export default function SettingsPanel({ onClose }) {
  const { state, dispatch } = useStore();
  const [keySaved,  setKeySaved]  = useState(false);
  const [keyInput,  setKeyInput]  = useState(state.groqApiKey);
  const [showKey,   setShowKey]   = useState(false);

  const set = (type, payload) => dispatch({ type, payload });

  const saveKey = () => {
    set('SET_KEY', keyInput.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 3000);
  };

  const clearKey = () => {
    setKeyInput('');
    set('SET_KEY', '');
    setKeySaved(false);
  };

  return (
    <div style={overlay}>
      <div style={modal}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ fontSize:17, fontWeight:600, margin:0 }}>⚙️ Settings</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* API Key */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <label style={labelStyle}>Groq API Key</label>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer"
              style={{ fontSize:11, color:'#6366f1', textDecoration:'none' }}>
              Get free key →
            </a>
          </div>

          {/* Key input row */}
          <div style={{ display:'flex', gap:6 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setKeySaved(false); }}
              placeholder="gsk_..."
              style={{ ...inputStyle, flex:1 }}
            />
            <button onClick={() => setShowKey(!showKey)}
              style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:14 }}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Save / Clear buttons */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={saveKey} disabled={!keyInput.trim()}
              style={{
                padding:'7px 16px', borderRadius:8, border:'none', cursor: keyInput.trim() ? 'pointer' : 'not-allowed',
                background: keySaved ? '#16a34a' : '#4f46e5', color:'#fff', fontSize:13, fontWeight:600, transition:'background .3s',
              }}>
              {keySaved ? '✓ Saved!' : 'Save Key'}
            </button>

            {state.groqApiKey && (
              <button onClick={clearKey}
                style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                × Clear Key
              </button>
            )}
          </div>

          {/* Status messages */}
          {state.groqApiKey && !keySaved && (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#16a34a' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} />
              API key saved — persists across page refreshes
            </div>
          )}
          {!state.groqApiKey && (
            <p style={{ fontSize:11, color:'#f59e0b', margin:0 }}>
              ⚠️ No API key set. Enter your Groq key above.
            </p>
          )}
        </div>

        {/* Company Name */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={labelStyle}>Company / Assistant Name</label>
          <input
            type="text"
            value={state.companyName}
            onChange={e => set('SET_COMPANY', e.target.value)}
            placeholder="Acme Corp"
            style={inputStyle}
          />
          <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>✓ Saved automatically as you type</p>
        </div>

        {/* Model picker */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={labelStyle}>Groq Model</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {MODELS.map(([val, name, desc]) => (
              <div key={val} onClick={() => set('SET_MODEL', val)}
                style={{
                  padding:'10px 12px', borderRadius:8, cursor:'pointer',
                  border: state.model === val ? '2px solid #6366f1' : '1px solid #e5e7eb',
                  background: state.model === val ? '#eef2ff' : '#fff', transition:'all .15s',
                }}>
                <div style={{ fontSize:12, fontWeight:600, color: state.model===val ? '#4f46e5' : '#111' }}>{name}</div>
                <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{desc}</div>
                {state.model === val && (
                  <div style={{ fontSize:10, color:'#6366f1', marginTop:3 }}>✓ Selected & saved</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top-K */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={labelStyle}>Retrieve top {state.topK} chunk{state.topK > 1 ? 's' : ''} per query</label>
          <input type="range" min={1} max={8} step={1} value={state.topK}
            onChange={e => set('SET_TOPK', +e.target.value)}
            style={{ width:'100%', accentColor:'#6366f1' }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
            <span>1 – precise</span><span>8 – broad</span>
          </div>
          <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>✓ Saved automatically</p>
        </div>

        {/* Auto Speak */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fafafa' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>🔊 Auto-speak responses</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>AI reads every answer aloud automatically</div>
          </div>
          <div onClick={() => set('SET_AUTO_SPEAK', !state.autoSpeak)}
            style={{
              width:44, height:24, borderRadius:20, cursor:'pointer', transition:'background .2s',
              background: state.autoSpeak ? '#4f46e5' : '#d1d5db',
              position:'relative', flexShrink:0,
            }}>
            <div style={{
              width:18, height:18, borderRadius:'50%', background:'#fff',
              position:'absolute', top:3, transition:'left .2s',
              left: state.autoSpeak ? 23 : 3,
              boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </div>

        {/* Saved settings summary */}
        <div style={{ padding:'10px 12px', borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:11, color:'#15803d' }}>
          💾 All settings auto-save to your browser. They persist across refreshes and browser restarts.
        </div>

        <button onClick={onClose}
          style={{ padding:'10px 0', borderRadius:8, background:'#4f46e5', color:'#fff', border:'none', fontWeight:600, fontSize:14, cursor:'pointer' }}>
          Close
        </button>
      </div>
    </div>
  );
}

const overlay   = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 };
const modal     = { background:'#fff', borderRadius:14, width:'90%', maxWidth:440, padding:24, display:'flex', flexDirection:'column', gap:16, maxHeight:'90vh', overflowY:'auto' };
const closeBtn  = { background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer', lineHeight:1 };
const labelStyle= { fontSize:12, fontWeight:600, color:'#374151' };
const inputStyle= { padding:'8px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, outline:'none', fontFamily:"'JetBrains Mono', monospace" };
