// apps/mobile/src/features/switchers/Switchers.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';
import { useCurrent } from '../../context/CurrentContext';

export default function Switchers() {
  const { accountId, teamId, setAccount, setTeam } = useCurrent();

  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [accountErr, setAccountErr] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountMembership | null>(null);

  const [teams, setTeams] = useState<TeamMembership[] | null>(null);
  const [teamErr, setTeamErr] = useState<string | null>(null);

  // Load accounts on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await getMyAccountMemberships();
        if (!mounted) return;
        setAccounts(rows);

        // Prefer persisted accountId if available
        if (rows.length) {
          const byPersisted = rows.find((r) => r.account_id === accountId);
          setSelectedAccount(byPersisted ?? rows[0]);
          if (byPersisted) {
            // ensure context is set (name might have changed)
            setAccount(byPersisted.account_id, byPersisted.account_name);
          }
        } else {
          setSelectedAccount(null);
          setTeams([]); // avoid spinner when there are no accounts
        }
      } catch (e: any) {
        if (!mounted) return;
        setAccountErr(e?.message ?? 'Failed to load accounts');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load teams when account changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedAccount) {
        setTeams([]); // no account selected => show empty state, not spinner
        return;
      }
      try {
        const rows = await getMyTeamMemberships(selectedAccount.account_id);
        if (!mounted) return;
        setTeams(rows);
        setTeamErr(null);
      } catch (e: any) {
        if (!mounted) return;
        setTeamErr(e?.message ?? 'Failed to load teams');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedAccount?.account_id]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Your Accounts</Text>

      {accountErr ? <Text style={styles.err}>{accountErr}</Text> : null}
      {accounts === null ? (
        <ActivityIndicator />
      ) : accounts.length === 0 ? (
        <Text style={styles.muted}>No account memberships found.</Text>
      ) : (
        <View style={styles.list}>
          {accounts.map((a) => {
            const active = selectedAccount?.account_id === a.account_id;
            return (
              <Pressable
                key={a.account_id}
                onPress={() => {
                  setSelectedAccount(a);
                  setAccount(a.account_id, a.account_name); // persist selection
                }}
                style={[styles.item, active && styles.itemActive]}
              >
                <Text style={styles.itemTitle}>{a.account_name}</Text>
                <Text style={styles.badge}>{a.role}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={[styles.h1, { marginTop: 16 }]}>
        {selectedAccount ? `Teams in ${selectedAccount.account_name}` : 'Teams'}
      </Text>

      {teamErr ? <Text style={styles.err}>{teamErr}</Text> : null}
      {teams === null ? (
        <ActivityIndicator />
      ) : teams.length === 0 ? (
        <Text style={styles.muted}>
          {selectedAccount
            ? 'No team memberships in this account.'
            : 'Select an account to view teams.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {teams.map((t) => {
            const active = teamId === t.team_id;
            return (
              <Pressable
                key={t.team_id}
                onPress={() => setTeam(t.team_id, t.team_name)} // persist selection
                style={[styles.item, active && styles.itemActive]}
              >
                <Text style={styles.itemTitle}>{t.team_name}</Text>
                <Text style={styles.badge}>{t.role}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  h1: { fontSize: 18, fontWeight: '700' },
  list: { gap: 8 },
  item: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemActive: { borderColor: '#3b82f6' },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  badge: { fontSize: 12, color: '#555' },
  muted: { color: '#666' },
  err: { color: '#c00' },
});
