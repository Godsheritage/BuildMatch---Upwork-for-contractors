import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../lib/supabase';
import * as messageService from '../services/message.service';
import { useToast } from '../context/ToastContext';
import type { Message } from '../types/message.types';

interface TempMessage extends Message {
  sending?: boolean;
}

interface UseMessagingResult {
  messages: TempMessage[];
  isLoading: boolean;
  sendMessage: (content: string, replyToId?: string) => Promise<void>;
  editMessage:   (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  reportMessage: (messageId: string, reason: string, description?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useMessaging(conversationId: string | null): UseMessagingResult {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [localMessages, setLocalMessages] = useState<TempMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null>(null);

  // ── Initial fetch ─────────────────────────────────────────────────────────

  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      return messageService.getMessages(conversationId);
    },
    enabled: !!conversationId,
    staleTime: 0,
  });

  useEffect(() => {
    if (initialMessages) {
      setLocalMessages(initialMessages);
      // The service returns `limit` messages. If we ever get a full page (30),
      // assume there might be more; the loadMore call will reveal the truth.
      setHasMore(initialMessages.length >= 30);
      if (initialMessages.length > 0) {
        setCursor(initialMessages[0].id); // oldest id for backward pagination
      }
    }
  }, [initialMessages]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            content: string;
            edited_at: string | null;
            deleted_at: string | null;
          };
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    content:   updated.deleted_at ? '' : updated.content,
                    editedAt:  updated.edited_at,
                    deletedAt: updated.deleted_at,
                  }
                : m,
            ),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string;
            is_filtered: boolean;
            filter_warning?: string;
            read_at: string | null;
            created_at: string;
          };

          // Avoid duplicating optimistic messages — match by id
          setLocalMessages((prev) => {
            const alreadyExists = prev.some((m) => m.id === newRow.id);
            if (alreadyExists) return prev;

            const incoming: TempMessage = {
              id:             newRow.id,
              conversationId: newRow.conversation_id,
              senderId:       newRow.sender_id,
              content:        newRow.content,
              isFiltered:     newRow.is_filtered,
              filterWarning:  newRow.filter_warning,
              readAt:         newRow.read_at,
              createdAt:      newRow.created_at,
              sender: { firstName: '', lastName: '', avatarUrl: null },
            };
            return [...prev, incoming];
          });

          // Invalidate conversation list so unread counts stay fresh
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, queryClient]);

  // ── sendMessage ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, replyToId?: string) => {
      if (!conversationId) return;

      const tempId = `temp-${Date.now()}`;
      const tempMsg: TempMessage = {
        id:             tempId,
        conversationId,
        senderId:       'me',
        content,
        isFiltered:     false,
        readAt:         null,
        createdAt:      new Date().toISOString(),
        sending:        true,
        sender:         { firstName: '', lastName: '', avatarUrl: null },
        replyToId:      replyToId ?? null,
      };

      // Optimistic append
      setLocalMessages((prev) => [...prev, tempMsg]);

      try {
        const real = await messageService.sendMessage(conversationId, content, replyToId);
        // Replace temp with real. Also filter out any duplicate that the Realtime
        // subscription may have added before the API response arrived.
        setLocalMessages((prev) =>
          prev
            .filter((m) => m.id !== real.id)
            .map((m) =>
              m.id === tempId
                ? { ...real, sender: m.sender ?? { firstName: '', lastName: '', avatarUrl: null } }
                : m,
            ),
        );
      } catch {
        // Remove temp on failure
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast('Failed to send message. Please try again.', 'error');
      }
    },
    [conversationId, toast],
  );

  // ── editMessage / deleteMessage / reportMessage ──────────────────────────

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        const real = await messageService.editMessage(messageId, content);
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: real.content, editedAt: real.editedAt ?? new Date().toISOString() } : m)),
        );
      } catch {
        toast('Failed to edit message.', 'error');
      }
    },
    [toast],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Optimistic — mark deleted locally
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: '', deletedAt: new Date().toISOString() } : m)),
      );
      try {
        await messageService.deleteMessage(messageId);
      } catch {
        toast('Failed to delete message.', 'error');
      }
    },
    [toast],
  );

  const reportMessage = useCallback(
    async (messageId: string, reason: string, description?: string) => {
      try {
        await messageService.reportMessage(messageId, reason, description);
        toast('Thanks — we received your report.', 'success');
      } catch {
        toast('Could not submit report.', 'error');
      }
    },
    [toast],
  );

  // ── loadMore (cursor pagination — older messages) ─────────────────────────

  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || !cursor) return;

    try {
      const older = await messageService.getMessages(conversationId, cursor);
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      setHasMore(older.length >= 30);
      setCursor(older[0].id);
      setLocalMessages((prev) => [...older, ...prev]);
    } catch {
      toast('Could not load older messages.', 'error');
    }
  }, [conversationId, hasMore, cursor, toast]);

  return { messages: localMessages, isLoading, sendMessage, editMessage, deleteMessage, reportMessage, loadMore, hasMore };
}
