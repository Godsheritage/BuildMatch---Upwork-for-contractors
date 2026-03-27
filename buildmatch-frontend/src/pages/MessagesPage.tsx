import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { getConversations, getConversation } from '../services/message.service';
import { Avatar } from '../components/ui/Avatar';
import { MessageThread, NoConversationSelected } from '../components/messaging/MessageThread';
import { JobContextPanel } from '../components/messaging/JobContextPanel';
import type { Conversation } from '../types/message.types';
import styles from './MessagesPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ConvSkeleton() {
  return (
    <div className={styles.convItem} style={{ pointerEvents: 'none' }}>
      <div className={`${styles.skeleton} ${styles.skeletonAvatar}`} />
      <div className={styles.convBody}>
        <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '60%', marginBottom: 6 }} />
        <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '85%' }} />
      </div>
    </div>
  );
}

// ── Conversation item ─────────────────────────────────────────────────────────

interface ConvItemProps {
  conv:          Conversation;
  isActive:      boolean;
  currentUserId: string;
  onClick:       () => void;
}

function ConversationItem({ conv, isActive, currentUserId, onClick }: ConvItemProps) {
  const { otherUser, lastMessage, unreadCount, lastMessageAt, jobTitle } = conv;
  const name = `${otherUser.firstName} ${otherUser.lastName}`;

  let preview = lastMessage?.content ?? '';
  if (lastMessage) {
    const isMine = lastMessage.senderId === currentUserId;
    preview = !preview
      ? 'No messages yet'
      : isMine ? `You: ${preview}` : preview;
  }

  return (
    <button
      className={`${styles.convItem} ${isActive ? styles.convItemActive : ''}`}
      onClick={onClick}
      type="button"
    >
      <Avatar name={name} src={otherUser.avatarUrl ?? undefined} size="sm" />

      <div className={styles.convBody}>
        <div className={styles.convTop}>
          <span className={styles.convName}>{name}</span>
          <span className={styles.convDot}>·</span>
          <span className={styles.convJob}>{jobTitle}</span>
        </div>
        <p className={styles.convPreview}>{preview || 'No messages yet'}</p>
      </div>

      <div className={styles.convMeta}>
        <span className={styles.convTime}>
          {lastMessageAt ? timeAgo(lastMessageAt) : ''}
        </span>
        {unreadCount > 0 && (
          <span className={styles.unreadBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </div>
    </button>
  );
}

// ── Left panel: Conversation list ─────────────────────────────────────────────

interface ConvListProps {
  activeId:         string | undefined;
  onSelect:         (conv: Conversation) => void;
  isHiddenOnMobile: boolean;
}

function ConversationList({ activeId, onSelect, isHiddenOnMobile }: ConvListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn:  getConversations,
    staleTime: 60_000,
  });

  const filtered = search.trim()
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        const name = `${c.otherUser.firstName} ${c.otherUser.lastName}`.toLowerCase();
        return name.includes(q) || c.jobTitle.toLowerCase().includes(q);
      })
    : conversations;

  return (
    <div className={`${styles.leftPanel} ${isHiddenOnMobile ? styles.hiddenMobile : ''}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Messages</h2>
      </div>

      <div className={styles.searchWrap}>
        <Search size={14} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.convList}>
        {isLoading ? (
          <>
            <ConvSkeleton />
            <ConvSkeleton />
            <ConvSkeleton />
            <ConvSkeleton />
          </>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageSquare size={40} strokeWidth={1.25} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No conversations yet</p>
            <p className={styles.emptyDesc}>
              Conversations start when you contact a contractor about a job.
            </p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeId}
              currentUserId={user?.id ?? ''}
              onClick={() => onSelect(conv)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate           = useNavigate();
  const queryClient        = useQueryClient();
  const { totalUnread }    = useUnreadCount();

  // ── Document title ──────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = totalUnread > 0
      ? `(${totalUnread}) BuildMatch | Messages`
      : 'BuildMatch | Messages';
    return () => { document.title = 'BuildMatch'; };
  }, [totalUnread]);

  const [activeConv, setActiveConv] = useState<Conversation | null>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn:  getConversations,
    staleTime: 60_000,
  });

  // Sync activeConv from URL on load / navigation
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const found = conversations.find((c) => c.id === conversationId);
      if (found) setActiveConv(found);
    }
    if (!conversationId) setActiveConv(null);
  }, [conversationId, conversations]);

  // Fetch selected conversation (marks messages as read server-side)
  const { isSuccess: convFetched } = useQuery({
    queryKey: ['conversations', conversationId],
    queryFn:  () => getConversation(conversationId!),
    enabled:  !!conversationId,
    staleTime: 0,
  });

  useEffect(() => {
    if (convFetched) {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    }
  }, [convFetched, queryClient]);

  const handleSelectConv = useCallback((conv: Conversation) => {
    setActiveConv(conv);
    navigate(`/dashboard/messages/${conv.id}`);
  }, [navigate]);

  const showListOnMobile   = !conversationId;
  const showThreadOnMobile = !!conversationId;

  return (
    <div className={styles.page}>
      <div className={styles.panels}>

        {/* Left: conversation list */}
        <ConversationList
          activeId={conversationId}
          onSelect={handleSelectConv}
          isHiddenOnMobile={!showListOnMobile}
        />

        {/* Middle: thread or empty state */}
        <div className={`${styles.threadPanel} ${!showThreadOnMobile ? styles.hiddenMobile : ''}`}>
          {activeConv ? (
            <MessageThread key={activeConv.id} conversation={activeConv} />
          ) : (
            <NoConversationSelected />
          )}
        </div>

        {/* Right: job context panel (hidden tablet+below via its own CSS) */}
        {activeConv && (
          <JobContextPanel conversation={activeConv} />
        )}
      </div>
    </div>
  );
}
