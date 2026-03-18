import { StoreProvider, useStore } from './store/store';
import Sidebar          from './components/Sidebar';
import Header           from './components/Header';
import ChatPage         from './pages/ChatPage';
import DocumentUpload   from './components/DocumentUpload';
import SettingsPanel    from './components/SettingsPanel';
import DashboardPage    from './pages/DashboardPage';

function AppInner() {
  const { state, dispatch } = useStore();
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Header />
        <ChatPage />
      </div>

      {state.uploadOpen && (
        <DocumentUpload onClose={() => dispatch({ type:'SET_UPLOAD', payload:false })} />
      )}
      {state.settingsOpen && (
        <SettingsPanel onClose={() => dispatch({ type:'SET_SETTINGS', payload:false })} />
      )}
      {state.showDashboard && (
        <DashboardPage onClose={() => dispatch({ type:'SET_DASHBOARD', payload:false })} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
