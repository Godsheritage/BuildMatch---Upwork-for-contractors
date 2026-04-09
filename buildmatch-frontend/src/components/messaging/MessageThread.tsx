import {
  useState, useEffect, useLayoutEffect,
  useRef, useCallback,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Send, MessageSquare,
  Check, CheckCheck, AlertTriangle, X, Loader, Info, CornerDownRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMessaging } from '../../hooks/useMessaging';
import { Avatar } from '../ui/Avatar';
import { JobInfoDrawer } from './JobInfoDrawer';
import { MessageActionsMenu } from './MessageActionsMenu';
import { ReportMessageModal } from './ReportMessageModal';
import type { Conversation, Message } from '../../types/message.types';
import styles from './MessageThread.module.css';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

// ── Types ─────────────────────────────────────────────────────────────────────

type TempMessage = Message & { sending?: boolean };

// ── Constants ─────────────────────────────────────────────────────────────────

const REMINDER_KEY = 'bm_msg_reminder_dismissed';
const MAX_CHARS    = 2000;

// ── Date helpers ──────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function dateSeparatorLabel(date: Date): string {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today))     return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

// ── Per-message render metadata ───────────────────────────────────────────────

interface PreparedMsg {
  msg:               TempMessage;
  isOwn:             boolean;
  showSeparator:     boolean;
  separatorLabel:    string;
  showSenderName:    boolean; // first of a consecutive group from other user
  showAvatar:        boolean; // last of a consecutive group from other user
}

function prepareMessages(
  messages: TempMessage[],
  currentUserId: string,
): PreparedMsg[] {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const isOwn = msg.senderId === currentUserId || msg.senderId === 'me';

    const msgDate  = new Date(msg.createdAt);
    const prevDate = prev ? new Date(prev.createdAt) : null;

    const showSeparator  = !prevDate || !isSameDay(msgDate, prevDate);
    const separatorLabel = dateSeparatorLabel(msgDate);

    // Group: consecutive messages from the same sender with no day separator
    const sameAsPrev =
      !!prev && prev.senderId === msg.senderId && !showSeparator;
    const sameAsNext =
      !!next && next.senderId === msg.senderId &&
      !(!isSameDay(new Date(next.createdAt), msgDate));

    const showSenderName = !isOwn && !sameAsPrev;
    const showAvatar     = !isOwn && !sameAsNext;

    return { msg, isOwn, showSeparator, separatorLabel, showSenderName, showAvatar };
  });
}

// ── Date separator ────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className={styles.dateSeparator}>
      <span className={styles.dateSeparatorLabel}>{label}</span>
    </div>
  );
}

// ── Filter warning banner ─────────────────────────────────────────────────────

function FilterWarningBanner() {
  return (
    <div className={styles.filterBanner}>
      <AlertTriangle size={12} strokeWidth={2} className={styles.filterBannerIcon} />
      Contact info was removed from this message
    </div>
  );
}

// ── Spinner (small, inline) ───────────────────────────────────────────────────

function Spinner() {
  return <Loader size={12} strokeWidth={2} className={styles.spinner} />;
}

// ── Message bubble ────────────────────────────────────────────────────────────

interface BubbleProps {
  prepared:      PreparedMsg;
  senderAvatar:  string | null;
  isEditing:     boolean;
  onReply:       () => void;
  onStartEdit:   () => void;
  onCancelEdit:  () => void;
  onSubmitEdit:  (newContent: string) => Promise<void>;
  onDelete:      () => void;
  onReport:      () => void;
  onJumpToReply: (id: string) => void;
}

