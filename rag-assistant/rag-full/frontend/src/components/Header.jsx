import { useStore } from '../store';

export default function Header() {
  const { state, dispatch } = useStore();
  const readyCount = state.documents.filter(d => d.status === 'ready').length;
  const selCount   = state.selectedDocIds.length;

  return (
    <header style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{state.companyName}</span>
        {selCount > 0 ? (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#ede9fe', color: '#7c3aed', fontWeight: 500 }}>
            🔍 {selCount}/{readyCount} docs
          </span>
        ) : readyCount > 0 ? (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>All {readyCount} docs</span>
        ) : null}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: state.groqApiKey ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
          {state.groqApiKey
            ? `⚡ ${state.model.replace('-versatile', '').replace('-instant', ' fast')}`
            : 'No API key'
          }
        </div>
        <button onClick={() => dispatch({ type: 'SET_SETTINGS', payload: true })}
          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
          ⚙️ Settings
        </button>
      </div>
    </header>
  );
}
