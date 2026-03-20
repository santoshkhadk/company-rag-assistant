import { createContext, useContext, useReducer } from 'react';

const init = {
  // Load saved key from localStorage on startup
  groqApiKey:   localStorage.getItem('groq_api_key') || '',
  model:        localStorage.getItem('groq_model')   || 'llama-3.3-70b-versatile',
  topK:         Number(localStorage.getItem('groq_topk')) || 3,
  companyName:  localStorage.getItem('company_name') || 'Our Company',

  documents:    [],
  docsLoading:  false,
  docsError:    null,
  selectedDocIds: [],
  sessions:        [],
  activeSessionId: null,
  messages:        [],
  chatLoading:     false,
  chatError:       null,
  uploadOpen:      false,
  settingsOpen:    false,
  sidebarTab:      'docs',
  showDashboard:   false,
  autoSpeak:       localStorage.getItem('auto_speak') === 'true',
};

function reducer(state, { type, payload }) {
  switch (type) {

    case 'SET_KEY': {
      if (payload) localStorage.setItem('groq_api_key', payload);
      else         localStorage.removeItem('groq_api_key');
      return { ...state, groqApiKey: payload };
    }

    case 'SET_MODEL': {
      localStorage.setItem('groq_model', payload);
      return { ...state, model: payload };
    }

    case 'SET_TOPK': {
      localStorage.setItem('groq_topk', String(payload));
      return { ...state, topK: payload };
    }

    case 'SET_COMPANY': {
      localStorage.setItem('company_name', payload);
      return { ...state, companyName: payload };
    }

    case 'SET_AUTO_SPEAK': {
      localStorage.setItem('auto_speak', String(payload));
      return { ...state, autoSpeak: payload };
    }

    case 'DOCS_LOADING':    return { ...state, docsLoading: true, docsError: null };
    case 'DOCS_LOADED':     return { ...state, docsLoading: false, documents: payload };
    case 'DOCS_ERROR':      return { ...state, docsLoading: false, docsError: payload };
    case 'DOC_ADD':         return { ...state, documents: [payload, ...state.documents] };
    case 'DOC_UPDATE':      return { ...state, documents: state.documents.map(d => d.id === payload.id ? payload : d) };
    case 'DOC_DEL':         return { ...state, documents: state.documents.filter(d => d.id !== payload), selectedDocIds: state.selectedDocIds.filter(x => x !== payload) };
    case 'DOC_TOGGLE':      return { ...state, selectedDocIds: state.selectedDocIds.includes(payload) ? state.selectedDocIds.filter(x => x !== payload) : [...state.selectedDocIds, payload] };
    case 'DOCS_SEL_ALL':    return { ...state, selectedDocIds: payload };
    case 'DOCS_SEL_NONE':   return { ...state, selectedDocIds: [] };

    case 'SESSIONS_LOADED': return { ...state, sessions: payload };
    case 'SESSION_ADD':     return { ...state, sessions: [payload, ...state.sessions] };
    case 'SESSION_DEL':     return { ...state, sessions: state.sessions.filter(s => s.id !== payload), activeSessionId: state.activeSessionId === payload ? null : state.activeSessionId, messages: state.activeSessionId === payload ? [] : state.messages };
    case 'SET_SESSION':     return { ...state, activeSessionId: payload, messages: [], chatError: null };
    case 'MSGS_LOADED':     return { ...state, messages: payload };
    case 'MSG_PUSH':        return { ...state, messages: [...state.messages, payload] };
    case 'MSG_REMOVE':      return { ...state, messages: state.messages.filter(m => m.id !== payload) };
    case 'MSG_UPDATE':      return { ...state, messages: state.messages.map(m => m.id === payload.id ? { ...m, content: payload.content } : m) };
    case 'MSG_FINALIZE':    return {
      ...state,
      messages: state.messages.map(m =>
        m.id === payload.tempId
          ? { id: payload.id, role: 'assistant', content: payload.content, sources: payload.sources, model_used: payload.model_used, streaming: false, created_at: new Date().toISOString() }
          : m
      ),
      activeSessionId: state.activeSessionId || payload.session_id,
    };
    case 'MSG_FEEDBACK':    return { ...state, messages: state.messages.map(m => m.id === payload.id ? { ...m, feedback: payload.rating } : m) };

    case 'CHAT_LOADING':    return { ...state, chatLoading: true,  chatError: null };
    case 'CHAT_DONE':       return { ...state, chatLoading: false };
    case 'CHAT_ERROR':      return { ...state, chatLoading: false, chatError: payload };

    case 'SET_UPLOAD':      return { ...state, uploadOpen: payload };
    case 'SET_SETTINGS':    return { ...state, settingsOpen: payload };
    case 'SET_TAB':         return { ...state, sidebarTab: payload };
    case 'SET_DASHBOARD':   return { ...state, showDashboard: payload };

    default: return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
