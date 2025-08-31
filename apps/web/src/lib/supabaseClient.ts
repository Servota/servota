// apps/web/src/lib/supabaseClient.ts
import { getBrowserSupabaseClient } from '@servota/shared/supabaseClient';

export const supabase = getBrowserSupabaseClient();
// no-op: ensure the client is typed and callable without changing app behavior
void supabase.auth.getSession();
