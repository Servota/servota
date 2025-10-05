// @ts-nocheck
// deno-lint-ignore-file
// supabase/functions/invite-member/index.ts
// Sends an account invite email via Supabase Admin API after recording the invite in DB.
// Requires secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { accountId, email } = await req.json().catch(() => ({}));
    if (!accountId || !email) {
      return new Response(JSON.stringify({ error: 'Missing accountId or email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

    // 1) User-scoped client (enforces RLS/RPC permissions)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Record the invite in DB via your existing RPC
    const { error: rpcErr } = await userClient.rpc('invite_account_member', {
      p_account_id: accountId,
      p_email: email,
    });
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2) Admin client sends the actual invite email using your configured SMTP (hello@)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: adminErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${APP_URL}/auth/confirmed?invited=1`,
    });
    if (adminErr) {
      return new Response(JSON.stringify({ error: adminErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
