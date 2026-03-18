import { useStore } from '../store/store';

const MODELS = [
  ['llama-3.3-70b-versatile', 'Llama 3.3 · 70B',  'Best quality'],
  ['llama-3.1-8b-instant',    'Llama 3.1 · 8B',   'Fastest'],
  ['mixtral-8x7b-32768',      'Mixtral · 8×7B',   'Long context'],
  ['gemma2-9b-it',            'Gemma 2 · 9B',     'Compact'],
];

export default function SettingsPanel({ onClose }) {
  const { state, dispatch } = useStore();
  const set = (type, payload) => dispatch({ type, payload });

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={row}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* API Key */}
        <Field label="Groq API Key"
          hint={<a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#6366f1' }}>Get free key →</a>}>
          <input
            type="password"
            value={state.groqApiKey}
            onChange={e => set('SET_KEY', e.target.value)}
            placeholder="gsk_..."
            style={input}
          />
        </Field>

        {/* Company */}
        <Field label="Company / Assistant Name">
          <input
            type="text"
            value={state.companyName}
            onChange={e => set('SET_COMPANY', e.target.value)}
            placeholder="Acme Corp"
            style={input}
          />
        </Field>

        {/* Model picker */}
        <Field label="Groq Model">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MODELS.map(([val, name, desc]) => (
              <div key={val} onClick={() => set('SET_MODEL', val)}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: state.model === val ? '2px solid #6366f1' : '1px solid #e5e7eb',
                  background: state.model === val ? '#eef2ff' : '#fff', transition: 'all .15s',
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: state.model === val ? '#4f46e5' : '#111' }}>{name}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{desc}</div>
              </div>
            ))}
          </div>
        </Field>

        {/* Top-K */}
        <Field label={`Retrieve top ${state.topK} chunk${state.topK > 1 ? 's' : ''} per query`}>
          <input type="range" min={1} max={8} step={1} value={state.topK}
            onChange={e => set('SET_TOPK', +e.target.value)}
            style={{ width: '100%', accentColor: '#6366f1' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
            <span>1 – precise</span><span>8 – broad</span>
          </div>
        </Field>

        <button onClick={onClose}
          style={{ padding: '10px 0', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>
          Save &amp; Close
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</label>
        {hint}
      </div>
      {children}
    </div>
  );
}

const overlay  = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 };
const modal    = { background: '#fff', borderRadius: 14, width: '90%', maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '90vh', overflowY: 'auto' };
const row      = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeBtn = { background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 };
const input    = { padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, width: '100%', outline: 'none', fontFamily: "'JetBrains Mono', monospace" };
