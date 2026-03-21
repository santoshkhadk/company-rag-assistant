import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/store';
import { useChat } from '../hooks/useRag';
import ChatMessage, { TypingBubble } from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';

export default function ChatPage() {
  const { state }  = useStore();
  const { messages, loading, error, send } = useChat();
  const bottomRef  = useRef();
  const scrollRef  = useRef();
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const isAtBottom_ = useRef(true);

  // ── Detect if user has scrolled up ────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 80;
    isAtBottom_.current = atBottom;
    setShowScrollBtn(!atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  // ── Auto-scroll only when user is already at bottom ───────
  useEffect(() => {
    if (isAtBottom_.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    } else {
      // User scrolled up — show unread count instead of forcing scroll
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant') {
          setUnreadCount(prev => prev + 1);
        }
      }
    }
  }, [messages, loading]);

  // ── Scroll to bottom button click ─────────────────────────
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
    setUnreadCount(0);
    isAtBottom_.current = true;
  };

  const noKey = !state.groqApiKey;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8f9ff', position: 'relative' }}>

      {/* No API key warning */}
      {noKey && (
        <div style={{ padding: '10px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ <strong>Groq API key not set.</strong>&nbsp;
          Click <strong>⚙️ Settings</strong> above to add your key from&nbsp;
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: '#d97706', fontWeight: 600 }}>console.groq.com</a>
          &nbsp;(free).
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}
      >
        {messages.length === 0 && !loading
          ? <EmptyState noKey={noKey} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760, margin: '0 auto' }}>
              {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
              {loading && <TypingBubble />}
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )
        }
      </div>

      {/* ── Scroll to bottom button ── */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: 90,
            right: 24,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 20,
            border: 'none',
            background: '#4f46e5',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
            fontFamily: 'inherit',
            animation: 'slideUp 0.2s ease',
          }}
        >
          {unreadCount > 0 && (
            <span style={{
              background: '#fff',
              color: '#4f46e5',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 700,
              minWidth: 18,
              textAlign: 'center',
            }}>
              {unreadCount}
            </span>
          )}
          ↓ {unreadCount > 0 ? 'New messages' : 'Scroll to bottom'}
        </button>
      )}

      {/* Input */}
      <div style={{ width: '100%' }}>
        <ChatInput
          onSend={send}
          loading={loading}
          disabled={noKey}
          hasMessages={messages.length > 0}
        />
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ noKey }) {
  return (
    <div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' }}>
      <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
        🤖
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Company RAG Assistant</h2>
      <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 400, lineHeight: 1.7, margin: 0 }}>
        Upload your company documents in the sidebar, then ask questions.<br />
        The assistant uses <strong>RAG</strong> to retrieve relevant context and answers with <strong>Groq LLM</strong>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6, maxWidth: 420, width: '100%' }}>
        {[
          ['📂', 'Upload Docs',    'Add PDF, DOCX, TXT, MD, CSV files'],
          ['☑️', 'Select Sources', 'Restrict which docs the AI searches'],
          ['❓', 'Ask Questions',  'Get grounded, cited answers'],
          ['💬', 'Chat History',   'All sessions saved automatically'],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ padding: '12px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb', textAlign: 'left' }}>
            <div style={{ fontSize: 20, marginBottom: 5 }}>{icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{desc}</div>
          </div>
        ))}
      </div>
      {noKey && (
        <p style={{ fontSize: 13, color: '#d97706', background: '#fffbeb', padding: '8px 16px', borderRadius: 8, border: '1px solid #fde68a', margin: 0 }}>
          👆 Click <strong>⚙️ Settings</strong> to add your free Groq API key
        </p>
      )}
    </div>
  );
}