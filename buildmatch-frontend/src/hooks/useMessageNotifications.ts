import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../context/ToastContext';
import type { Conversation } from '../types/message.types';

/**
 * Subscribes to global message INSERT events via Supabase Realtime.
 * When a message arrives for a conversation the user is NOT currently viewing,
 * shows a toast with the sender's name, a preview, and a "View" action button.
 *
 * Mount this once inside DashboardLayout so the subscription lives for the
 * entire authenticated session.
 */
export function useMessageNotifications() {
  const { user }        = useAuth();
  const { toast }       = useToast();
  const navigate        = useNavigate();
  const location        = useLocation();
  const queryClient     = useQueryClient();

  // Keep a ref to the current pathname so the subscription callback can read
  // it without being torn down on every navigation.
  const pathRef = useRef(location.pathname);
  useEffect(() => {
    pathRef.current = location.pathname;
  });

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel('global-messages-notifications')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
        },
        (payload) => {
          const row = payload.new as {
            id:              string;
            conversation_id: string;
            sender_id:       string;
            content:         string;
          };

          // Ignore messages we sent ourselves
          if (row.sender_id === user.id) return;

          // Ignore if the user is already viewing this conversation
          if (pathRef.current.includes(row.conversation_id)) return;

          // Look up the conversation in the TanStack Query cache to get the sender name
          const conversations = queryClient.getQueryData<Conversation[]>(['conversations']);
          const conv = conversations?.find((c) => c.id === row.conversation_id);
          if (!conv) return; // not a conversation belonging to this user

          const name    = `${conv.otherUser.firstName} ${conv.otherUser.lastName}`;
          const preview = row.content.length > 40
            ? row.content.slice(0, 40) + '\u2026'
            : row.content;

          const convId = row.conversation_id;

          toast(
            `${name}: ${preview}`,
            'info',
            {
              label:   'View',
              onClick: () => navigate(`/dashboard/messages/${convId}`),
            },
          );

          // Refresh unread counts immediately
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, navigate, queryClient]);
}
