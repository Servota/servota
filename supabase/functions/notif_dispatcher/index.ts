// supabase/functions/notif_dispatcher/index.ts
// Sends real push notifications via Expo Push API (no legacy server key needed for V1).
// Requires: push tokens in `push_tokens` and queued rows in `notifications` (via v_notifications_pending).

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// race-safe claim
async function claimNotification(id: string) {
  const { data, error } = await admin
    .from('notifications')
    .update({
      status: 'sending',
      attempts: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'queued')
    .lte('scheduled_at', new Date().toISOString())
    .select('*')
    .single();
  if (error) return { claimed: false, error };
  return { claimed: !!data, row: data };
}

async function sendExpoPush(messages: Array<Record<string, unknown>>) {
  // Expo allows up to 100 messages per call
  const chunks: Array<typeof messages> = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  const results: Array<{ ok: boolean; data?: unknown; error?: unknown }> = [];
  for (const chunk of chunks) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      results.push({ ok: false, error: `http ${res.status}` });
      continue;
    }
    const json = await res.json().catch(() => ({}));
    results.push({ ok: true, data: json });
  }
  return results;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const isPost = req.method === 'POST';
  const body = isPost ? await req.json().catch(() => ({})) : {};
  const limitRaw = (body.limit ?? url.searchParams.get('limit') ?? 10) as number | string;
  const dryRun = (body.dry_run ?? url.searchParams.get('dry_run') ?? 'false').toString() === 'true';
  const limit = Math.max(1, Math.min(50, Number(limitRaw)));

  // fetch due notifications
  const { data: pending, error: fetchErr } = await admin
    .from('v_notifications_pending')
    .select('*')
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (fetchErr) {
    console.error('fetch pending error:', fetchErr);
    return new Response(JSON.stringify({ ok: false, error: 'fetch_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const logs: Array<Record<string, unknown>> = [];

  for (const n of pending ?? []) {
    const claim = await claimNotification(n.id);
    if (!claim.claimed) {
      logs.push({ id: n.id, skip: 'lost_race' });
      continue;
    }
    processed++;

    try {
      if (dryRun) {
        await admin
          .from('notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', n.id);
        sent++;
        logs.push({ id: n.id, dryRun: true });
        continue;
      }

      if (n.channel === 'push') {
        // tokens for recipient
        const { data: tokens, error: tokErr } = await admin
          .from('push_tokens')
          .select('token')
          .eq('user_id', n.user_id)
          .eq('status', 'active');

        if (tokErr) throw tokErr;

        const tokenList = (tokens ?? []).map((t) => t.token);
        if (tokenList.length === 0) {
          await admin
            .from('notifications')
            .update({ status: 'failed', last_error: 'no_active_push_tokens' })
            .eq('id', n.id);
          failed++;
          logs.push({ id: n.id, failed: 'no_active_push_tokens' });
          continue;
        }

        // build Expo messages
        const messages = tokenList.map((to) => ({
          to,
          title: n.title ?? 'Servota',
          body: n.body ?? '',
          data: n.data ?? {},
          sound: null,
          // for SDK 53, channel setup later; basic delivery now
        }));

        const results = await sendExpoPush(messages);
        const anyError = results.some((r) => !r.ok);

        if (anyError) {
          await admin
            .from('notifications')
            .update({
              status: 'failed',
              last_error: JSON.stringify(results),
              updated_at: new Date().toISOString(),
            })
            .eq('id', n.id);
          failed++;
          logs.push({ id: n.id, failed: 'expo_push_error', results });
        } else {
          await admin
            .from('notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', n.id);
          sent++;
          logs.push({ id: n.id, sent: true, tokens: tokenList.length });
        }
      } else if (n.channel === 'email') {
        // future: integrate provider
        await admin
          .from('notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', n.id);
        sent++;
      } else {
        await admin
          .from('notifications')
          .update({
            status: 'failed',
            last_error: `unsupported_channel:${n.channel}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', n.id);
        failed++;
      }
    } catch (err) {
      console.error('dispatch error', { id: n.id, err: String(err) });
      await admin
        .from('notifications')
        .update({
          status: 'failed',
          last_error: String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', n.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, sent, failed, limit, dryRun, logs }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
