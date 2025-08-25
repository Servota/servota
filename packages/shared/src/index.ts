import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export type { SupabaseClient };

export function getSupabase(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

// Example types we'll grow later
export type Id = string;
export type AccountId = Id;
