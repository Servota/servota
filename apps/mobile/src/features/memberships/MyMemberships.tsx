// apps/mobile/src/features/memberships/MyMemberships.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';

export default function MyMemberships() {
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teamsByAccount, setTeamsByAccount] = useState<Record<string, TeamMembership[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const accs = await getMyAccountMemberships();
        if (!mounted) return;
        setAccounts(accs);

        // Load teams for each account
        const pairs = await Promise.all(
          accs.map(async (a) => {
            const teams = await getMyTeamMemberships(a.account_id);
            return [a.account_id, teams] as const;
          })
        );
        if (!mounted) return;

        const map: Record<string, TeamMembership[]> = {};
        for (const [accountId, teams] of pairs) map[accountId] = teams;
        setTeamsByAccount(map);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load memberships');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const totalTeams = useMemo(
    () => Object.values(teamsByAccount).reduce((sum, list) => sum + (list?.length ?? 0), 0),
    [teamsByAccount]
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.h1}>My Memberships</Text>
      <Text style={styles.muted}>Accounts and teams you belong to.</Text>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {accounts === null ? (
        <ActivityIndicator />
      ) : accounts.length === 0 ? (
        <Text style={styles.muted}>You don’t belong to any accounts yet.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {accounts.map((a) => (
            <View key={a.account_id} style={styles.card}>
              <Text style={styles.title}>{a.account_name}</Text>
              <Text style={styles.badge}>Account role: {a.role}</Text>

              <View style={{ height: 6 }} />
              <Text style={styles.h2}>Teams</Text>
              {teamsByAccount[a.account_id] === undefined ? (
                <ActivityIndicator />
              ) : teamsByAccount[a.account_id].length === 0 ? (
                <Text style={styles.muted}>No team memberships in this account.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {teamsByAccount[a.account_id].map((t) => (
                    <View key={t.team_id} style={styles.teamRow}>
                      <Text style={styles.teamName}>{t.team_name}</Text>
                      <Text style={styles.teamRole}>{t.role}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <Text style={styles.summary}>
            Total: {accounts.length} account{accounts.length === 1 ? '' : 's'} • {totalTeams} team
            {totalTeams === 1 ? '' : 's'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800' },
  h2: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700' },
  muted: { color: '#666' },
  err: { color: '#c00' },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'white',
  },
  teamRow: { flexDirection: 'row', justifyContent: 'space-between' },
  teamName: { fontSize: 14, fontWeight: '600' },
  teamRole: { fontSize: 12, color: '#555' },
  badge: { fontSize: 12, color: '#555' },
  summary: { color: '#555', textAlign: 'center' },
});
