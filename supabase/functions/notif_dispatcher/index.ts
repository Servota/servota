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

// Helper: claim one queued notification by id (race-safe via WHERE status='queued')
async function claimNotification(id: string) {
  const { data, error } = await admin
    .from('notifications')
    .update({
      status: 'sending',
      attempts: 1, // simple baseline; we’re not incrementing atomically yet
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

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isPost = req.method === 'POST';
  const body = isPost ? await req.json().catch(() => ({})) : {};
  const limitRaw = (body.limit ?? url.searchParams.get('limit') ?? 10) as number | string;
  const dryRun = (body.dry_run ?? url.searchParams.get('dry_run') ?? 'false').toString() === 'true';
  const limit = Math.max(1, Math.min(50, Number(limitRaw)));

  // Fetch pending notifications (visible via view)
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
    // Claim (skip if someone else grabbed it)
    const claim = await claimNotification(n.id);
    if (!claim.claimed) {
      logs.push({ id: n.id, skip: 'not_queued_anymore' });
      continue;
    }
    processed++;

    try {
      if (dryRun) {
        // Don’t deliver, just mark sent in logs
        logs.push({ id: n.id, dryRun: true, channel: n.channel, user_id: n.user_id });
        // Mark as sent without external call (dry-run sets back to queued? we’ll mark sent to unblock queue in dev)
        await admin
          .from('notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', n.id);
        sent++;
        continue;
      }

      if (n.channel === 'push') {
        // Look up active push tokens
        const { data: tokens, error: tokErr } = await admin
          .from('push_tokens')
          .select('token')
          .eq('user_id', n.user_id)
          .eq('status', 'active');

        if (tokErr) throw tokErr;
        const tokenList = (tokens ?? []).map((t) => t.token);
        if (tokenList.length === 0) {
          // No tokens — mark failed
          await admin
            .from('notifications')
            .update({
              status: 'failed',
              last_error: 'no_active_push_tokens',
              updated_at: new Date().toISOString(),
            })
            .eq('id', n.id);
          failed++;
          logs.push({ id: n.id, failed: 'no_active_push_tokens' });
          continue;
        }

        // TODO: integrate Expo Push later. For now, simulate success.
        console.log('Simulated push', { id: n.id, to: tokenList, title: n.title });

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
      } else if (n.channel === 'email') {
        // TODO: integrate email provider later; mark sent for now
        await admin
          .from('notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', n.id);
        sent++;
        logs.push({ id: n.id, sent: true, via: 'email' });
      } else {
        // Unknown channel — fail
        await admin
          .from('notifications')
          .update({
            status: 'failed',
            last_error: `unsupported_channel:${n.channel}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', n.id);
        failed++;
        logs.push({ id: n.id, failed: 'unsupported_channel' });
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

  const res = {
    ok: true,
    processed,
    sent,
    failed,
    limit,
    dryRun,
    countPendingFetched: pending?.length ?? 0,
    logs,
  };
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
