import { useRef, useEffect } from 'react';
import { useStore } from '../store/store';
import { useChat } from '../hooks/useRag';
import ChatMessage, { TypingBubble } from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';

export default function ChatPage() {
  const { state } = useStore();
  const { messages, loading, error, send } = useChat();
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const noKey = !state.groqApiKey;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8f9ff' }}>

      {/* Warning banner if no API key */}
      {noKey && (
        <div style={{ padding: '10px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ <strong>Groq API key not set.</strong>&nbsp;
          Click <strong>⚙️ Settings</strong> above to add your key from&nbsp;
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: '#d97706', fontWeight: 600 }}>console.groq.com</a>
          &nbsp;(free).
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
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

      {/* Input */}
      <div style={{ maxWidth: 760 + 40, width: '100%', alignSelf: 'center', width: '100%' }}>
        <ChatInput
          onSend={send}
          loading={loading}
          disabled={noKey}
          hasMessages={messages.length > 0}
        />
      </div>
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
          ['📂', 'Upload Docs',      'Add PDF, DOCX, TXT, MD, CSV files'],
          ['☑️', 'Select Sources',   'Restrict which docs the AI searches'],
          ['❓', 'Ask Questions',    'Get grounded, cited answers'],
          ['💬', 'Chat History',     'All sessions saved automatically'],
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
