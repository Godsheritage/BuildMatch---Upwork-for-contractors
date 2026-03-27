import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../lib/supabase';
import { getTotalUnreadCount } from '../services/message.service';
import { useAuth } from './useAuth';

interface UseUnreadCountResult {
  totalUnread: number;
}

export function useUnreadCount(): UseUnreadCountResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: getTotalUnreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // Subscribe to conversation changes so the badge updates without waiting
  // for the 30-second poll interval
  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel('conversations-unread')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return { totalUnread: data?.total ?? 0 };
}
