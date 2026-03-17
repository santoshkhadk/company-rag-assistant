import { StoreProvider, useStore } from './store';
import Sidebar          from './components/Sidebar';
import Header           from './components/Header';
import ChatPage         from './pages/ChatPage';
import DocumentUpload   from './components/DocumentUpload';
import SettingsPanel    from './components/SettingsPanel';

/* Inner app reads from store */
function AppInner() {
  const { state, dispatch } = useStore();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Left sidebar */}
      <Sidebar />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header />
        <ChatPage />
      </div>

      {/* Modals */}
      {state.uploadOpen && (
        <DocumentUpload onClose={() => dispatch({ type: 'SET_UPLOAD', payload: false })} />
      )}
      {state.settingsOpen && (
        <SettingsPanel onClose={() => dispatch({ type: 'SET_SETTINGS', payload: false })} />
      )}
    </div>
  );
}

/* Wrap with provider */
export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
