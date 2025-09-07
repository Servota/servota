// apps/mobile/src/api/replacements.ts
import { supabase } from '../lib/supabase';

export type ReplacementRequest = {
  id: string;
  account_id: string;
  team_id: string;
  event_id: string;
  requester_user_id: string;
  opened_at: string | null;
  closed_at: string | null;
  status: string | null;
};

export type OpenReplacementRow = {
  request_id: string;
  event_id: string;
  account_id: string;
  account_name: string | null;
  team_id: string;
  team_name: string | null;
  label: string;
  starts_at: string;
  ends_at: string;
  requester_user_id: string;
};

export type Scope = 'all' | 'account' | 'team';

/** Open replacement requests visible to the current user, within scope. */
export async function listOpenReplacementRequests(opts: {
  scope: Scope;
  accountId?: string | null;
  teamId?: string | null;
  limit?: number;
}): Promise<OpenReplacementRow[]> {
  const { scope, accountId, teamId, limit = 50 } = opts;
  const nowIso = new Date().toISOString();

  let q = supabase
    .from('replacement_requests')
    .select(
      `
      id,
      account_id,
      team_id,
      event_id,
      requester_user_id,
      status,
      events!inner (
        id,
        label,
        starts_at,
        ends_at
      ),
      teams:team_id ( name ),
      accounts:account_id ( name )
    `
    )
    .eq('status', 'open')
    .gte('events.starts_at', nowIso)
    .order('starts_at', { ascending: true, foreignTable: 'events' })
    .limit(limit);

  if (scope === 'account' && accountId) q = q.eq('account_id', accountId);
  else if (scope === 'team' && teamId) q = q.eq('team_id', teamId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    request_id: row.id,
    event_id: row.event_id,
    account_id: row.account_id,
    account_name: row.accounts?.name ?? null,
    team_id: row.team_id,
    team_name: row.teams?.name ?? null,
    label: row.events?.label ?? 'Event',
    starts_at: row.events?.starts_at,
    ends_at: row.events?.ends_at,
    requester_user_id: row.requester_user_id,
  }));
}

/** Create a replacement request for the current user on an event they are assigned to. */
export async function openReplacementRequest(args: {
  accountId: string;
  teamId: string;
  eventId: string;
}) {
  const { accountId, teamId, eventId } = args;

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('replacement_requests')
    .insert({
      account_id: accountId,
      team_id: teamId,
      event_id: eventId,
      requester_user_id: userId,
      opened_at: new Date().toISOString(),
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return data as ReplacementRequest;
}

/** Claim a replacement as the current user via RPC (server validates eligibility). */
export async function claimReplacement(requestId: string) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase.rpc('fn_claim_replacement', {
    p_replacement_request_id: requestId,
    p_claimant_user_id: userId, // could be omitted; defaults to auth.uid()
  });

  if (error) throw error;
  return data;
}
