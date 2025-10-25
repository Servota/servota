// @ts-nocheck
// notif_dispatcher (v2) — queue worker for in-app notifications + email sending (Resend).
// - Reads v_notifications_pending
// - Builds UAL CTAs for swap/replacement
// - Sends via Resend
// - Updates notifications.status to 'sent' / 'error', increments attempts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@3.3.0';

function b64u(a: Uint8Array) {
  return btoa(String.fromCharCode(...a))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
async function hmacSha256(input: Uint8Array, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, input);
  return new Uint8Array(sig);
}
async function signLocator(payload: Record<string, unknown>, secret: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await hmacSha256(bytes, secret);
  return b64u(bytes) + '.' + b64u(sig);
}

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, message: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const PROJECT_URL = Deno.env.get('PROJECT_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
  const ACTIONS_BASE_URL = Deno.env.get('ACTIONS_BASE_URL')!;
  const ACTIONS_HMAC_SECRET = Deno.env.get('ACTIONS_HMAC_SECRET')!;
  const EMAIL_PROVIDER = (Deno.env.get('EMAIL_PROVIDER') || 'resend').toLowerCase();
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

  const admin = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
  const resend = EMAIL_PROVIDER === 'resend' ? new Resend(RESEND_API_KEY) : null;

  // 1) Fetch due notifications
  const { data: rows, error: qErr } = await admin
    .from('v_notifications_pending')
    .select('*')
    .limit(50);
  if (qErr) {
    return new Response(JSON.stringify({ ok: false, message: String(qErr.message || qErr) }), {
      status: 500,
    });
  }

  const results: any[] = [];

  for (const n of rows || []) {
    // Skip if not email channel
    if ((n.channel || 'email') !== 'email') continue;

    // Resolve recipient email (auth.users)
    const { data: ures } = await admin.auth.admin
      .getUserById(n.user_id)
      .catch(() => ({ data: null }));
    const to = ures?.user?.email || null;
    if (!to) {
      await admin
        .from('notifications')
        .update({
          status: 'error',
          last_error: 'no-recipient-email',
          attempts: (n.attempts || 0) + 1,
        })
        .eq('id', n.id);
      results.push({ id: n.id, error: 'no-recipient-email' });
      continue;
    }

    // Build default locator (non-executing)
    const baseLocator = await signLocator(
      { j: 'locator', n: n.id, u: n.user_id, a: n.type, iat: Math.floor(Date.now() / 1000) },
      ACTIONS_HMAC_SECRET
    );
    const baseCta = `${ACTIONS_BASE_URL}?t=${baseLocator}`;

    // Multi-CTAs for specific types
    let cta_accept: string | null = null;
    let cta_decline: string | null = null;
    let cta_claim: string | null = null;

    if (n.type === 'swap_requested') {
      const rid = (n.data as any)?.swap_request_id || (n.data as any)?.request_id || null;
      const l1 = await signLocator(
        {
          j: 'locator',
          n: n.id,
          u: n.user_id,
          a: 'swap.accept',
          r: rid,
          iat: Math.floor(Date.now() / 1000),
        },
        ACTIONS_HMAC_SECRET
      );
      const l2 = await signLocator(
        {
          j: 'locator',
          n: n.id,
          u: n.user_id,
          a: 'swap.decline',
          r: rid,
          iat: Math.floor(Date.now() / 1000),
        },
        ACTIONS_HMAC_SECRET
      );
      cta_accept = `${ACTIONS_BASE_URL}?t=${l1}`;
      cta_decline = `${ACTIONS_BASE_URL}?t=${l2}`;
    }

    if (n.type === 'replacement_opened') {
      const rid = (n.data as any)?.replacement_request_id || (n.data as any)?.request_id || null;
      const l3 = await signLocator(
        {
          j: 'locator',
          n: n.id,
          u: n.user_id,
          a: 'replacement.claim',
          r: rid,
          iat: Math.floor(Date.now() / 1000),
        },
        ACTIONS_HMAC_SECRET
      );
      cta_claim = `${ACTIONS_BASE_URL}?t=${l3}`;
    }

    // Compose very simple HTML (you’ll brand this later)
    const html =
      cta_accept && cta_decline
        ? `
          <h2>${n.title}</h2>
          <p>${n.body}</p>
          <p>
            <a href="${cta_accept}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Accept</a>
            &nbsp;
            <a href="${cta_decline}" style="background:#ef4444;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Decline</a>
          </p>
          <p style="font-size:12px;color:#6b7280;">If the buttons don’t work, copy this URL:<br>${baseCta}</p>
        `
        : cta_claim
          ? `
          <h2>${n.title}</h2>
          <p>${n.body}</p>
          <p>
            <a href="${cta_claim}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Claim</a>
          </p>
          <p style="font-size:12px;color:#6b7280;">If the button doesn’t work, copy this URL:<br>${baseCta}</p>
        `
          : `
          <h2>${n.title}</h2>
          <p>${n.body}</p>
          <p><a href="${baseCta}" style="background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">View</a></p>
          <p style="font-size:12px;color:#6b7280;">If the button doesn’t work, copy this URL:<br>${baseCta}</p>
        `;

    try {
      if (!resend) throw new Error('No email provider configured');
      await resend.emails.send({
        from: EMAIL_FROM,
        to: [to],
        subject: n.title,
        html,
      });

      // mark sent
      await admin
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: (n.attempts || 0) + 1,
        })
        .eq('id', n.id);
      results.push({ id: n.id, sent: true });
    } catch (e: any) {
      await admin
        .from('notifications')
        .update({
          status: 'error',
          last_error: String(e?.message ?? e),
          attempts: (n.attempts || 0) + 1,
        })
        .eq('id', n.id);
      results.push({ id: n.id, error: String(e?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
