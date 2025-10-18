// @ts-nocheck
// UAL Phase 3 — actions (HTML gateway, scaffold)
// Responsibilities in this scaffold:
//  - Accept ?t=<locator>
//  - Verify HMAC (same scheme as `notify`)
//  - If valid, mint a short-lived, single-purpose "action" token (JWT-like string)
//  - Serve a tiny HTML page that attempts `servota://a/<token>` deep link,
//    and shows a fallback button to continue in the browser.
// Next steps (later):
//  - Enforce single-use via public.action_tokens_used (record jti)
//  - Require/obtain a session and confirm the action where needed
//  - Execute server-side RPC once user/session is confirmed

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function b64urlUint8(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
function b64urlStr(s: string) {
  return b64urlUint8(new TextEncoder().encode(s));
}
function b64urlToUint8(s: string) {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const base64 = s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat(pad);
  const bin = atob(base64);
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

function parseLocator(t: string) {
  // format: <b64url(JSON payload)>.<b64url(sig)>
  const parts = t.split('.');
  if (parts.length !== 2) throw new Error('bad-locator-format');
  const [payB64, sigB64] = parts;
  const payloadBytes = b64urlToUint8(payB64);
  const sigBytes = b64urlToUint8(sigB64);
  const json = new TextDecoder().decode(payloadBytes);
  const payload = JSON.parse(json);
  return { payload, payloadBytes, sigBytes };
}

async function verifyLocator(t: string, secret: string) {
  const { payload, payloadBytes, sigBytes } = parseLocator(t);
  if (payload?.j !== 'locator') throw new Error('not-a-locator');
  const expected = await hmacSha256(payloadBytes, secret);
  // constant-time-ish compare
  if (expected.length !== sigBytes.length) throw new Error('bad-sig');
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected[i] ^ sigBytes[i];
  if (ok !== 0) throw new Error('bad-sig');
  return payload as {
    j: 'locator';
    n: string; // notification id
    u: string; // intended user id
    a: string; // action key, e.g., 'account_invite.accept'
    iat: number;
  };
}

function randJti() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return b64urlUint8(b);
}

async function mintActionToken(claims: Record<string, unknown>, secret: string, ttlSeconds = 300) {
  // VERY small JWT-like token: header.payload.signature (all base64url)
  const header = { alg: 'HS256', typ: 'JWT', kid: 'hmac.v1' };
  const now = Math.floor(Date.now() / 1000);
  const jti = randJti();
  const body = {
    j: 'action', // token type
    ...claims, // { n, u, a }
    iat: now,
    exp: now + ttlSeconds,
    jti,
  };
  const headerB64 = b64urlStr(JSON.stringify(header));
  const payloadB64 = b64urlStr(JSON.stringify(body));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await hmacSha256(signingInput, secret);
  const sigB64 = b64urlUint8(sig);
  return { token: `${headerB64}.${payloadB64}.${sigB64}`, jti, exp: body.exp };
}

function htmlPage(ok: boolean, message: string, token?: string) {
  const deep = token ? `servota://a/${encodeURIComponent(token)}` : '';
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Servota Actions</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 32px; }
  .card { max-width: 560px; margin: 0 auto; border: 1px solid rgba(0,0,0,.08); padding: 24px; border-radius: 12px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p  { margin: 8px 0 0; line-height: 1.5; }
  .btn { display:inline-block; margin-top:16px; padding:10px 16px; border-radius:8px; text-decoration:none; }
  .primary { background:#0ea5e9; color:#fff; }
  .muted { color: #6b7280; font-size: 12px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
</style>
<body>
  <div class="card">
    <h1>${ok ? 'Action Ready' : 'Action Link Problem'}</h1>
    <p>${message}</p>
    ${ok && token ? `<a class="btn primary" id="open" href="${deep}">Open in Servota</a>` : ''}
    ${
      ok && token
        ? `<p class="muted">If the app doesn't open, keep this tab open. We'll complete the action here.</p>`
        : ''
    }
    ${
      ok && token
        ? `<p class="muted">Token preview (for debugging):<br><code>${token}</code></p>`
        : ''
    }
  </div>
<script>
  (function(){
    const token = ${JSON.stringify(token ?? '')};
    if (!token) return;
    const url = 'servota://a/' + encodeURIComponent(token);
    // Try deep link shortly after load
    setTimeout(function(){ location.href = url; }, 300);
  })();
</script>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Accept GET or POST (query param t)
    const u = new URL(req.url);
    const t = u.searchParams.get('t') || '';
    if (!t) {
      return new Response(htmlPage(false, 'Missing action locator (?t=...)'), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
      });
    }

    const secret = Deno.env.get('ACTIONS_HMAC_SECRET') ?? 'dev-secret-change-me';
    let locator;
    try {
      locator = await verifyLocator(t, secret);
    } catch (err) {
      console.warn('UAL actions: bad/invalid locator', err);
      return new Response(
        htmlPage(false, 'This action link is invalid or has been tampered with.'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
        }
      );
    }

    // TODO (later): if action requires auth, check session via Authorization header
    // and if not present, prompt sign-in + confirmation.

    // Mint a short-lived action token (5 minutes)
    const { token /*, jti, exp */ } = await mintActionToken(
      { n: locator.n, u: locator.u, a: locator.a },
      secret,
      5 * 60
    );

    // TODO (later): record jti in public.action_tokens_used on successful execution, not here.

    return new Response(
      htmlPage(
        true,
        'Your action is ready. We’ll open the Servota app. If it doesn’t open, confirm in this tab.',
        token
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders } }
    );
  } catch (err) {
    console.error('UAL actions: unexpected error', err);
    return new Response(htmlPage(false, 'Unexpected server error.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
    });
  }
});
