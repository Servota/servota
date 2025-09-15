// apps/mobile/src/features/memberships/MyMemberships.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';

type Row =
  | { kind: 'header' }
  | { kind: 'account'; account: AccountMembership; expanded: boolean; teams?: TeamMembership[] }
  | { kind: 'footer'; accountsCount: number; teamsCount: number };

export default function MyMemberships() {
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teamsByAccount, setTeamsByAccount] = useState<Record<string, TeamMembership[]>>({});
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const accs = await getMyAccountMemberships();
      setAccounts(accs);

      if (expandedAccountId) {
        const teams = await getMyTeamMemberships(expandedAccountId);
        setTeamsByAccount((prev) => ({ ...prev, [expandedAccountId]: teams }));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load memberships');
      setAccounts([]);
      setTeamsByAccount({});
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
    }
  }, [expandedAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalTeams = useMemo(
    () => Object.values(teamsByAccount).reduce((sum, list) => sum + (list?.length ?? 0), 0),
    [teamsByAccount]
  );

  const rows: Row[] = useMemo(() => {
    if (!accounts) return [{ kind: 'header' }];
    const r: Row[] = [{ kind: 'header' }];
    for (const a of accounts) {
      r.push({
        kind: 'account',
        account: a,
        expanded: expandedAccountId === a.account_id,
        teams: teamsByAccount[a.account_id],
      });
    }
    r.push({ kind: 'footer', accountsCount: accounts.length, teamsCount: totalTeams });
    return r;
  }, [accounts, expandedAccountId, teamsByAccount, totalTeams]);

  const toggleAccount = async (account: AccountMembership) => {
    const willExpand = expandedAccountId !== account.account_id;
    setExpandedAccountId(willExpand ? account.account_id : null);
    setExpandedTeamIds(new Set());

    if (willExpand && teamsByAccount[account.account_id] === undefined) {
      try {
        const teams = await getMyTeamMemberships(account.account_id);
        setTeamsByAccount((prev) => ({ ...prev, [account.account_id]: teams }));
      } catch {
        setTeamsByAccount((prev) => ({ ...prev, [account.account_id]: [] }));
      }
    }
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor="#111"
            colors={['#111']}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={{ gap: 6, marginBottom: 8 }}>
                <View style={styles.card}>
                  <Text style={styles.h1}>My Memberships</Text>
                  <Text style={styles.meta}>
                    Tap an account to view details and your teams in that account.
                  </Text>
                  {error ? <Text style={[styles.meta, { color: '#c00' }]}>{error}</Text> : null}
                </View>

                {!hasLoadedOnce ? (
                  <Text style={[styles.meta, { paddingLeft: 2 }]}>Loading entries…</Text>
                ) : null}
              </View>
            );
          }

          if (item.kind === 'account') {
            const a = item.account;
            const teams = item.teams;
            const expanded = item.expanded;

            const accountDescription =
              (a as any)?.account_description ?? (a as any)?.description ?? null;

            return (
              <View style={[styles.card, { marginTop: 10 }]}>
                {/* Header row (only this is pressable) */}
                <Pressable
                  onPress={() => toggleAccount(a)}
                  style={[styles.rowBetween, { alignItems: 'center' }]}
                  android_ripple={{ color: '#e5e7eb' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Account ${a.account_name}`}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>{a.account_name}</Text>
                    <View style={styles.badgeRow}>
                      <Text style={styles.badgeLabel}>Account role</Text>
                      <Text style={styles.badgeValue}>{a.role}</Text>
                    </View>
                  </View>
                  <Text style={styles.chev}>{expanded ? '˄' : '˅'}</Text>
                </Pressable>

                {/* Expanded content (safe to tap inside) */}
                {expanded && (
                  <View style={{ gap: 12, marginTop: 10 }}>
                    {accountDescription ? (
                      <Text style={styles.desc}>{String(accountDescription)}</Text>
                    ) : (
                      <Text style={styles.meta}>
                        Account details coming soon (description, contacts, policies).
                      </Text>
                    )}

                    <View style={styles.sectionBar}>
                      <Text style={styles.sectionBarText}>Teams</Text>
                    </View>

                    {teams === undefined ? (
                      <ActivityIndicator />
                    ) : teams.length === 0 ? (
                      <Text style={styles.meta}>No team memberships in this account.</Text>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {teams.map((t) => {
                          const teamId = t.team_id;
                          const isOpen = expandedTeamIds.has(teamId);
                          const teamDescription =
                            (t as any)?.team_description ?? (t as any)?.description ?? null;

                          return (
                            <View key={teamId} style={styles.teamCard}>
                              <Pressable
                                onPress={() => toggleTeam(teamId)}
                                style={styles.teamRow}
                                android_ripple={{ color: '#e5e7eb' }}
                                accessibilityRole="button"
                                accessibilityLabel={`Team ${t.team_name}`}
                              >
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                  <Text style={styles.teamName}>{t.team_name}</Text>
                                </View>
                                <View style={styles.teamChip}>
                                  <Text style={styles.teamChipText}>{t.role}</Text>
                                </View>
                                <Text style={[styles.chev, { marginLeft: 6 }]}>
                                  {isOpen ? '˄' : '˅'}
                                </Text>
                              </Pressable>

                              {isOpen && (
                                <View style={{ paddingTop: 6 }}>
                                  {teamDescription ? (
                                    <Text style={styles.teamDesc}>{String(teamDescription)}</Text>
                                  ) : (
                                    <Text style={styles.meta}>Team description coming soon.</Text>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }

          return (
            <Text style={[styles.meta, { textAlign: 'center', marginTop: 12 }]}>
              Total: {item.accountsCount} account{item.accountsCount === 1 ? '' : 's'} •{' '}
              {item.teamsCount} team{item.teamsCount === 1 ? '' : 's'}
            </Text>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: '700', color: '#111' },
  meta: { fontSize: 13, color: '#6b7280' },
  desc: { fontSize: 13, color: '#111' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },

  card: {
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  sectionBar: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  sectionBarText: { fontSize: 13, fontWeight: '800', color: '#111', letterSpacing: 0.2 },

  title: { fontSize: 16, fontWeight: '700', color: '#111' },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  badgeLabel: { fontSize: 12, color: '#6b7280' },
  badgeValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  chev: { fontSize: 18, fontWeight: '800', color: '#111', paddingHorizontal: 4 },

  teamCard: {
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: { fontSize: 14, fontWeight: '700', color: '#111' },
  teamDesc: { fontSize: 12, color: '#444', marginTop: 2 },

  teamChip: {
    backgroundColor: '#eef1f5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teamChipText: { fontSize: 12, fontWeight: '800', color: '#111' },
});
