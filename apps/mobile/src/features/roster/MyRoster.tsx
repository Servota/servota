// apps/mobile/src/features/roster/MyRoster.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { getMyUpcomingAssignments, type MyAssignment, type Scope } from '../../api/roster';
import { useCurrent } from '../../context/CurrentContext';
import Switchers from '../switchers/Switchers';

export default function MyRoster() {
  const { accountId, teamId } = useCurrent();
  const [items, setItems] = useState<MyAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const scope: Scope = teamId ? 'team' : accountId ? 'account' : 'all';
      const data = await getMyUpcomingAssignments({
        scope,
        accountId: accountId ?? undefined,
        teamId: teamId ?? undefined,
        limit: 50,
      });
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load roster');
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [accountId, teamId]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  const header = (
    <View style={{ padding: 16, gap: 8 }}>
      <Switchers />
      <Text style={styles.h1}>My Roster</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {items === null ? (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items ?? []}
        keyExtractor={(it) => it.assignment_id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          items && items.length === 0 ? (
            <Text style={[styles.muted, { padding: 16 }]}>No upcoming assignments.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.label}</Text>
            <Text style={styles.cardSub}>
              {fmt(item.starts_at)} → {fmt(item.ends_at)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: '700' },
  err: { color: '#c00' },
  muted: { color: '#666' },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: 'white',
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 12, color: '#555', marginTop: 4 },
});
