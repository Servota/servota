// apps/web/src/member/MyMemberships.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type AccountMembership = {
  account_id: string;
  account_name: string;
  role: 'owner' | 'admin' | 'member' | string;
  account_description?: string | null;
};

type TeamMembership = {
  team_id: string;
  team_name: string;
  role: 'scheduler' | 'member' | string;
  team_description?: string | null;
};

type Props = {
  onManageAccount?: any; // (accountId: string, accountName: string)
  onManageTeam?: any; // (teamId: string, teamName: string, accountId: string, accountName: string)
};

export default function MyMemberships({ onManageAccount, onManageTeam }: Props) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teamsByAccount, setTeamsByAccount] = useState<
    Record<string, TeamMembership[] | undefined>
  >({});

  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getUserId = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error('Not signed in');
    return userId;
  }, [supabase]);

  const loadAccounts = useCallback(async () => {
    setError(null);
    try {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('account_memberships')
        .select('account_id, role, status, accounts:account_id ( name )')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows: AccountMembership[] = (data ?? []).map((r: any) => ({
        account_id: r.account_id as string,
        role: (r.role ?? 'member') as AccountMembership['role'],
        account_name: r.accounts?.name ?? 'Unknown',
      }));
      setAccounts(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load memberships');
      setAccounts([]);
      setTeamsByAccount({});
    } finally {
      setHasLoadedOnce(true);
    }
  }, [getUserId, supabase]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAccounts();
    setIsRefreshing(false);
  }, [loadAccounts]);

  const ensureTeamsLoaded = useCallback(
    async (accountId: string) => {
      if (teamsByAccount[accountId] !== undefined) return;
      try {
        const userId = await getUserId();
        const { data, error } = await supabase
          .from('team_memberships')
          .select('team_id, role, status, teams:team_id ( name )')
          .eq('user_id', userId)
          .eq('account_id', accountId)
          .eq('status', 'active')
          .order('created_at', { ascending: true });
        if (error) throw error;

        const rows: TeamMembership[] = (data ?? []).map((r: any) => ({
          team_id: r.team_id as string,
          role: (r.role ?? 'member') as TeamMembership['role'],
          team_name: r.teams?.name ?? 'Unknown',
        }));
        setTeamsByAccount((prev) => ({ ...prev, [accountId]: rows }));
      } catch {
        setTeamsByAccount((prev) => ({ ...prev, [accountId]: [] }));
      }
    },
    [getUserId, supabase, teamsByAccount]
  );

  const toggleAccount = (account: AccountMembership) => {
    const willExpand = expandedAccountId !== account.account_id;
    setExpandedTeamIds(new Set());
    setExpandedAccountId(willExpand ? account.account_id : null);
    if (willExpand) void ensureTeamsLoaded(account.account_id);
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const list = (accounts ?? []) as AccountMembership[];
  const totalTeams = Object.values(teamsByAccount).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  return (
    <section className="sv-page">
      <div className="sv-card p-4">
        <h2 className="sv-h1">My Memberships</h2>
        <p className="sv-meta">Tap an account to view details and your teams in that account.</p>
        {error ? (
          <p className="sv-meta" style={{ color: '#c00' }}>
            {error}
          </p>
        ) : null}
        <div className="mt-2">
          <button
            className="sv-btn"
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!hasLoadedOnce ? <div className="sv-meta mt-2">Loading...</div> : null}

      <div className="mt-3 space-y-2">
        {list.map((a) => {
          const expanded = expandedAccountId === a.account_id;
          const teams = teamsByAccount[a.account_id];
          const canManageAccount = a.role === 'owner' || a.role === 'admin';

          return (
            <div key={a.account_id} className="sv-card p-3">
              {/* Account header (title + small Manage button on the right) */}
              <div
                className="sv-card-row items-center justify-between"
                onClick={() => toggleAccount(a)}
                role="button"
                aria-expanded={expanded}
                aria-controls={`account-${a.account_id}-panel`}
              >
                <div className="pr-3 flex-1">
                  <div className="font-semibold text-[#111]">{a.account_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="sv-meta">Account role</span>
                    <span
                      className="text-xs font-extrabold rounded-md px-2 py-1"
                      style={{ backgroundColor: '#eef1f5', color: '#111' }}
                    >
                      {a.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 rounded-[8px] text-sm font-semibold border"
                    style={{
                      background: canManageAccount ? '#fff' : '#f3f4f6',
                      borderColor: '#e5e7eb',
                      color: '#111',
                      opacity: canManageAccount ? 1 : 0.6,
                      cursor: canManageAccount ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!canManageAccount}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canManageAccount) onManageAccount?.(a.account_id, a.account_name);
                    }}
                  >
                    Manage Account
                  </button>

                  <div className="text-sm font-bold text-[#111]" aria-hidden>
                    {expanded ? 'v' : '>'}
                  </div>
                </div>
              </div>

              {/* Expanded account content */}
              {expanded && (
                <div id={`account-${a.account_id}-panel`} className="mt-3 space-y-3">
                  {/* Account details sub-card */}
                  <div
                    className="rounded-xl border p-3"
                    style={{ borderColor: '#ececec', background: '#fff' }}
                  >
                    {a.account_description ? (
                      <div className="text-sm text-[#111]">{a.account_description}</div>
                    ) : (
                      <div className="sv-meta">
                        Account details coming soon (description, contacts, policies).
                      </div>
                    )}
                  </div>

                  {/* Section bar */}
                  <div
                    className="rounded-lg border"
                    style={{ backgroundColor: '#f3f4f6', borderColor: '#ececec' }}
                  >
                    <div className="text-sm font-extrabold text-[#111] tracking-wide px-3 py-1.5">
                      Teams
                    </div>
                  </div>

                  {teams === undefined ? (
                    <div className="sv-meta">Loading teams...</div>
                  ) : teams.length === 0 ? (
                    <div className="sv-meta">No team memberships in this account.</div>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((t) => {
                        const isOpen = expandedTeamIds.has(t.team_id);
                        // now only schedulers can manage teams (admins cannot override)
                        const canManageTeam = t.role === 'scheduler';

                        return (
                          <div
                            key={t.team_id}
                            className="rounded-xl border p-3"
                            style={{ borderColor: '#ececec', background: '#fff' }}
                          >
                            <div
                              className="flex items-center"
                              onClick={() => toggleTeam(t.team_id)}
                              role="button"
                              aria-expanded={isOpen}
                              aria-controls={`team-${t.team_id}-panel`}
                            >
                              <div className="flex-1 pr-3">
                                <div className="text-sm font-bold text-[#111]">{t.team_name}</div>
                              </div>

                              {/* role chip */}
                              <span
                                className="text-xs font-extrabold rounded-full px-2.5 py-1"
                                style={{ backgroundColor: '#eef1f5', color: '#111' }}
                              >
                                {t.role}
                              </span>

                              {/* Manage Team button */}
                              <button
                                className="ml-2 px-2 py-1 rounded-[8px] text-sm font-semibold border"
                                style={{
                                  background: canManageTeam ? '#fff' : '#f3f4f6',
                                  borderColor: '#e5e7eb',
                                  color: '#111',
                                  opacity: canManageTeam ? 1 : 0.6,
                                  cursor: canManageTeam ? 'pointer' : 'not-allowed',
                                }}
                                disabled={!canManageTeam}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canManageTeam)
                                    onManageTeam?.(
                                      t.team_id,
                                      t.team_name,
                                      a.account_id,
                                      a.account_name
                                    );
                                }}
                              >
                                Manage Team
                              </button>

                              <div className="text-sm font-bold text-[#111] ml-2" aria-hidden>
                                {isOpen ? 'v' : '>'}
                              </div>
                            </div>

                            {isOpen && (
                              <div id={`team-${t.team_id}-panel`} className="pt-2">
                                {t.team_description ? (
                                  <div className="text-xs text-[#444]">{t.team_description}</div>
                                ) : (
                                  <div className="sv-meta">Team description coming soon.</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Array.isArray(accounts) ? (
        <div className="sv-meta text-center mt-3">
          Total: {accounts.length} accounts - {totalTeams} teams
        </div>
      ) : null}
    </section>
  );
}
