// apps/mobile/src/api/events.ts
import { supabase } from '../lib/supabase';

export type EventRow = {
  event_id: string;
  account_id: string;
  team_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
};

export type Scope = 'all' | 'account' | 'team';

export async function getUpcomingEvents(opts: {
  scope: Scope;
  accountId?: string | null;
  teamId?: string | null;
  limit?: number;
}): Promise<EventRow[]> {
  const { scope, accountId, teamId, limit = 50 } = opts;
  const nowIso = new Date().toISOString();

  let q = supabase
    .from('events')
    .select('id, account_id, team_id, label, starts_at, ends_at')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (scope === 'account' && accountId) q = q.eq('account_id', accountId);
  else if (scope === 'team' && teamId) q = q.eq('team_id', teamId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    event_id: e.id,
    account_id: e.account_id,
    team_id: e.team_id,
    label: e.label ?? 'Event',
    starts_at: e.starts_at,
    ends_at: e.ends_at,
  }));
}

/** Upcoming events from the same template/series */
export async function getUpcomingEventsByTemplate(
  templateId: string,
  limit = 20
): Promise<EventRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('id, account_id, team_id, label, starts_at, ends_at, template_id')
    .eq('template_id', templateId)
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    event_id: e.id,
    account_id: e.account_id,
    team_id: e.team_id,
    label: e.label ?? 'Event',
    starts_at: e.starts_at,
    ends_at: e.ends_at,
  }));
}
