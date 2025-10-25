// @ts-nocheck
// Servota UAL — Actions Gateway (email CTA executor)
// Executes actions without JWT (link is HMAC-signed and single-use).
//
// Supported actions encoded in the locator payload "a":
//   - 'swap.accept'        -> accept_and_apply_swap_as(p_user_id, p_swap_request_id)
//   - 'swap.decline'       -> respond_swap_as(p_user_id, p_swap_request_id, 'decline')
//   - 'replacement.claim'  -> claim_replacement_as(p_user_id, p_replacement_request_id)
//
// Also records single-use in public.action_tokens_used (jti = base64url(payload))
// and persists the outcome chip via mark_notification_outcome(p_id, p_outcome).
//
// Required env:
//   PROJECT_URL, SERVICE_ROLE_KEY, ACTIONS_HMAC_SECRET
//
// Optional deep link: servota://a/<summary>

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------- tiny utils ----------
function b64uToBytes(s: string) {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
function page(title: string, msg: string, ok = true, deepToken = '') {
  const deep = deepToken ? `servota://a/${encodeURIComponent(deepToken)}` : '';
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
:root{ color-scheme: light dark; }
body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; padding:32px; }
.card{ max-width:560px; margin:0 auto; border:1px solid rgba(0,0,0,.1); padding:24px; border-radius:12px; }
.h1{ font-size:20px; font-weight:700; margin:0 0 8px; }
.p{ margin:8px 0 0; line-height:1.5; }
.btn{ display:inline-block; margin-top:16px; padding:10px 16px; border-radius:8px; text-decoration:none; }
.ok{ background:#10b981; color:#fff; }
.err{ background:#ef4444; color:#fff; }
.muted{ color:#6b7280; font-size:12px; margin-top:8px; }
</style>
<body>
  <div class="card">
    <div class="h1">${ok ? 'Action completed' : 'Action could not be completed'}</div>
    <div class="p">${msg}</div>
    ${deep ? `<a class="btn ok" href="${deep}">Open Servota</a>` : ''}
    <div class="muted">You can close this tab.</div>
  </div>
  <script>
    (function(){
      var t=${JSON.stringify(deepToken)};
      if(!t) return;
      setTimeout(function(){ location.href='servota://a/'+encodeURIComponent(t); }, 300);
    })();
  </script>
</body></html>`;
}

async function verifyLocator(t: string, secret: string) {
  const [payB64, sigB64] = (t || '').split('.');
  if (!payB64 || !sigB64) throw new Error('bad-locator-format');
  const payloadBytes = b64uToBytes(payB64);
  const sigBytes = b64uToBytes(sigB64);
  const expected = await hmacSha256(payloadBytes, secret);
  if (expected.length !== sigBytes.length) throw new Error('bad-sig');
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ sigBytes[i];
  if (diff !== 0) throw new Error('bad-sig');
  const json = new TextDecoder().decode(payloadBytes);
  const payload = JSON.parse(json);
  if (payload?.j !== 'locator') throw new Error('not-a-locator');
  return { payload, payB64 };
}

async function recordSingleUse(admin: any, jti: string, uid: string | null) {
  const { error } = await admin
    .from('action_tokens_used')
    .insert({ jti, used_by: uid ?? null })
    .select('jti');
  if (error && /duplicate key|primary key/i.test(String(error.message))) {
    const err: any = new Error('used');
    err.code = 'used';
    throw err;
  }
  if (error) throw error;
}

// ---------- HTTP handler ----------
serve(async (req) => {
  // preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const t = url.searchParams.get('t') || '';

    const secret = Deno.env.get('ACTIONS_HMAC_SECRET') ?? 'dev-secret-change-me';
    const PROJECT_URL = Deno.env.get('PROJECT_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

    if (!t) {
      return new Response(page('Servota Actions', 'Missing action locator.', false), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // verify + extract payload
    let wrap;
    try {
      wrap = await verifyLocator(t, secret);
    } catch {
      return new Response(
        page('Servota Actions', 'This link is invalid or has been tampered with.', false),
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    const { payload, payB64 } = wrap;
    const notifId = payload?.n as string | undefined; // notification id
    const userId = payload?.u as string | undefined; // actor (email recipient)
    const action = payload?.a as string | undefined; // action key
    const reqId = payload?.r as string | undefined; // swap/replacement id

    if (!notifId || !userId || !action) {
      return new Response(page('Servota Actions', 'This link is missing required data.', false), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const admin = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

    // single-use check
    try {
      await recordSingleUse(admin, payB64, userId);
    } catch (e: any) {
      const msg =
        e?.code === 'used'
          ? 'This action link has already been used.'
          : 'Could not validate this link at the moment.';
      return new Response(page('Servota Actions', msg, false), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // execute
    let outcomeSummary = '';
    let successMsg = 'Done! You can close this tab.';

    try {
      if (action === 'swap.accept') {
        const { error } = await admin.rpc('accept_and_apply_swap_as', {
          p_user_id: userId,
          p_swap_request_id: reqId,
        });
        if (error) throw error;
        await admin.rpc('mark_notification_outcome', { p_id: notifId, p_outcome: 'accept' });
        outcomeSummary = 'swap.accepted';
        successMsg = 'Thanks — your swap has been accepted.';
      } else if (action === 'swap.decline') {
        const { error } = await admin.rpc('respond_swap_as', {
          p_user_id: userId,
          p_swap_request_id: reqId,
          p_action: 'decline',
        });
        if (error) throw error;
        await admin.rpc('mark_notification_outcome', { p_id: notifId, p_outcome: 'decline' });
        outcomeSummary = 'swap.declined';
        successMsg = 'Thanks — your swap request was declined.';
      } else if (action === 'replacement.claim') {
        const { error } = await admin.rpc('claim_replacement_as', {
          p_user_id: userId,
          p_replacement_request_id: reqId,
        });
        if (error) throw error;
        await admin.rpc('mark_notification_outcome', { p_id: notifId, p_outcome: 'claim' });
        outcomeSummary = 'replacement.claimed';
        successMsg = 'Thanks — you have claimed this replacement.';
      } else {
        return new Response(page('Servota Actions', 'Unknown action.', false), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    } catch (e: any) {
      // show friendly DB error back to the user
      const msg = String(e?.message ?? 'Action failed.');
      return new Response(page('Servota Actions', msg, false), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // success page (+ deep link attempt)
    const deepToken = outcomeSummary ? `${outcomeSummary}:${notifId}` : '';
    return new Response(page('Servota Actions', successMsg, true, deepToken), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response(page('Servota Actions', 'Unexpected error.', false), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});
