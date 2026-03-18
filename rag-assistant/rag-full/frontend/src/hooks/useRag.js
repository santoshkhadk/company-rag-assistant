import { useCallback } from 'react';
import { useStore } from '../store';
import { docsAPI, chatAPI, streamChat } from '../services/api';

/* ── Documents ─────────────────────────────── */
export function useDocuments() {
  const { state, dispatch } = useStore();

  const load = useCallback(async () => {
    dispatch({ type: 'DOCS_LOADING' });
    try   { dispatch({ type: 'DOCS_LOADED', payload: await docsAPI.list() }); }
    catch (e) { dispatch({ type: 'DOCS_ERROR', payload: e.message }); }
  }, [dispatch]);

  const upload = useCallback(async (file, opts = {}) => {
    const doc = await docsAPI.upload(file, opts);
    dispatch({ type: 'DOC_ADD', payload: doc });
    return doc;
  }, [dispatch]);

  const remove = useCallback(async (id) => {
    await docsAPI.delete(id);
    dispatch({ type: 'DOC_DEL', payload: id });
  }, [dispatch]);

  const reprocess = useCallback(async (id) => {
    const doc = await docsAPI.reprocess(id);
    dispatch({ type: 'DOC_UPDATE', payload: doc });
  }, [dispatch]);

  const toggleDoc  = (id) => dispatch({ type: 'DOC_TOGGLE', payload: id });
  const selAll     = ()   => dispatch({ type: 'DOCS_SEL_ALL', payload: state.documents.filter(d => d.status === 'ready').map(d => d.id) });
  const selNone    = ()   => dispatch({ type: 'DOCS_SEL_NONE' });

  return {
    documents: state.documents, loading: state.docsLoading, error: state.docsError,
    selectedDocIds: state.selectedDocIds,
    load, upload, remove, reprocess, toggleDoc, selAll, selNone,
  };
}

/* ── Chat with streaming ───────────────────── */
export function useChat() {
  const { state, dispatch } = useStore();

  const loadSessions = useCallback(async () => {
    const data = await chatAPI.sessions();
    dispatch({ type: 'SESSIONS_LOADED', payload: data });
  }, [dispatch]);

  const openSession = useCallback(async (id) => {
    dispatch({ type: 'SET_SESSION', payload: id });
    const { messages } = await chatAPI.getSession(id);
    dispatch({ type: 'MSGS_LOADED', payload: messages });
  }, [dispatch]);

  const delSession = useCallback(async (id) => {
    await chatAPI.delSession(id);
    dispatch({ type: 'SESSION_DEL', payload: id });
  }, [dispatch]);

  const newChat = () => {
    dispatch({ type: 'SET_SESSION', payload: null });
    dispatch({ type: 'MSGS_LOADED', payload: [] });
  };

  const send = useCallback(async (question) => {
    const { groqApiKey, model, topK, companyName, selectedDocIds, activeSessionId } = state;

    // Add user message immediately
    dispatch({ type: 'MSG_PUSH', payload: { id: `u-${Date.now()}`, role: 'user', content: question, sources: [] } });
    dispatch({ type: 'CHAT_LOADING' });

    // Add empty AI message bubble that we'll stream into
    const streamId = `stream-${Date.now()}`;
    dispatch({
      type: 'MSG_PUSH',
      payload: { id: streamId, role: 'assistant', content: '', sources: [], streaming: true },
    });

    try {
      const body = {
        question,
        session_id:   activeSessionId || undefined,
        document_ids: selectedDocIds.length ? selectedDocIds : undefined,
        model,
        top_k:        topK,
        api_key:      groqApiKey,
        company_name: companyName,
      };

      let fullContent = '';
      let finalMeta   = null;

      // Stream tokens
      for await (const event of streamChat(body)) {
        if (event.error) throw new Error(event.error);

        if (event.token) {
          fullContent += event.token;
          // Update the streaming bubble with accumulated text
          dispatch({
            type: 'MSG_UPDATE',
            payload: { id: streamId, content: fullContent },
          });
        }

        if (event.done) {
          finalMeta = event;
        }
      }

      // Finalize the message with real ID, sources, and remove streaming flag
      if (finalMeta) {
        dispatch({
          type: 'MSG_FINALIZE',
          payload: {
            tempId:     streamId,
            id:         finalMeta.message_id,
            session_id: finalMeta.session_id,
            sources:    finalMeta.sources || [],
            model_used: finalMeta.model,
            content:    fullContent,
          },
        });

        // Register new session in sidebar if first message
        if (!activeSessionId) {
          dispatch({ type: 'SET_SESSION', payload: finalMeta.session_id });
          const sess = await chatAPI.getSession(finalMeta.session_id);
          dispatch({ type: 'SESSION_ADD', payload: sess.session });
        }
      }

      dispatch({ type: 'CHAT_DONE' });
    } catch (e) {
      // Remove the streaming bubble on error
      dispatch({ type: 'MSG_REMOVE', payload: streamId });
      dispatch({ type: 'CHAT_ERROR', payload: e.message });
    }
  }, [state, dispatch]);

  return {
    sessions: state.sessions, activeSessionId: state.activeSessionId,
    messages: state.messages, loading: state.chatLoading, error: state.chatError,
    loadSessions, openSession, delSession, newChat, send,
  };
}
