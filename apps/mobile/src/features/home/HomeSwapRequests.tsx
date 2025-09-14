// apps/mobile/src/features/home/HomeSwapRequests.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useCurrent } from '../../context/CurrentContext';
import { supabase } from '../../lib/supabase';
import { respondCrossDateSwap } from '../../api/swaps';

type Row = {
  id: string;
  account_name: string | null;
  team_name: string | null;
  from_event_label: string;
  from_starts: string;
  from_ends: string;
  to_event_label: string;
  to_starts: string;
  to_ends: string;
};

export default function HomeSwapRequests() {
  const { accountId, teamId } = useCurrent();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const scopeFilter = useMemo(() => ({ accountId, teamId }), [accountId, teamId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Show refresh spinner only if we already have visible content
      if (hasLoadedOnce && (rows?.length ?? 0) > 0) setLoading(true);

      try {
        const { data: me, error: meErr } = await supabase.auth.getUser();
        if (meErr) throw meErr;
        const uid = me?.user?.id as string;

        // pending where I'm the recipient (to_user_id)
        let q = supabase
          .from('swap_requests')
          .select(
            `
            id, status, created_at,
            accounts:account_id ( id, name ),
            teams:team_id ( id, name ),
            from:from_assignment_id (
              id, event_id, events!inner ( label, starts_at, ends_at )
            ),
            to:to_assignment_id (
              id, event_id, events!inner ( label, starts_at, ends_at )
            ),
            to_user_id
          `
          )
          .eq('status', 'pending')
          .eq('to_user_id', uid)
          .order('created_at', { ascending: false })
          .limit(10);

        if (scopeFilter.accountId) q = q.eq('accounts.id', scopeFilter.accountId);
        if (scopeFilter.teamId) q = q.eq('teams.id', scopeFilter.teamId);

        const { data, error } = await q;
        if (error) throw error;

        const map: Row[] = (data ?? []).map((r: any) => ({
          id: r.id,
          account_name: r.accounts?.name ?? null,
          team_name: r.teams?.name ?? null,
          from_event_label: r.from?.events?.label ?? 'Event',
          from_starts: r.from?.events?.starts_at,
          from_ends: r.from?.events?.ends_at,
          to_event_label: r.to?.events?.label ?? 'Event',
          to_starts: r.to?.events?.starts_at,
          to_ends: r.to?.events?.ends_at,
        }));

        if (mounted) setRows(map);
      } catch {
        // Keep previous rows if any; otherwise remain null
        if (mounted) setRows((prev) => prev ?? null);
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
  }, [scopeFilter.accountId, scopeFilter.teamId, hasLoadedOnce]);

  // First mount: render nothing (silent)
  if (!hasLoadedOnce) return null;

  // If no rows after load, render nothing (no empty placeholder)
  if (!rows || rows.length === 0) return null;

  const fmt = (s: string, e: string) => {
    const S = new Date(s),
      E = new Date(e);
    const d = S.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const t = (x: Date) =>
      x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${d} • ${t(S)}–${t(E)}`;
  };

  const onRespond = async (id: string, action: 'accept' | 'decline') => {
    try {
      await respondCrossDateSwap(id, action);
      setRows((prev) => (prev ?? []).filter((x) => x.id !== id));
      Alert.alert(
        action === 'accept' ? 'Swapped!' : 'Declined',
        action === 'accept' ? 'Assignments exchanged.' : 'Request declined.'
      );
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Please try again.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Swap requests</Text>
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>

      {rows.map((r) => (
        <View key={r.id} style={{ marginTop: 6, gap: 4 }}>
          <Text style={styles.itemTitle}>
            {r.account_name ?? 'Account'}
            {r.team_name ? ` — ${r.team_name}` : ''}
          </Text>
          <Text style={styles.itemSub}>You ↔ Them</Text>
          <Text style={styles.line}>
            • {r.from_event_label}: {fmt(r.from_starts, r.from_ends)}
          </Text>
          <Text style={styles.line}>
            • {r.to_event_label}: {fmt(r.to_starts, r.to_ends)}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Pressable onPress={() => onRespond(r.id, 'accept')} style={styles.acceptBtn}>
              <Text style={styles.btnText}>Accept</Text>
            </Pressable>
            <Pressable onPress={() => onRespond(r.id, 'decline')} style={styles.declineBtn}>
              <Text style={styles.btnText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      ))}
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
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  itemSub: { fontSize: 12, color: '#666' },
  line: { fontSize: 12, color: '#333' },
  acceptBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  declineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
