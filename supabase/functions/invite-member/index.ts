// @ts-nocheck
// deno-lint-ignore-file
// Records an account invite via RPC for the given email.
// No new auth users are created. Clear UI messages are returned.
// If the email is a Servota user, we send a magic login link to help them accept.
// Redirect now includes ?invited=1&account=<accountId> so the web app can flip invited→active.
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
    return new Response(
      JSON.stringify({ ok: false, code: 'method-not-allowed', message: 'Method not allowed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
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

    const userClient = createClient(PROJECT_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

    // ---- helper: find auth user by email (works even without getUserByEmail)
    async function findUserByEmail(email: string) {
      const target = email.toLowerCase();
      let page = 1;
      const perPage = 1000;
      for (let i = 0; i < 10; i++) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const arr = data?.users ?? [];
        const hit = arr.find((u: any) => String(u.email || '').toLowerCase() === target);
        if (hit) return hit;
        if (arr.length < perPage) return null;
        page += 1;
      }
      return null;
    }

    // ---- If the email belongs to an existing Servota user, check if already in this account
    const authUser = await findUserByEmail(email).catch(() => null);
    if (authUser?.id) {
      const { data: existing, error: exErr } = await adminClient
        .from('account_memberships')
        .select('id,status,role')
        .eq('account_id', accountId)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!exErr && existing) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'already-member',
            message: 'User is already a member of this account.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // ---- Record the invite (status = invited) via your RPC (RLS enforced via caller’s JWT)
    const { error: rpcErr } = await userClient.rpc('invite_account_member', {
      p_account_id: accountId,
      p_email: email,
    });
    if (rpcErr) {
      const msg = String(rpcErr.message || '');
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

    // ---- If the email belongs to a Servota user, email them a login/continue link (no account creation)
    if (authUser?.id) {
      const redirect = `${APP_URL}/auth/confirmed?invited=1&account=${encodeURIComponent(accountId)}`;
      const { error: otpErr } = await adminClient.auth.signInWithOtp({
        email,
        shouldCreateUser: false,
        options: { emailRedirectTo: redirect },
      });
      if (otpErr) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'email-send-failed',
            message: String(otpErr.message || ''),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, code: 'invited', message: 'Invitation email sent.' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // ---- Not a Servota user
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'user-not-found',
        message: 'Cannot find a Servota user with this email.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, code: 'server-error', message: String(e?.message ?? e) }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
