// apps/mobile/src/features/memberships/MyMemberships.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';

type Item =
  | { kind: 'header' }
  | { kind: 'account'; account: AccountMembership; teams?: TeamMembership[] }
  | { kind: 'summary'; accounts: number; teams: number };

export default function MyMemberships() {
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teamsByAccount, setTeamsByAccount] = useState<Record<string, TeamMembership[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const accs = await getMyAccountMemberships();
      setAccounts(accs);

      const pairs = await Promise.all(
        accs.map(async (a) => {
          const teams = await getMyTeamMemberships(a.account_id);
          return [a.account_id, teams] as const;
        })
      );

      const map: Record<string, TeamMembership[]> = {};
      for (const [accountId, teams] of pairs) map[accountId] = teams;
      setTeamsByAccount(map);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load memberships');
      setAccounts([]);
      setTeamsByAccount({});
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalTeams = useMemo(
    () => Object.values(teamsByAccount).reduce((sum, list) => sum + (list?.length ?? 0), 0),
    [teamsByAccount]
  );

  const data: Item[] = useMemo(() => {
    if (!accounts) return [{ kind: 'header' }];
    const rows: Item[] = [{ kind: 'header' }];
    for (const a of accounts) {
      rows.push({ kind: 'account', account: a, teams: teamsByAccount[a.account_id] });
    }
    rows.push({ kind: 'summary', accounts: accounts.length, teams: totalTeams });
    return rows;
  }, [accounts, teamsByAccount, totalTeams]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      <FlatList
        data={data}
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
                  <Text style={styles.meta}>Accounts and teams you belong to.</Text>
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

            return (
              <View style={[styles.card, { marginTop: 10 }]}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.title}>{a.account_name}</Text>
                  <View style={styles.badgeRow}>
                    <Text style={styles.badgeLabel}>Account role</Text>
                    <Text style={styles.badgeValue}>{a.role}</Text>
                  </View>

                  <Text style={[styles.section, { marginTop: 6 }]}>Teams</Text>

                  {teams === undefined ? (
                    <ActivityIndicator />
                  ) : teams.length === 0 ? (
                    <Text style={styles.meta}>No team memberships in this account.</Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {teams.map((t) => (
                        <View key={t.team_id} style={styles.teamRow}>
                          <Text style={styles.teamName}>{t.team_name}</Text>
                          <View style={styles.teamChip}>
                            <Text style={styles.teamChipText}>{t.role}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }

          // summary
          return (
            <Text style={[styles.meta, { textAlign: 'center', marginTop: 12 }]}>
              Total: {item.accounts} account{item.accounts === 1 ? '' : 's'} • {item.teams} team
              {item.teams === 1 ? '' : 's'}
            </Text>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // tokens (match app)
  h1: { fontSize: 18, fontWeight: '700', color: '#111' },
  section: { fontSize: 14, fontWeight: '800', color: '#111' },
  meta: { fontSize: 13, color: '#6b7280' },

  // card (match Unavailability/App)
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

  title: { fontSize: 16, fontWeight: '700', color: '#111' },

  // account role badge (subtle)
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  // team rows
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamName: { fontSize: 14, fontWeight: '700', color: '#111' },
  teamChip: {
    backgroundColor: '#eef1f5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teamChipText: { fontSize: 12, fontWeight: '800', color: '#111' },
});
