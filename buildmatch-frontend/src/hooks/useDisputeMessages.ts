import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../lib/supabase';
import { getDisputeMessages, addDisputeMessage } from '../services/dispute.service';
import { useAuth } from './useAuth';
import { useToast } from '../context/ToastContext';
import type { DisputeMessage } from '../types/dispute.types';

interface UseDisputeMessagesResult {
  messages:    DisputeMessage[];
  isLoading:   boolean;
  sendMessage: (content: string) => Promise<void>;
  messagesEndRef: RefObject<HTMLDivElement>;
}

export function useDisputeMessages(
  disputeId: string | undefined,
  dispute?: { filedBy: { id: string; firstName: string; lastName: string }; against: { firstName: string; lastName: string } } | null,
): UseDisputeMessagesResult {
  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const { toast }      = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [localMessages, setLocalMessages] = useState<DisputeMessage[]>([]);

  // ── Initial fetch ──────────────────────────────────────────────────────────

  const { data: fetchedMessages = [], isLoading } = useQuery({
    queryKey:        ['dispute-messages', disputeId],
    queryFn:         () => getDisputeMessages(disputeId!),
    enabled:         !!disputeId,
    refetchInterval: 15_000, // Polling fallback alongside Realtime
  });

  // Seed local state from query result
  useEffect(() => {
    setLocalMessages(fetchedMessages);
  }, [fetchedMessages]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────

  useEffect(() => {
    if (!disputeId) return;

    const supabase = getSupabaseClient();
    const channel  = supabase
      .channel(`dispute-messages:${disputeId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'dispute_messages',
          filter: `dispute_id=eq.${disputeId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string; dispute_id: string; sender_id: string;
            content: string; is_system: boolean; created_at: string;
          };

          setLocalMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;

            const senderName =
              row.sender_id === user?.id
                ? `${user.firstName} ${user.lastName}`
                : dispute?.filedBy.id === row.sender_id
                ? `${dispute.filedBy.firstName} ${dispute.filedBy.lastName}`
                : dispute?.against.firstName
                ? `${dispute.against.firstName} ${dispute.against.lastName}`
                : 'Other party';

            return [
              ...prev,
              {
                id:           row.id,
                disputeId:    row.dispute_id,
                senderId:     row.sender_id,
                senderName,
                senderAvatar: null,
                content:      row.content,
                isSystem:     row.is_system,
                createdAt:    row.created_at,
              },
            ];
          });

          // Keep the query cache fresh for external consumers
          queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [disputeId, user, dispute, queryClient]);

  // ── sendMessage ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      if (!disputeId) return;

      const tempId = `temp-${Date.now()}`;
      const temp: DisputeMessage = {
        id:           tempId,
        disputeId,
        senderId:     user?.id ?? '',
        senderName:   `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        senderAvatar: user?.avatarUrl ?? null,
        content,
        isSystem:     false,
        createdAt:    new Date().toISOString(),
      };

      // Optimistic append
      setLocalMessages((prev) => [...prev, temp]);

      try {
        const real = await addDisputeMessage(disputeId, content);
        // Replace temp (and deduplicate against any Realtime echo)
        setLocalMessages((prev) =>
          prev
            .filter((m) => m.id !== real.id)
            .map((m) => (m.id === tempId ? real : m)),
        );
        queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      } catch {
        setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast('Failed to send message', 'error');
      }
    },
    [disputeId, user, queryClient, toast],
  );

  return { messages: localMessages, isLoading, sendMessage, messagesEndRef };
}
