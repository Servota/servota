// @ts-nocheck
// deno-lint-ignore-file
// Records an account invite via RPC, then emails an access link for EXISTING users only.
// No new auth users are created. Clear messages are returned for UI.
//
// Env secrets required (set with `supabase secrets set`):
//   PROJECT_URL, ANON_KEY, SERVICE_ROLE_KEY, APP_URL

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
    return new Response(JSON.stringify({ ok: false, message: 'Method not allowed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { accountId, email } = await req.json().catch(() => ({}));

    if (!accountId || !email) {
      return new Response(
        JSON.stringify({ ok: false, code: 'bad-request', message: 'Missing accountId or email' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const PROJECT_URL = Deno.env.get('PROJECT_URL')!;
    const ANON_KEY = Deno.env.get('ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
    const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

    // 1) Record the invite in your DB (RLS enforced via caller’s JWT).
    const userClient = createClient(PROJECT_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { error: rpcErr } = await userClient.rpc('invite_account_member', {
      p_account_id: accountId,
      p_email: email,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message || '');
      // Normalize a common case for UX:
      if (/already.*member/i.test(msg) || /duplicate/i.test(msg)) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'already-member',
            message: 'User is already a member of this account.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      return new Response(JSON.stringify({ ok: false, code: 'invite-failed', message: msg }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2) Email a login/continue link ONLY if the user already exists in Auth.
    // Use signInWithOtp with shouldCreateUser:false so no new auth users are created.
    const serverClient = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
    const { error: otpErr } = await serverClient.auth.signInWithOtp({
      email,
      shouldCreateUser: false,
      options: { emailRedirectTo: `${APP_URL}/auth/confirmed?invited=1` },
    });

    if (otpErr) {
      const msg = String(otpErr.message || '');
      if (/not.*found/i.test(msg) || /user.*not.*found/i.test(msg)) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'user-not-found',
            message: 'Cannot find a Servota user with this email.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      // Any other OTP/mailer error:
      return new Response(JSON.stringify({ ok: false, code: 'email-send-failed', message: msg }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, code: 'invited', message: 'Invitation email sent.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, code: 'server-error', message: String(e?.message ?? e) }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
