// apps/web/src/member/MyMemberships.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type AccountMembership = {
  account_id: string;
  account_name: string;
  role: string;
  // optional text if you later add it
  account_description?: string | null;
};

type TeamMembership = {
  team_id: string;
  team_name: string;
  role: string;
  team_description?: string | null;
};

export default function MyMemberships() {
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
        .select('account_id, role, accounts:account_id ( name )')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = (data ?? []).map((r: any) => ({
        account_id: r.account_id as string,
        role: r.role as string,
        account_name: r.accounts?.name ?? 'Unknown',
      })) as AccountMembership[];

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
          .select('team_id, role, teams:team_id ( name )')
          .eq('user_id', userId)
          .eq('account_id', accountId)
          .eq('status', 'active')
          .order('created_at', { ascending: true });

        if (error) throw error;

        const rows = (data ?? []).map((r: any) => ({
          team_id: r.team_id as string,
          role: r.role as string,
          team_name: r.teams?.name ?? 'Unknown',
        })) as TeamMembership[];

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
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {!hasLoadedOnce ? <div className="sv-meta mt-2">Loading…</div> : null}

      <div className="mt-3 space-y-2">
        {list.map((a) => {
          const expanded = expandedAccountId === a.account_id;
          const teams = teamsByAccount[a.account_id];

          return (
            <div key={a.account_id} className="sv-card p-3">
              <div
                className="sv-card-row items-center justify-between cursor-pointer"
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
                <div className="text-sm font-bold text-[#111]" aria-hidden>
                  {expanded ? '▾' : '▸'}
                </div>
              </div>

              {expanded && (
                <div id={`account-${a.account_id}-panel`} className="mt-3 space-y-3">
                  {a.account_description ? (
                    <div className="text-sm text-[#111]">{a.account_description}</div>
                  ) : (
                    <div className="sv-meta">
                      Account details coming soon (description, contacts, policies).
                    </div>
                  )}

                  <div
                    className="rounded-lg border"
                    style={{ backgroundColor: '#f3f4f6', borderColor: '#ececec' }}
                  >
                    <div className="text-sm font-extrabold text-[#111] tracking-wide px-3 py-1.5">
                      Teams
                    </div>
                  </div>

                  {teams === undefined ? (
                    <div className="sv-meta">Loading teams…</div>
                  ) : teams.length === 0 ? (
                    <div className="sv-meta">No team memberships in this account.</div>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((t) => {
                        const isOpen = expandedTeamIds.has(t.team_id);
                        return (
                          <div
                            key={t.team_id}
                            className="rounded-xl border p-3"
                            style={{ borderColor: '#ececec', background: '#fff' }}
                          >
                            <div
                              className="flex items-center cursor-pointer"
                              onClick={() => toggleTeam(t.team_id)}
                              role="button"
                              aria-expanded={isOpen}
                              aria-controls={`team-${t.team_id}-panel`}
                            >
                              <div className="flex-1 pr-3">
                                <div className="text-sm font-bold text-[#111]">{t.team_name}</div>
                              </div>
                              <span
                                className="text-xs font-extrabold rounded-full px-2.5 py-1"
                                style={{ backgroundColor: '#eef1f5', color: '#111' }}
                              >
                                {t.role}
                              </span>
                              <div className="text-sm font-bold text-[#111] ml-2" aria-hidden>
                                {isOpen ? '▾' : '▸'}
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
          Total: {accounts.length} account{accounts.length === 1 ? '' : 's'} • {totalTeams} team
          {totalTeams === 1 ? '' : 's'}
        </div>
      ) : null}
    </section>
  );
}
