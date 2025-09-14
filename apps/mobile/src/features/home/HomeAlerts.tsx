// apps/mobile/src/features/home/HomeAlerts.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useCurrent } from '../../context/CurrentContext';
import {
  listOpenReplacementRequests,
  claimReplacement,
  type Scope,
  type OpenReplacementRow,
} from '../../api/replacements';
import { supabase } from '../../lib/supabase';

export default function HomeAlerts() {
  const { accountId, teamId } = useCurrent();
  const [items, setItems] = useState<OpenReplacementRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const scope: Scope = useMemo(
    () => (teamId ? 'team' : accountId ? 'account' : 'all'),
    [accountId, teamId]
  );

  // Load current user id once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (mounted && !error) setMyUserId(data.user?.id ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load open replacement requests in scope
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Only show spinner if we already showed the card before
      if (hasLoadedOnce && (items?.length ?? 0) > 0) setLoading(true);

      try {
        const rows = await listOpenReplacementRequests({ scope, accountId, teamId, limit: 10 });
        if (!mounted) return;

        const filtered = myUserId ? rows.filter((r) => r.requester_user_id !== myUserId) : rows;
        setItems(filtered);
      } catch {
        // Keep previous items if any (prevents flicker). If none, stay null.
        if (mounted) setItems((prev) => prev ?? null);
      } finally {
        if (mounted) {
          setHasLoadedOnce(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, accountId, teamId, myUserId, hasLoadedOnce]);

  // First mount: render nothing (silent)
  if (!hasLoadedOnce) return null;

  // If we have no items after load, render nothing (no empty placeholder)
  if (!items || items.length === 0) return null;

  const top = items.slice(0, 3);

  const fmt = (s: string, e: string) => {
    const S = new Date(s),
      E = new Date(e);
    const d = S.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const t = (x: Date) =>
      x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${d} • ${t(S)}–${t(E)}`;
  };

  const onClaim = async (reqId: string) => {
    try {
      await claimReplacement(reqId);
      Alert.alert('Claimed!', 'You have been assigned to this event.');
      // Optimistic remove:
      setItems((prev) => (prev ?? []).filter((r) => r.request_id !== reqId));
    } catch (e: any) {
      Alert.alert('Could not claim', e?.message ?? 'Please try again.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Replacement requests</Text>
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>
      {top.map((r) => (
        <View key={r.request_id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{r.label}</Text>
            <Text style={styles.itemSub}>{fmt(r.starts_at, r.ends_at)}</Text>
          </View>
          <Pressable onPress={() => onClaim(r.request_id)} style={styles.claimBtn}>
            <Text style={styles.claimText}>Claim</Text>
          </Pressable>
        </View>
      ))}
      {items.length > top.length ? (
        <Text style={styles.moreHint}>+{items.length - top.length} more available</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#111' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  itemSub: { fontSize: 12, color: '#555' },
  claimBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  claimText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  moreHint: { fontSize: 12, color: '#666', marginTop: 8, textAlign: 'right' },
});
