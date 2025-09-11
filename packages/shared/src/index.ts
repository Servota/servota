// packages/shared/src/index.ts

// Back-compat helper (optional)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export type { SupabaseClient };
export function getSupabase(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

// Primary exports used by apps
export * from './supabaseClient'; // getBrowserSupabaseClient, createSupabaseClient, getSession, types
export * from './context';         // setContext, getContext, clearContext, requireAccountId, etc.
// (You can also export other shared utilities as needed)
// export * from './datetime';
