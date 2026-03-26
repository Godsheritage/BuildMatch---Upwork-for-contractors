import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, RotateCcw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { sendMessage } from '../../services/ai.service';
import type { ChatMessage } from '../../services/ai.service';
import styles from './HelpDrawer.module.css';

const SUGGESTIONS = [
  'How do I post a job?',
  'How do I submit a bid?',
  'How can I improve my profile?',
  'What happens after I accept a bid?',
];

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  async function submit(text: string) {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: msg };
    setHistory((h) => [...h, userMsg]);
    setIsLoading(true);
    try {
      const reply = await sendMessage(msg, history);
      setHistory((h) => [...h, { role: 'assistant', content: reply }]);
    } catch {
      setHistory((h) => [...h, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again in a moment.' }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  const greeting = user ? `Hi ${user.firstName}` : 'Hi there';

  return (
    <>
      {/* Backdrop */}
      {open && <div className={styles.backdrop} onClick={onClose} aria-hidden />}

      {/* Drawer */}
      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`} role="dialog" aria-label="AI Assistant">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.aiIcon}>
              <Sparkles size={15} strokeWidth={2} />
            </div>
            <span className={styles.headerTitle}>Assistant</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {history.length > 0 && (
              <button
                className={styles.iconBtn}
                onClick={() => setHistory([])}
                title="Clear conversation"
              >
                <RotateCcw size={15} strokeWidth={2} />
              </button>
            )}
            <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {history.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyAiIcon}>
                <Sparkles size={22} strokeWidth={1.75} />
              </div>
              <p className={styles.emptyGreeting}>{greeting}, how can I help you with <strong>BuildMatch</strong>? The more details you provide, the better.</p>

              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className={styles.suggestionChip} onClick={() => submit(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {history.map((msg, i) => (
                <div
                  key={i}
                  className={msg.role === 'user' ? styles.userBubble : styles.aiBubble}
                >
                  {msg.role === 'assistant' && (
                    <div className={styles.aiBubbleIcon}>
                      <Sparkles size={11} strokeWidth={2} />
                    </div>
                  )}
                  <p className={styles.bubbleText}>{msg.content}</p>
                </div>
              ))}
              {isLoading && (
                <div className={styles.aiBubble}>
                  <div className={styles.aiBubbleIcon}>
                    <Sparkles size={11} strokeWidth={2} />
                  </div>
                  <div className={styles.typingDots}>
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrap}>
            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <button
              className={`${styles.sendBtn} ${input.trim() && !isLoading ? styles.sendBtnActive : ''}`}
              onClick={() => submit(input)}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
            >
              <Send size={14} strokeWidth={2} />
            </button>
          </div>
          <p className={styles.disclaimer}>AI may make mistakes. Verify important information.</p>
        </div>
      </div>
    </>
  );
}
