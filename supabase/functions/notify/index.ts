// @ts-nocheck
// Servota notify (V1 info-only) — inserts notifications and sends branded info emails via Resend
// Now reads file-based templates from ../_shared/email/*.html with a safe inline fallback.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@3.3.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmt(dt?: string | number | Date) {
  try {
    if (!dt) return '';
    const d = new Date(dt);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  } catch {
    return '';
  }
}

/** -------- Template loading & rendering (file-based) -------- */
async function loadTemplate(name: string): Promise<string | null> {
  try {
    // Try shared folder path (repo: supabase/functions/_shared/email/*.html)
    const sharedUrl = new URL(`../_shared/email/${name}.html`, import.meta.url);
    return await Deno.readTextFile(sharedUrl);
  } catch {
    try {
      // Fallback: allow local folder (if someone later copies templates under notify/email)
      const localUrl = new URL(`./email/${name}.html`, import.meta.url);
      return await Deno.readTextFile(localUrl);
    } catch {
      return null;
    }
  }
}

function renderTemplate(tpl: string, ctx: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k) => ctx[k] ?? '');
}

/** -------- Minimal inline fallback (used only if file missing) -------- */
function htmlShell(content: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#111">
    <header style="margin-bottom:16px">
      <img src="https://servota.app/assets/email-logo.png" alt="Servota" height="28" style="vertical-align:middle" />
    </header>
    ${content}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
    <p style="font-size:12px;color:#666">
      Open the <strong>Servota</strong> app and go to <em>Notifications</em> to respond.
    </p>
  </body>
</html>`;
}

function renderInfoEmailFallback(row: any) {
  const t = row?.type ?? '';
  const d = row?.data ?? {};
  const title = row?.title ?? 'Servota update';

  if (t === 'swap_requested') {
    const toLabel = d?.to_label ?? title;
    const fromDate = fmt(d?.from_date);
    const toDate = fmt(d?.to_date);
    return htmlShell(`
      <h2 style="margin:0 0 8px">Swap request</h2>
      <p style="margin:0 0 6px"><strong>${toLabel}</strong></p>
      <p style="margin:0">Theirs: ${fromDate}</p>
      <p style="margin:0 0 12px">Yours: ${toDate}</p>
    `);
  }
  if (t === 'swap_accepted') {
    const actor = d?.actor_name ?? 'A team member';
    const when = fmt(d?.event_date);
    return htmlShell(`
      <h2 style="margin:0 0 8px">Swap accepted</h2>
      <p style="margin:0 0 6px"><strong>${title}</strong></p>
      <p style="margin:0 0 12px">${actor} accepted your swap${when ? ` for ${when}` : ''}.</p>
    `);
  }
  if (t === 'swap_declined') {
    const actor = d?.actor_name ?? 'A team member';
    return htmlShell(`
      <h2 style="margin:0 0 8px">Swap declined</h2>
      <p style="margin:0 0 6px"><strong>${title}</strong></p>
      <p style="margin:0 0 12px">${actor} declined your swap request.</p>
    `);
  }
  if (t === 'replacement_opened') {
    const evTitle = d?.event_title ?? title;
    const when = fmt(d?.event_date);
    const actor = d?.actor_name ?? 'A team member';
    return htmlShell(`
      <h2 style="margin:0 0 8px">Replacement request</h2>
      <p style="margin:0 0 6px"><strong>${evTitle}</strong>${when ? ` (${when})` : ''}</p>
      <p style="margin:0">From ${actor}</p>
    `);
  }
  if (t === 'replacement_claimed') {
    const evTitle = d?.event_title ?? title;
    const when = fmt(d?.event_date);
    const actor = d?.actor_name ?? 'A team member';
    return htmlShell(`
      <h2 style="margin:0 0 8px">Replacement filled</h2>
      <p style="margin:0 0 6px"><strong>${evTitle}</strong>${when ? ` (${when})` : ''}</p>
      <p style="margin:0 0 12px">${actor} has claimed your replacement request.</p>
    `);
  }
  if (t === 'invite_account') {
    const accountName = d?.account_name ?? '';
    return htmlShell(`
      <h2 style="margin:0 0 8px">You’ve been invited</h2>
      <p style="margin:0">Join <strong>${accountName}</strong> on Servota.</p>
    `);
  }
  if (t === 'invite_team') {
    const accountName = d?.account_name ?? '';
    const teamName = d?.team_name ?? '';
    return htmlShell(`
      <h2 style="margin:0 0 8px">Team invite</h2>
      <p style="margin:0">You’ve been invited to join the <strong>${teamName}</strong> team at <strong>${accountName}</strong>.</p>
    `);
  }
  const body = row?.body ?? 'You have a new update.';
  return htmlShell(`
    <h2 style="margin:0 0 8px">${title}</h2>
    <p style="margin:0 0 12px">${body}</p>
  `);
}

/** Map notification row → template name + context keys */
function templateMap(row: any): { name: string; ctx: Record<string, string>; subject: string } {
  const type = row?.type ?? '';
  const d = row?.data ?? {};
  const title = row?.title ?? 'Servota update';

  switch (type) {
    case 'swap_requested':
      return {
        name: 'swap_requested',
        subject: title,
        ctx: {
          to_label: d?.to_label ?? title,
          from_date: fmt(d?.from_date),
          to_date: fmt(d?.to_date),
        },
      };
    case 'swap_accepted':
      return {
        name: 'swap_accepted',
        subject: title,
        ctx: {
          event_title: title,
          actor_name: d?.actor_name ?? 'A team member',
          event_date: fmt(d?.event_date),
        },
      };
    case 'swap_declined':
      return {
        name: 'swap_declined',
        subject: title,
        ctx: {
          event_title: title,
          actor_name: d?.actor_name ?? 'A team member',
        },
      };
    case 'replacement_opened':
      return {
        name: 'replacement_opened',
        subject: title,
        ctx: {
          event_title: d?.event_title ?? title,
          event_date: fmt(d?.event_date),
          actor_name: d?.actor_name ?? 'A team member',
        },
      };
    case 'replacement_claimed':
      return {
        name: 'replacement_claimed',
        subject: title,
        ctx: {
          event_title: d?.event_title ?? title,
          event_date: fmt(d?.event_date),
          actor_name: d?.actor_name ?? 'A team member',
        },
      };
    case 'invite_account':
      return {
        name: 'invite_account',
        subject: title,
        ctx: {
          account_name: d?.account_name ?? '',
        },
      };
    case 'invite_team':
      return {
        name: 'invite_team',
        subject: title,
        ctx: {
          account_name: d?.account_name ?? '',
          team_name: d?.team_name ?? '',
        },
      };
    default:
      return { name: '', subject: title, ctx: { title, body: row?.body ?? '' } };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Only POST', { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: 'No items' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const PROJECT_URL = Deno.env.get('PROJECT_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

    const admin = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    // Insert notifications (queue)
    const { data: inserted, error: insErr } = await admin
      .from('notifications')
      .insert(
        items.map((i: any) => ({
          user_id: i.user_id,
          type: i.type,
          title: i.title ?? 'Servota update',
          body: i.body ?? '',
          data: i.data ?? {},
          channel: i.channel ?? 'email',
          status: 'queued',
          account_id: i.account_id ?? null,
          team_id: i.team_id ?? null,
          // If caller didn't specify, default to "now" so NOT NULL passes and ordering works
          scheduled_at: i.scheduled_at ?? new Date().toISOString(),
        }))
      )
      .select();

    if (insErr) throw insErr;

    const results: any[] = [];

    // Send emails (info-only, no CTAs)
    for (const row of inserted) {
      const to_email = items.find((i: any) => i.user_id === row.user_id)?.to_email;
      if (to_email) {
        try {
          const { name, ctx, subject } = templateMap(row);
          let html: string | null = null;

          if (name) {
            const tpl = await loadTemplate(name);
            if (tpl) {
              html = renderTemplate(tpl, ctx);
            }
          }

          // Fallback to inline if file missing or type unmapped
          if (!html) {
            html = renderInfoEmailFallback(row);
          }

          await resend.emails.send({
            from: EMAIL_FROM,
            to: [to_email],
            subject: subject || 'Servota update',
            html,
          });
        } catch (e) {
          console.error('Resend error', e);
        }
      }
      results.push({ id: row.id, user_id: row.user_id, type: row.type });
    }

    return new Response(JSON.stringify({ ok: true, count: inserted.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, message: String(e?.message ?? e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
