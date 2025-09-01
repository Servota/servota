// apps/mobile/src/api/memberships.ts
import { supabase } from '../lib/supabase';

export type AccountMembership = {
  account_id: string;
  account_name: string;
  role: string;
};

export type TeamMembership = {
  team_id: string;
  team_name: string;
  role: string;
};

/** Current user's account memberships with account names */
export async function getMyAccountMemberships(): Promise<AccountMembership[]> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('account_memberships')
    .select('account_id, role, accounts:account_id ( name )')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    account_id: r.account_id,
    role: r.role,
    account_name: r.accounts?.name ?? 'Unknown',
  }));
}

/** Current user's team memberships (within an account) with team names */
export async function getMyTeamMemberships(accountId: string): Promise<TeamMembership[]> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('team_memberships')
    .select('team_id, role, teams:team_id ( name )')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    team_id: r.team_id,
    role: r.role,
    team_name: r.teams?.name ?? 'Unknown',
  }));
}