function MessageBubble({
  prepared, senderAvatar, isEditing,
  onReply, onStartEdit, onCancelEdit, onSubmitEdit, onDelete, onReport, onJumpToReply,
}: BubbleProps) {
  const { msg, isOwn, showSenderName, showAvatar } = prepared;
  const [hovered, setHovered] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  useEffect(() => { if (isEditing) setEditText(msg.content); }, [isEditing, msg.content]);

  const senderName = msg.sender
    ? `${msg.sender.firstName} ${msg.sender.lastName}`.trim() || 'User'
    : 'User';

  const isDeleted    = !!msg.deletedAt;
  const isEdited     = !!msg.editedAt && !isDeleted;
  const canEdit      = isOwn && !isDeleted &&
    (Date.now() - new Date(msg.createdAt).getTime() < EDIT_WINDOW_MS);

  return (
    <div
      className={`${styles.bubbleRow} ${isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left-side avatar placeholder keeps alignment even when hidden */}
      <div className={styles.avatarSlot}>
        {!isOwn && showAvatar && (
          <Avatar name={senderName} src={senderAvatar ?? undefined} size="sm" />
        )}
      </div>

      <div className={`${styles.bubbleGroup} ${isOwn ? styles.bubbleGroupOwn : ''}`} style={{ position: 'relative' }}>
        {/* Sender name — first of consecutive group only */}
        {showSenderName && (
          <span className={styles.senderName}>{senderName}</span>
        )}

        {/* Reply preview chip — clickable to jump to source */}
        {msg.replyTo && (
          <button
            type="button"
            onClick={() => onJumpToReply(msg.replyTo!.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              maxWidth: 360, padding: '6px 10px',
              background: '#F8F7F5', border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-primary)',
              borderRadius: 8, marginBottom: 4, cursor: 'pointer',
              fontSize: 12, color: 'var(--color-text-muted)',
              textAlign: 'left',
            }}
          >
            <CornerDownRight size={12} strokeWidth={2} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {msg.replyTo.deletedAt ? 'Original message was deleted' : msg.replyTo.content}
            </span>
          </button>
        )}

        {/* Filter warning ABOVE the bubble */}
        {msg.isFiltered && !isDeleted && <FilterWarningBanner />}

        {/* The bubble itself OR inline editor OR deleted placeholder */}
        {isDeleted ? (
          <div
            className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`}
            style={{ fontStyle: 'italic', opacity: 0.6 }}
          >
            This message was deleted
          </div>
        ) : isEditing ? (
          <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`} style={{ padding: 8, minWidth: 240 }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={3}
              maxLength={2000}
              style={{
                width: '100%', minHeight: 60, border: 'none', outline: 'none',
                background: 'transparent', color: 'inherit', fontFamily: 'inherit',
                fontSize: 14, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                onClick={onCancelEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'inherit', opacity: 0.8 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editText.trim() || editText.trim() === msg.content}
                onClick={() => { void onSubmitEdit(editText.trim()); }}
                style={{
                  background: '#fff', color: 'var(--color-primary)',
                  border: 'none', borderRadius: 6, padding: '4px 10px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther} ${msg.sending ? styles.bubbleSending : ''}`}>
            {msg.content}
            {msg.sending && <Spinner />}
          </div>
        )}

        {/* Hover-only 3-dot actions menu — top-right of the bubble */}
        {!msg.sending && !isEditing && !isDeleted && hovered && (
          <div style={{
            position: 'absolute',
            top: showSenderName ? 22 : 0,
            [isOwn ? 'left' : 'right']: -32,
          } as React.CSSProperties}>
            <MessageActionsMenu
              isOwn={isOwn}
              canEdit={canEdit}
              onReply={onReply}
              onEdit={onStartEdit}
              onDelete={onDelete}
              onReport={onReport}
            />
          </div>
        )}

        {/* Filter warning from backend (global, shown below bubble) */}
        {msg.filterWarning && (
          <p className={styles.filterWarningText}>{msg.filterWarning}</p>
        )}

        {/* Timestamp + read receipt + edited indicator */}
        <div className={`${styles.metaRow} ${isOwn ? styles.metaRowOwn : ''}`}>
          <span className={styles.bubbleTime}>{timeStr(msg.createdAt)}</span>
          {isEdited && (
            <span className={styles.bubbleTime} style={{ fontStyle: 'italic' }}>· edited</span>
          )}
          {isOwn && !msg.sending && !isDeleted && (
            <span className={`${styles.readReceipt} ${msg.readAt ? styles.readReceiptRead : ''}`}>
              {msg.readAt ? (
                <>
                  <CheckCheck size={12} strokeWidth={2.5} /> Read
                </>
              ) : (
                <>
                  <Check size={12} strokeWidth={2.5} /> Sent
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contact info reminder ─────────────────────────────────────────────────────

function ContactReminder({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className={styles.reminder}>
      <p className={styles.reminderText}>
        For your protection, phone numbers, emails, and social handles are
        automatically removed from messages.
      </p>
      <button
        className={styles.reminderDismiss}
        onClick={onDismiss}
        type="button"
        aria-label="Dismiss"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── ─────────────────────────── ───────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export interface MessageThreadProps {
  conversation: Conversation;
}

export function MessageThread({ conversation }: MessageThreadProps) {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);

  // Scroll anchor: restored after loadMore prepends messages
  const prevScrollHeightRef = useRef<number | null>(null);

  const [inputValue,   setInputValue]   = useState('');
  const [isSending,    setIsSending]    = useState(false);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [showReminder, setShowReminder] = useState(
    () => !sessionStorage.getItem(REMINDER_KEY),
  );
  const [replyingTo,  setReplyingTo]  = useState<Message | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [reportingMsg, setReportingMsg] = useState<Message | null>(null);

  const { messages, isLoading, sendMessage, editMessage, deleteMessage, reportMessage, loadMore, hasMore } =
    useMessaging(conversation.id);

  const otherUser  = conversation.otherUser;
  const otherName  = `${otherUser.firstName} ${otherUser.lastName}`;

  // ── Scroll to bottom on initial load and when a new message arrives ────────

  const prevCountRef = useRef(0);
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || messages.length === 0) return;

    const isInitialLoad = prevCountRef.current === 0;
    const isNewMessage  = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (!isInitialLoad && !isNewMessage) return;

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    if (isInitialLoad || nearBottom) {
      bottomRef.current?.scrollIntoView({
        behavior: isInitialLoad ? ('instant' as ScrollBehavior) : 'smooth',
      });
    }
  }, [messages.length]);

  // ── Restore scroll after loadMore (no jump) ────────────────────────────────

  useLayoutEffect(() => {
    const el      = scrollAreaRef.current;
    const prevH   = prevScrollHeightRef.current;
    if (el && prevH !== null) {
      el.scrollTop += el.scrollHeight - prevH;
      prevScrollHeightRef.current = null;
    }
  });

  const handleLoadMore = useCallback(async () => {
    const el = scrollAreaRef.current;
    if (el) prevScrollHeightRef.current = el.scrollHeight;
    await loadMore();
  }, [loadMore]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isSending || text.length > MAX_CHARS) return;
    setInputValue('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsSending(true);
    try {
      await sendMessage(text, replyId);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isSending, sendMessage, replyingTo]);

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  }, []);

  const handleSubmitEdit = useCallback(async (id: string, content: string) => {
    setEditingId(null);
    await editMessage(id, content);
  }, [editMessage]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this message? It will be removed for everyone in this conversation.')) return;
    await deleteMessage(id);
  }, [deleteMessage]);

  const handleJumpToReply = useCallback((id: string) => {
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.bubbleHighlight ?? '');
      setTimeout(() => el.classList.remove(styles.bubbleHighlight ?? ''), 1500);
    }
  }, []);

  const dismissReminder = useCallback(() => {
    sessionStorage.setItem(REMINDER_KEY, '1');
    setShowReminder(false);
  }, []);

  // ── Prepared messages ─────────────────────────────────────────────────────

  const prepared = prepareMessages(messages as TempMessage[], user?.id ?? '');
  const charCount = inputValue.length;
  const charColor =
    charCount >= 1950 ? 'var(--color-danger)' :
    charCount >= 1800 ? 'var(--color-warning)' :
    'var(--color-text-muted)';

  return (
    <div className={styles.thread}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        {/* Back button (mobile only, shown via CSS) */}
        <button
          className={styles.backBtn}
          onClick={() => navigate('/dashboard/messages')}
          type="button"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        {/* Left: avatar + name */}
        <div className={styles.headerLeft}>
          <Avatar name={otherName} src={otherUser.avatarUrl ?? undefined} size="sm" />
          <span className={styles.headerName}>{otherName}</span>
        </div>

        {/* Center: job title */}
        <p className={styles.headerJob}>{conversation.jobTitle}</p>

        {/* Job Info button — mobile only, opens bottom sheet */}
        <button
          className={styles.jobInfoBtn}
          onClick={() => setJobDrawerOpen(true)}
          type="button"
          aria-label="Job info"
        >
          <Info size={17} strokeWidth={1.75} />
        </button>

        {/* View Job — desktop only */}
        <Link
          to={`/jobs/${conversation.jobId}`}
          className={styles.viewJobBtn}
        >
          View Job <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      {/* ── Job info bottom sheet (mobile) ──────────────────────────────── */}
      <JobInfoDrawer
        open={jobDrawerOpen}
        onClose={() => setJobDrawerOpen(false)}
        conversation={conversation}
      />

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className={styles.messagesArea} ref={scrollAreaRef}>

        {/* Load older messages */}
        {hasMore && (
          <div className={styles.loadMoreWrap}>
            <button
              className={styles.loadMoreBtn}
              onClick={handleLoadMore}
              type="button"
            >
              Load older messages
            </button>
          </div>
        )}

        {/* Skeleton */}
        {isLoading && messages.length === 0 && (
          <div className={styles.skeletonStack}>
            <div className={`${styles.skeleton} ${styles.skOther}`} />
            <div className={`${styles.skeleton} ${styles.skOwn}`}   />
            <div className={`${styles.skeleton} ${styles.skOther}`} />
            <div className={`${styles.skeleton} ${styles.skOwn}`}   />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && messages.length === 0 && (
          <div className={styles.emptyState}>
            <MessageSquare size={48} strokeWidth={1} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Start the conversation</p>
            <p className={styles.emptyDesc}>
              Ask about the job, share your availability, or introduce yourself.
            </p>
          </div>
        )}

        {/* Messages */}
        {prepared.map(({ msg, showSeparator, separatorLabel, ...rest }) => (
          <div key={msg.id} data-msg-id={msg.id}>
            {showSeparator && <DateSeparator label={separatorLabel} />}
            <MessageBubble
              prepared={{ msg, showSeparator, separatorLabel, ...rest }}
              senderAvatar={
                rest.isOwn
                  ? (user?.avatarUrl ?? null)
                  : (otherUser.avatarUrl ?? null)
              }
              isEditing={editingId === msg.id}
              onReply={() => handleReply(msg)}
              onStartEdit={() => setEditingId(msg.id)}
              onCancelEdit={() => setEditingId(null)}
              onSubmitEdit={(content) => handleSubmitEdit(msg.id, content)}
              onDelete={() => void handleDelete(msg.id)}
              onReport={() => setReportingMsg(msg)}
              onJumpToReply={handleJumpToReply}
            />
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <div className={styles.inputWrap}>

        {/* Contact info reminder — shown once per session */}
        {showReminder && <ContactReminder onDismiss={dismissReminder} />}

        {/* Reply preview banner */}
        {replyingTo && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, padding: '8px 12px', marginBottom: 6,
            background: '#F8F7F5',
            borderLeft: '3px solid var(--color-primary)',
            borderRadius: 8, fontSize: 12,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>
                Replying to {replyingTo.senderId === user?.id ? 'yourself' : otherName}
              </div>
              <div style={{
                color: 'var(--color-text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {replyingTo.content || 'Original message'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
              aria-label="Cancel reply"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}

        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            className={styles.textarea}
            placeholder="Type a message..."
            rows={1}
            value={inputValue}
            disabled={isSending}
            maxLength={MAX_CHARS + 50} /* soft: enforced on send */
            onChange={(e) => {
              setInputValue(e.target.value);
              e.currentTarget.style.height = 'auto';
              const next = Math.min(e.currentTarget.scrollHeight, 5 * 24 + 20); // ~5 lines
              e.currentTarget.style.height = `${next}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <button
            className={styles.sendBtn}
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isSending || charCount > MAX_CHARS}
            type="button"
            aria-label="Send message"
          >
            {isSending
              ? <Loader size={15} strokeWidth={2} className={styles.spinner} />
              : <Send   size={15} strokeWidth={2} />
            }
          </button>
        </div>

        {/* Character count */}
        <p className={styles.charCount} style={{ color: charColor }}>
          {charCount} / {MAX_CHARS}
        </p>
      </div>

      {/* Report modal */}
      {reportingMsg && (
        <ReportMessageModal
          message={{ id: reportingMsg.id, content: reportingMsg.content }}
          onClose={() => setReportingMsg(null)}
          onSubmit={(reason, description) => reportMessage(reportingMsg.id, reason, description)}
        />
      )}
    </div>
  );
}

// ── No conversation selected ──────────────────────────────────────────────────

export function NoConversationSelected() {
  return (
    <div className={styles.noConvWrap}>
      <MessageSquare size={64} strokeWidth={1} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>Select a conversation to start messaging</p>
    </div>
  );
}
