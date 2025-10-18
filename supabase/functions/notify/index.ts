// @ts-nocheck
// UAL Phase 2 — notify (skeleton)
// Purpose: accept a payload, insert notifications for targets, mint a long-lived
// "locator" string for each notification (email CTA param ?t=<locator>).
// NOTE: Email send (Postmark/Resend) will be added next step.
// Env needed (set via `supabase secrets set` later):
//   PROJECT_URL, SERVICE_ROLE_KEY
//   ACTIONS_HMAC_SECRET  (for locator signing; rotate with kid later)
//   APP_URL              (optional, for absolute links in templates)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotifyItem = {
  user_id: string; // receiver
  type: string; // e.g., 'account_invite.accept' | 'swap.accept'
  title: string;
  body: string;
  data?: Record<string, unknown>; // arbitrary JSON template vars
  channel?: string; // 'email' | 'push' | ...
  scheduled_at?: string; // ISO timestamp
};

function b64url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function signLocator(payload: Record<string, unknown>) {
  // Minimal HMAC SHA-256 signature over JSON payload
  const secret = Deno.env.get('ACTIONS_HMAC_SECRET') ?? 'dev-secret-change-me';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const body = enc.encode(JSON.stringify(payload));
  const sigBuf = await crypto.subtle.sign('HMAC', key, body);
  const sig = b64url(new Uint8Array(sigBuf));
  const pay = b64url(body);
  // “locator” = <base64url(payload)>.<base64url(signature)>
  // (Edge 'actions' function will verify before minting short-lived action token)
  return `${pay}.${sig}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, code: 'method-not-allowed', message: 'Method not allowed' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const admin = createClient(Deno.env.get('PROJECT_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);

    const { items } = (await req.json().catch(() => ({}))) as { items?: NotifyItem[] };
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, code: 'bad-request', message: 'Missing items[]' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const nowIso = new Date().toISOString();
    const rows = items.map((n) => ({
      user_id: n.user_id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ?? {},
      channel: n.channel ?? 'email',
      scheduled_at: n.scheduled_at ?? nowIso,
      status: 'queued',
      attempts: 0,
    }));

    // Insert notifications
    const { data: inserted, error: insErr } = await admin
      .from('notifications')
      .insert(rows)
      .select('id,user_id,type,title,body,data,channel,scheduled_at,created_at');
    if (insErr) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'insert-failed',
          message: String(insErr.message || insErr),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Produce locators — one per inserted row (long-lived, non-executing)
    const locators = await Promise.all(
      (inserted ?? []).map(async (r) => {
        const payload = {
          j: 'locator', // token type
          n: r.id, // notification id
          u: r.user_id, // intended user
          a: r.type, // action kind (e.g., 'account_invite.accept')
          iat: Math.floor(Date.now() / 1000),
          // Optional: exp omitted for locator (long-lived); action token will be short-lived.
        };
        const t = await signLocator(payload);
        return { id: r.id, user_id: r.user_id, type: r.type, locator: t };
      })
    );

    // NOTE: Next step we will:
    // - Choose Postmark/Resend
    // - Use a provider template id + variables (title/body/data/CTA URL with ?t=<locator>)
    // - Send one email per locator
    // For now, we just return the locators so we can wire the Actions Gateway next.

    return new Response(JSON.stringify({ ok: true, count: locators.length, locators }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, code: 'server-error', message: String(e?.message ?? e) }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
