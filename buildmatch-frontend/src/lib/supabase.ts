import { createClient } from '@supabase/supabase-js';

type SupabaseClient = ReturnType<typeof createClient>;
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) {
      throw new Error(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}
