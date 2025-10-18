// @ts-nocheck
// UAL Phase 2 — notify (provider-ready scaffold)
// - Inserts notification rows
// - Signs long-lived "locator" for each notification
// - If EMAIL_PROVIDER + envs + to_email are present, sends a simple email (fallback content)
// Templates will be handled in Phase 5; for now it's a minimal CTA email.
//
// Env (set later with `supabase secrets set`):
//   PROJECT_URL
//   SERVICE_ROLE_KEY
//   ACTIONS_HMAC_SECRET                 // for locator signing (rotate later with kid)
//   ACTIONS_BASE_URL    (e.g. https://<project-ref>.functions.supabase.co/actions)
//
// Optional email wiring (skips if unset or item lacks to_email):
//   EMAIL_PROVIDER      ('postmark' | 'resend')
//   EMAIL_FROM          (e.g., 'Servota <no-reply@servota.app>')
//   POSTMARK_TOKEN      (required if EMAIL_PROVIDER=postmark)
//   RESEND_API_KEY      (required if EMAIL_PROVIDER=resend)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotifyItem = {
  user_id: string; // receiver (Servota user id)
  type: string; // e.g., 'account_invite.accept' | 'swap.accept' | 'swap.decline'
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: string; // 'email' | 'push' | ...
  scheduled_at?: string; // ISO timestamp
  to_email?: string; // Optional for Phase 2 (lets us email without a profile lookup)
};

function b64url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function signLocator(payload: Record<string, unknown>) {
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
  return `${pay}.${sig}`;
}

function buildCtaUrl(locator: string) {
  const base = Deno.env.get('ACTIONS_BASE_URL') ?? '';
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set('t', locator);
  return u.toString();
}

// --- Email providers (minimal send for Phase 2)

async function sendViaPostmark(
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string
) {
  const token = Deno.env.get('POSTMARK_TOKEN');
  if (!token) throw new Error('POSTMARK_TOKEN not set');
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({ From: from, To: to, Subject: subject, HtmlBody: html, TextBody: text }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`postmark: ${res.status} ${msg}`);
  }
  return await res.json().catch(() => ({}));
}

async function sendViaResend(
  to: string,
  from: string,
  subject: string,
  html: string,
  text: string
) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`resend: ${res.status} ${msg}`);
  }
  return await res.json().catch(() => ({}));
}

async function maybeSendEmail(
  to_email: string | undefined,
  title: string,
  body: string,
  ctaUrl: string | null
) {
  if (!to_email) return { sent: false, reason: 'no-to-email' };

  const provider = (Deno.env.get('EMAIL_PROVIDER') || '').toLowerCase();
  const from = Deno.env.get('EMAIL_FROM') || 'Servota <no-reply@servota.app>';

  if (!provider) return { sent: false, reason: 'provider-not-configured' };

  // Simple fallback content for Phase 2; proper templates in Phase 5.
  const subject = title;
  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
      <p style="margin:0 0 16px">${escapeHtml(body)}</p>
      ${
        ctaUrl
          ? `<p><a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">Open in Servota</a></p>`
          : `<p style="color:#b45309">No ACTIONS_BASE_URL configured; CTA omitted.</p>`
      }
      <p style="margin-top:24px;color:#6b7280">If the button doesn’t work, paste this URL into your browser:<br>${ctaUrl || '(not available)'}</p>
    </div>
  `;
  const text = `${title}\n\n${body}\n\n${ctaUrl ? 'Open: ' + ctaUrl : 'No CTA available'}`;

  try {
    if (provider === 'postmark') {
      const r = await sendViaPostmark(to_email, from, subject, html, text);
      return { sent: true, provider, id: r?.MessageID ?? null };
    }
    if (provider === 'resend') {
      const r = await sendViaResend(to_email, from, subject, html, text);
      return { sent: true, provider, id: r?.id ?? null };
    }
    return { sent: false, reason: 'unknown-provider' };
  } catch (e) {
    return { sent: false, reason: String(e?.message ?? e) };
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

    // Create locators + (optional) email each
    const results = [];
    for (let i = 0; i < inserted.length; i++) {
      const r = inserted[i];
      const payload = {
        j: 'locator',
        n: r.id, // notification id
        u: r.user_id, // intended user
        a: r.type, // action kind (e.g., 'account_invite.accept')
        iat: Math.floor(Date.now() / 1000),
      };
      const locator = await signLocator(payload);
      const cta = buildCtaUrl(locator);

      const item = items[i] || {};
      const to_email = item.to_email;
      const sendInfo = await maybeSendEmail(to_email, r.title, r.body, cta);

      results.push({ id: r.id, user_id: r.user_id, type: r.type, locator, cta, email: sendInfo });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
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
