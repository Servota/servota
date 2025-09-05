/* eslint-disable no-unused-vars */
// apps/mobile/src/features/roster/EventDetails.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  FlatList,
} from 'react-native';
import { getUpcomingEventsByTemplate, type EventRow } from '../../api/events';
import { openReplacementRequest } from '../../api/replacements';
import { supabase } from '../../lib/supabase';

export type SelectedEvent = {
  event_id: string;
  template_id: string | null;
  account_id: string;
  team_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  account_name?: string | null;
  team_name?: string | null;
};

export default function EventDetails({
  selected, // BASE selection (fixed)
  setSelected, // kept for future, but we will NOT mutate the base now
}: {
  selected: SelectedEvent;
  setSelected: (_: SelectedEvent) => void;
}) {
  const [siblings, setSiblings] = useState<EventRow[] | null>(null);
  const [assigneeNameByEvent, setAssigneeNameByEvent] = useState<Record<string, string>>({});
  const [isMineByEvent, setIsMineByEvent] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Target selection from the list (different date)
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = useMemo(
    () => (siblings ?? []).find((e) => e.event_id === targetId) ?? null,
    [siblings, targetId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selected.template_id) {
        setSiblings([]);
        return;
      }
      setLoading(true);
      try {
        // Get siblings soonest first, and EXCLUDE the base event
        const rows = (await getUpcomingEventsByTemplate(selected.template_id, 50)).filter(
          (r) => r.event_id !== selected.event_id
        );
        if (!mounted) return;
        setSiblings(rows);

        // Build lookups for "assigned name" and "is mine"
        const ids = rows.map((r) => r.event_id);
        const names: Record<string, string> = {};
        const mine: Record<string, boolean> = {};

        // Who am I?
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user?.id ?? '00000000-0000-0000-0000-000000000000';

        // My assignments across these events
        if (ids.length) {
          const { data: myAsg } = await supabase
            .from('assignments')
            .select('event_id')
            .eq('user_id', me)
            .in('event_id', ids);
          for (const row of myAsg ?? []) mine[row.event_id as string] = true;

          // First assignee name per event (if any)
          for (const evId of ids) {
            const { data: asg } = await supabase
              .from('assignments')
              .select('user_id')
              .eq('event_id', evId)
              .order('assigned_at', { ascending: true })
              .limit(1);
            if (asg && asg.length) {
              const uid = asg[0].user_id as string;
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', uid)
                .single();
              names[evId] = prof?.full_name ?? 'Assigned';
            } else {
              names[evId] = 'Unassigned';
            }
          }
        }

        if (!mounted) return;
        setAssigneeNameByEvent(names);
        setIsMineByEvent(mine);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selected.event_id, selected.template_id]);

  const fmtTimeRange = (sIso: string, eIso: string) => {
    const s = new Date(sIso);
    const e = new Date(eIso);
    const day = s.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const hhmm = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${day} • ${hhmm(s)}–${hhmm(e)}`;
  };

  const cantMakeIt = async () => {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert("Can't make it?", `Open a replacement request for "${selected.label}"?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Open request', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    try {
      await openReplacementRequest({
        accountId: selected.account_id,
        teamId: selected.team_id,
        eventId: selected.event_id,
      });
      Alert.alert('Replacement opened', 'We’ll notify eligible teammates via push and email.');
    } catch (e: any) {
      Alert.alert('Could not open replacement', e?.message ?? 'Please try again.');
    }
  };

  // Cross-date swap (base ↔ target): server RPC coming next step — UI is ready now.
  const proposeCrossDateSwap = () => {
    if (!target) return;
    if (isMineByEvent[target.event_id]) {
      Alert.alert('Already yours', 'You are already assigned to that date.');
      return;
    }
    Alert.alert(
      'Swap request (coming soon)',
      `We will swap:\n• ${fmtTimeRange(selected.starts_at, selected.ends_at)}\nwith\n• ${fmtTimeRange(target.starts_at, target.ends_at)}\n\nNext step: we’ll add the server RPC to apply this safely.`
    );
  };

  const proposeEnabled =
    !!target &&
    !isMineByEvent[target.event_id] &&
    (assigneeNameByEvent[target?.event_id ?? ''] ?? '') !== 'Unassigned';

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, gap: 12 }}>
      {/* Fixed base event */}
      <View style={styles.card}>
        <Text style={styles.title}>{selected.label}</Text>
        <Text style={styles.sub}>
          {selected.account_name ?? 'Account'}
          {selected.team_name ? ` — ${selected.team_name}` : ''}
        </Text>
        <Text style={styles.meta}>🗓️ {fmtTimeRange(selected.starts_at, selected.ends_at)}</Text>

        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={cantMakeIt} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Can’t make it</Text>
          </Pressable>
          <Pressable
            onPress={proposeCrossDateSwap}
            disabled={!proposeEnabled}
            style={[styles.secondaryBtn, !proposeEnabled && { opacity: 0.5 }]}
          >
            <Text style={styles.secondaryText}>
              {target ? 'Propose swap' : 'Select a date below'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Other dates in series (soonest first; base excluded) */}
      <Text style={styles.h2}>Other dates in this series</Text>
      {loading ? (
        <ActivityIndicator />
      ) : (siblings ?? []).length === 0 ? (
        <Text style={styles.muted}>No other upcoming dates.</Text>
      ) : (
        <FlatList
          data={siblings ?? []}
          keyExtractor={(it) => it.event_id}
          renderItem={({ item }) => {
            const mine = !!isMineByEvent[item.event_id];
            const active = targetId === item.event_id;
            return (
              <Pressable
                onPress={() => setTargetId(item.event_id)}
                style={[styles.row, active && { borderColor: '#10b981' }, mine && { opacity: 0.6 }]}
              >
                <Text style={styles.rowTitle}>{item.label}</Text>
                <Text style={styles.rowMeta}>{fmtTimeRange(item.starts_at, item.ends_at)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                  <Text style={styles.assigneeLine}>
                    Assigned: {assigneeNameByEvent[item.event_id] ?? '—'}
                  </Text>
                  {mine ? <Text style={styles.badgeMine}>Mine</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
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
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111' },
  sub: { fontSize: 12, color: '#555', marginTop: 2 },
  meta: { fontSize: 13, color: '#444', marginTop: 6 },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  row: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
    marginTop: 8,
    gap: 2,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  rowMeta: { fontSize: 12, color: '#555' },
  assigneeLine: { fontSize: 12, color: '#333' },
  muted: { color: '#666' },

  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryText: { color: '#111', fontWeight: '800' },

  badgeMine: {
    fontSize: 11,
    color: '#0a3',
    backgroundColor: '#e6f8ec',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: '#0008' },
  modalSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  modalItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalItemText: { fontSize: 16, fontWeight: '600', color: '#111' },
  modalItemSub: { fontSize: 12, color: '#666' },
  modalClose: { fontSize: 14, fontWeight: '700', color: '#3b82f6' },
});
