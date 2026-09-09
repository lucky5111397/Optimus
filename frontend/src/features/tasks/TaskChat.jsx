import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertTriangle, Loader2, Sparkles, MessageSquare, RefreshCw } from 'lucide-react';

export default function TaskChat({ taskId, onMessageSent, className = '' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskId}/messages`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to load conversation');
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
      setError('Network error while loading chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      setLoading(true);
      fetchMessages();
    }
  }, [taskId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    if (trimmed.length > 5000) {
      setError('Message exceeds 5,000 character limit');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: trimmed })
      });

      if (res.ok) {
        const savedMsg = await res.json();
        setMessages(prev => [...prev, savedMsg]);
        setInput('');
        if (onMessageSent) onMessageSent(savedMsg);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Send message error:', err);
      setError('Network error sending message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-surface border border-border rounded-md overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-heading font-semibold text-text-primary uppercase tracking-wider">
            Task Conversation & Steering
          </h3>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="p-1 text-text-secondary hover:text-text-primary rounded transition-colors disabled:opacity-50"
          title="Refresh messages"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
            <span className="text-xs font-mono">Loading conversation history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 text-text-secondary">
            <Bot className="w-8 h-8 text-primary/40 mb-2" />
            <p className="text-xs font-medium text-text-primary mb-1">Human-in-the-Loop Refinement</p>
            <p className="text-[11px] leading-relaxed text-text-secondary max-w-xs">
              Chat with OPTIMUS to clarify requirements, specify constraints, or provide feedback to refine the implementation plan.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isRejection = msg.metadata?.isRejectionFeedback;
            const isPlanSummary = msg.metadata?.isPlanSummary;

            return (
              <div
                key={msg._id || idx}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex-none w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mt-0.5">
                    {isPlanSummary ? <Sparkles className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-md p-3 text-xs leading-relaxed border ${
                    isRejection
                      ? 'bg-amber-950/20 border-amber-500/30 text-text-primary'
                      : isUser
                      ? 'bg-primary/15 border-primary/30 text-text-primary'
                      : 'bg-background border-border text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-semibold text-text-secondary uppercase">
                      {isRejection ? 'Rejection Feedback' : isUser ? 'You' : 'OPTIMUS'}
                    </span>
                    {msg.metadata?.planVersion && (
                      <span className="px-1.5 py-0.2 text-[9px] font-mono bg-surface border border-border rounded text-text-secondary">
                        v{msg.metadata.planVersion}
                      </span>
                    )}
                    {msg.createdAt && (
                      <span className="text-[10px] text-text-secondary/70 ml-auto font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="whitespace-pre-wrap break-words text-[11px] font-mono leading-relaxed">
                    {msg.content}
                  </div>
                </div>

                {isUser && (
                  <div className={`flex-none w-6 h-6 rounded-full flex items-center justify-center mt-0.5 border ${
                    isRejection ? 'bg-amber-900/30 border-amber-700 text-amber-400' : 'bg-surface border-border text-text-secondary'
                  }`}>
                    {isRejection ? <AlertTriangle className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex-none px-3 py-1.5 bg-red-950/30 border-t border-red-800 text-red-400 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSendMessage} className="flex-none p-2.5 border-t border-border bg-background flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send feedback or steering instructions to OPTIMUS... (Enter to send)"
          className="flex-1 bg-surface border border-border rounded p-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary resize-none max-h-24 min-h-[38px] font-mono"
          rows={1}
          maxLength={5000}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="flex-none p-2 bg-primary text-text-primary rounded hover:bg-opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Send message"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
