// apps/mobile/src/features/memberships/MyMemberships.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';

const WINDOW_HEIGHT = Dimensions.get('window').height;

export default function MyMemberships() {
  // data
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teamsByAccount, setTeamsByAccount] = useState<
    Record<string, TeamMembership[] | undefined>
  >({});

  // ui
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // layout gating for PR control to avoid phantom spinner on short content
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const enablePullToRefresh = hasLoadedOnce && contentHeight > (containerHeight || WINDOW_HEIGHT);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    setContainerHeight(e.nativeEvent.layout.height);
  };
  const onContentSizeChange = (_w: number, h: number) => {
    setContentHeight(h);
  };

  // ------- loads -------
  const loadAccounts = useCallback(async () => {
    setError(null);
    try {
      const accs = await getMyAccountMemberships();
      setAccounts(accs);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load memberships');
      setAccounts([]);
      setTeamsByAccount({});
    } finally {
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    // Initial load (no RefreshControl mounted, bounces/overscroll disabled)
    loadAccounts();
  }, [loadAccounts]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAccounts();
    setIsRefreshing(false);
  }, [loadAccounts]);

  const ensureTeamsLoaded = useCallback(
    async (accountId: string) => {
      if (teamsByAccount[accountId] !== undefined) return;
      try {
        const rows = await getMyTeamMemberships(accountId);
        setTeamsByAccount((prev) => ({ ...prev, [accountId]: rows }));
      } catch {
        setTeamsByAccount((prev) => ({ ...prev, [accountId]: [] }));
      }
    },
    [teamsByAccount]
  );

  // ------- interactions -------
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

  // ------- derived -------
  const totalTeams = useMemo(
    () =>
      Object.values(teamsByAccount).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [teamsByAccount]
  );
  const list = (accounts ?? []) as AccountMembership[];

  return (
    <View style={{ flex: 1 }} onLayout={onContainerLayout}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
        onContentSizeChange={onContentSizeChange}
        // Hard stop any first-paint overscroll/spinner
        bounces={enablePullToRefresh} // iOS: only bounce after first load + tall content
        overScrollMode={enablePullToRefresh ? 'auto' : 'never'} // Android
        // Mount RefreshControl only when safe (post-load + tall)
        refreshControl={
          enablePullToRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#111"
              colors={['#111']}
            />
          ) : undefined
        }
      >
        {/* Header */}
        <View style={[styles.card, { marginBottom: 8 }]}>
          <Text style={styles.h1}>My Memberships</Text>
          <Text style={styles.meta}>
            Tap an account to view details and your teams in that account.
          </Text>
          {error ? <Text style={[styles.meta, { color: '#c00' }]}>{error}</Text> : null}
        </View>
        {!hasLoadedOnce ? (
          <Text style={[styles.meta, { paddingLeft: 2 }]}>Loading entries…</Text>
        ) : null}

        {/* Accounts */}
        {list.map((a) => {
          const expanded = expandedAccountId === a.account_id;
          const teams = teamsByAccount[a.account_id]; // undefined => “Loading teams…”
          const accountDescription =
            (a as any)?.account_description ?? (a as any)?.description ?? null;

          return (
            <View key={a.account_id} style={[styles.card, { marginTop: 10 }]}>
              {/* Account header (press here only) */}
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

              {/* Expanded content */}
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
                    <Text style={styles.meta}>Loading teams…</Text>
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
        })}

        {/* Footer totals */}
        {Array.isArray(accounts) ? (
          <Text style={[styles.meta, { textAlign: 'center', marginTop: 12 }]}>
            Total: {accounts.length} account{accounts.length === 1 ? '' : 's'} • {totalTeams} team
            {totalTeams === 1 ? '' : 's'}
          </Text>
        ) : null}
      </ScrollView>
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
