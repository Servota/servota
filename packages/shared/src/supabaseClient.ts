// packages/shared/src/supabaseClient.ts
// Minimal, typed Supabase client wrapper shared by web & mobile.
// No new deps. Uses @supabase/supabase-js which should already be in the workspace.

import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import type { Database } from './types/supabase';

// Convenience type for our typed client
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Factory: create a typed Supabase client with explicit URL/Key.
 * Use this in apps that pass config from env.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<'public'>
): TypedSupabaseClient {
  if (!url || !anonKey) {
    throw new Error('createSupabaseClient: url and anonKey are required');
  }
  return createClient<Database>(url, anonKey, options);
}

/**
 * Browser-only helper: reads Vite/Expo env and returns a singleton client.
 * - Web (Vite): VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * - Mobile (Expo): EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
let _browserClient: TypedSupabaseClient | null = null;

export function getBrowserSupabaseClient(
  options?: SupabaseClientOptions<'public'>
): TypedSupabaseClient {
  // @ts-ignore - import.meta.env exists in bundlers; fallback to globalThis for safety.
  const VITE = typeof import.meta !== 'undefined' ? ((import.meta as any).env ?? {}) : {};
  const G = globalThis as any;

  const url = VITE.VITE_SUPABASE_URL ?? G.VITE_SUPABASE_URL ?? G.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anon =
    VITE.VITE_SUPABASE_ANON_KEY ??
    G.VITE_SUPABASE_ANON_KEY ??
    G.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';

  if (!url || !anon) {
    throw new Error('getBrowserSupabaseClient: Supabase env vars are missing');
  }

  if (!_browserClient) {
    _browserClient = createClient<Database>(url, anon, options);
  }
  return _browserClient;
}

/**
 * Auth helper: current session (or null). Throws on transport errors.
 */
export async function getSession(client: TypedSupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}
