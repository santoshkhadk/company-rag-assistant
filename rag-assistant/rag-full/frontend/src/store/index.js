import { createContext, useContext, useReducer } from 'react';

const init = {
  groqApiKey:   '',
  model:        'llama-3.3-70b-versatile',
  topK:         3,
  companyName:  'Our Company',
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
};

function reducer(state, { type, payload }) {
  switch (type) {
    case 'SET_KEY':          return { ...state, groqApiKey: payload };
    case 'SET_MODEL':        return { ...state, model: payload };
    case 'SET_TOPK':         return { ...state, topK: payload };
    case 'SET_COMPANY':      return { ...state, companyName: payload };
    case 'DOCS_LOADING':     return { ...state, docsLoading: true, docsError: null };
    case 'DOCS_LOADED':      return { ...state, docsLoading: false, documents: payload };
    case 'DOCS_ERROR':       return { ...state, docsLoading: false, docsError: payload };
    case 'DOC_ADD':          return { ...state, documents: [payload, ...state.documents] };
    case 'DOC_UPDATE':       return { ...state, documents: state.documents.map(d => d.id === payload.id ? payload : d) };
    case 'DOC_DEL':          return { ...state, documents: state.documents.filter(d => d.id !== payload), selectedDocIds: state.selectedDocIds.filter(x => x !== payload) };
    case 'DOC_TOGGLE':       return { ...state, selectedDocIds: state.selectedDocIds.includes(payload) ? state.selectedDocIds.filter(x => x !== payload) : [...state.selectedDocIds, payload] };
    case 'DOCS_SEL_ALL':     return { ...state, selectedDocIds: payload };
    case 'DOCS_SEL_NONE':    return { ...state, selectedDocIds: [] };
    case 'SESSIONS_LOADED':  return { ...state, sessions: payload };
    case 'SESSION_ADD':      return { ...state, sessions: [payload, ...state.sessions] };
    case 'SESSION_DEL':      return { ...state, sessions: state.sessions.filter(s => s.id !== payload), activeSessionId: state.activeSessionId === payload ? null : state.activeSessionId, messages: state.activeSessionId === payload ? [] : state.messages };
    case 'SET_SESSION':      return { ...state, activeSessionId: payload, messages: [], chatError: null };
    case 'MSGS_LOADED':      return { ...state, messages: payload };
    case 'MSG_PUSH':         return { ...state, messages: [...state.messages, payload] };
    case 'CHAT_LOADING':     return { ...state, chatLoading: true,  chatError: null };
    case 'CHAT_DONE':        return { ...state, chatLoading: false };
    case 'CHAT_ERROR':       return { ...state, chatLoading: false, chatError: payload };
    case 'SET_UPLOAD':       return { ...state, uploadOpen: payload };
    case 'SET_SETTINGS':     return { ...state, settingsOpen: payload };
    case 'SET_TAB':          return { ...state, sidebarTab: payload };
    default:                 return state;
  }
}

const Ctx = createContext(null);
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);
