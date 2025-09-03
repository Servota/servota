// apps/mobile/src/api/roster.ts
import { supabase } from '../lib/supabase';

export type Scope = 'all' | 'account' | 'team';

export type MyAssignment = {
  assignment_id: string;
  assignment_status: string | null;
  event_id: string;
  template_id: string | null;
  account_id: string;
  account_name: string | null;
  team_id: string;
  team_name: string | null;
  label: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
};

export async function getMyUpcomingAssignments(opts: {
  scope: Scope;
  accountId?: string | null;
  teamId?: string | null;
  limit?: number;
}): Promise<MyAssignment[]> {
  const { scope, accountId, teamId, limit = 50 } = opts;

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const nowIso = new Date().toISOString();

  let q = supabase
    .from('assignments')
    .select(
      `
      id,
      status,
      account_id,
      team_id,
      event_id,
      events!inner (
        id,
        label,
        starts_at,
        ends_at,
        template_id
      ),
      teams:team_id ( name ),
      accounts:account_id ( name )
    `
    )
    .eq('user_id', userId)
    .gte('events.starts_at', nowIso)
    .order('starts_at', { ascending: true, foreignTable: 'events' })
    .limit(limit);

  if (scope === 'account' && accountId) q = q.eq('account_id', accountId);
  else if (scope === 'team' && teamId) q = q.eq('team_id', teamId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    assignment_id: row.id,
    assignment_status: row.status ?? null,
    event_id: row.event_id,
    template_id: row.events?.template_id ?? null,
    account_id: row.account_id,
    account_name: row.accounts?.name ?? null,
    team_id: row.team_id,
    team_name: row.teams?.name ?? null,
    label: row.events?.label ?? 'Event',
    starts_at: row.events?.starts_at,
    ends_at: row.events?.ends_at,
  }));
}
