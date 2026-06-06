import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, FileText } from 'lucide-react';

export default function ChatArea({ 
  messages, 
  onSendMessage, 
  loading, 
  filesCount,
  selectedFileIds
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSendMessage(input);
    setInput('');
  };

  const suggestions = [
    { title: 'Summarize Document', desc: 'Provide a quick high-level summary of the files.' },
    { title: 'Find Key Details', desc: 'Are there any deadlines, dates, or specifications?' },
    { title: 'Explain a Concept', desc: 'What is the main topic explained in these documents?' },
    { title: 'Action Items', desc: 'Identify any actionable requirements or next steps.' }
  ];

  return (
    <div className="chat-area">
      {/* Header */}
      <header className="chat-header">
        <div>
          <h2 className="chat-header-title">Conversational AI Agent</h2>
          <span className="chat-header-status">
            <span className="status-dot"></span>
            Ready • {filesCount} source{filesCount !== 1 ? 's' : ''} indexed 
            {selectedFileIds.length > 0 && ` (${selectedFileIds.length} filtered)`}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-container">
            <Bot className="welcome-icon" size={48} />
            <h2 className="welcome-title">Ask Your Knowledge Base</h2>
            <p className="welcome-subtitle">
              Upload PDF documents or paste text notes in the sidebar, then ask questions.
              Our agent will query your vector store and use Groq's high-speed LLM to formulate an answer with citations.
            </p>

            {filesCount > 0 && (
              <div className="suggestion-grid">
                {suggestions.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="suggestion-card"
                    onClick={() => setInput(`Can you please ${s.title.toLowerCase()} from my documents?`)}
                  >
                    <div className="suggestion-title">{s.title}</div>
                    <div className="suggestion-desc">{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
            
            {filesCount === 0 && (
              <div 
                className="glass-panel" 
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'center', 
                  borderColor: 'rgba(245, 158, 11, 0.2)',
                  background: 'rgba(245, 158, 11, 0.02)',
                  color: 'var(--warning)',
                  fontSize: '0.85rem',
                  borderRadius: '12px',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <span>To start querying, please upload a document or save a text note in the left panel.</span>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="message-bubble">
                <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
                
                {/* Citations if available */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="citations-box">
                    <span className="citation-label">Sources:</span>
                    {msg.sources.map((src, sIdx) => (
                      <span key={sIdx} className="citation-tag">
                        <FileText size={10} style={{ marginRight: '4px', display: 'inline' }} />
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="message-wrapper assistant">
            <div className="message-avatar">
              <Bot size={16} />
            </div>
            <div className="message-bubble" style={{ width: '320px' }}>
              <div className="skeleton-wrapper">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            className="chat-input-field"
            placeholder={
              filesCount === 0 
                ? "Upload documents first to start chatting..." 
                : "Ask a question about your indexed files..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={filesCount === 0 || loading}
          />
          <button 
            type="submit" 
            className="send-btn" 
            disabled={filesCount === 0 || loading || !input.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
