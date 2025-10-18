/* apps/mobile/src/features/notifications/Notifications.tsx */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  channel: string;
  status: string; // legacy – read state uses read_at
  attempts: number;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  read_at?: string | null;
};

export default function Notifications() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('list_my_notifications', {
        p_limit: 100,
        p_since: null,
      });
      if (error) throw error;
      const rows: NotificationRow[] = (data as NotificationRow[]) || [];
      // Show unread first: filter out read items for a clean view
      setItems(rows.filter((n) => !n.read_at));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function markRead(id: string) {
    setMarking(id);
    const { data, error } = await (supabase as any).rpc('mark_notification_read', { p_id: id });
    if (!error && data === true) {
      // Immediately remove from the list (unread-only UX)
      setItems((prev) => prev.filter((n) => n.id !== id));
    } else if (error) {
      console.warn('mark_notification_read failed', error);
    }
    setMarking(null);
  }

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading notifications…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.error}>Failed to load: {error}</Text>
        <Pressable onPress={load} style={styles.primaryBtn} android_ripple={{ color: '#2563eb' }}>
          <Text style={styles.primaryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      <View style={styles.card}>
        <Text style={styles.h1}>Notifications</Text>
        <Text style={styles.meta}>Unread alerts and actions.</Text>
      </View>

      <FlatList
        contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: '#0ea5e9' }]} />
                <Text numberOfLines={1} style={styles.title}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>
                Type: {item.type} · Channel: {item.channel}
              </Text>
              <Text style={styles.meta}>Created: {new Date(item.created_at).toLocaleString()}</Text>
            </View>

            <Pressable
              onPress={() => markRead(item.id)}
              disabled={marking === item.id}
              style={[styles.secondaryBtn, marking === item.id && { opacity: 0.6 }]}
              android_ripple={{ color: '#e5e7eb' }}
            >
              <Text style={styles.secondaryText}>
                {marking === item.id ? 'Marking…' : 'Mark read'}
              </Text>
            </Pressable>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.meta}>No unread notifications.</Text>}
      />
      {/* No bottom back button — you already have a top back control */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  muted: { color: '#6b7280', textAlign: 'center' },
  error: { color: '#b91c1c', textAlign: 'center' },
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
    marginBottom: 10,
  },
  h1: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13, color: '#444', marginTop: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 16, fontWeight: '700', color: '#111', flexShrink: 1 },
  body: { fontSize: 13, color: '#111', marginTop: 4 },
  primaryBtn: {
    alignSelf: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryText: { color: '#111', fontWeight: '800' },
});
