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
import { proposeCrossDateSwap } from '../../api/swaps';

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
  selected, // Base selection (fixed card)
  setSelected: _setSelected, // unused for now (kept for future)
}: {
  selected: SelectedEvent;
  setSelected: (_: SelectedEvent) => void;
}) {
  const [siblings, setSiblings] = useState<EventRow[] | null>(null);
  const [assigneeNameByEvent, setAssigneeNameByEvent] = useState<Record<string, string>>({});
  const [isMineByEvent, setIsMineByEvent] = useState<Record<string, boolean>>({});
  const [assignmentIdByEvent, setAssignmentIdByEvent] = useState<Record<string, string | null>>({});
  const [baseAssignmentId, setBaseAssignmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Target selection (a different date from the list)
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = useMemo(
    () => (siblings ?? []).find((e) => e.event_id === targetId) ?? null,
    [siblings, targetId]
  );

  // (kept for future refreshes)
  const [_refreshTick, _setRefreshTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selected.template_id) {
        setSiblings([]);
        return;
      }
      setLoading(true);
      try {
        // Load other dates in the series, soonest first, EXCLUDING the base event
        const rows = (await getUpcomingEventsByTemplate(selected.template_id, 50)).filter(
          (r) => r.event_id !== selected.event_id
        );
        if (!mounted) return;
        setSiblings(rows);

        // Who am I?
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user?.id ?? '00000000-0000-0000-0000-000000000000';

        // Base assignment id (mine on the base date)
        {
          const { data: baseAsg } = await supabase
            .from('assignments')
            .select('id')
            .eq('event_id', selected.event_id)
            .eq('user_id', me)
            .limit(1)
            .maybeSingle();
          setBaseAssignmentId(baseAsg?.id ?? null);
        }

        // For each sibling: first assignee (name), assignment id, and whether it's mine
        const names: Record<string, string> = {};
        const mine: Record<string, boolean> = {};
        const ids: Record<string, string | null> = {};

        for (const ev of rows) {
          const { data: arow } = await supabase
            .from('assignments')
            .select('id, user_id')
            .eq('event_id', ev.event_id)
            .order('assigned_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (arow?.id) {
            ids[ev.event_id] = arow.id;
            mine[ev.event_id] = arow.user_id === me;

            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', arow.user_id)
              .maybeSingle();
            names[ev.event_id] = prof?.full_name ?? 'Assigned';
          } else {
            ids[ev.event_id] = null;
            mine[ev.event_id] = false;
            names[ev.event_id] = 'Unassigned';
          }
        }

        if (!mounted) return;
        setAssigneeNameByEvent(names);
        setIsMineByEvent(mine);
        setAssignmentIdByEvent(ids);
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
      Alert.alert('Request sent', 'We’ll notify eligible teammates via push and email.');
    } catch (e: any) {
      Alert.alert('Could not open replacement', e?.message ?? 'Please try again.');
    }
  };

  // Propose cross-date swap (base ↔ target) — creates a pending request
  const doProposeCrossDateSwap = async () => {
    if (!targetId) return;
    const targetAsgId = assignmentIdByEvent[targetId] ?? null;

    if (!baseAssignmentId) {
      Alert.alert('No base assignment', 'You are not assigned on the selected base date.');
      return;
    }
    if (!targetAsgId) {
      Alert.alert('No assignee', 'That date has nobody assigned to swap with.');
      return;
    }
    if (isMineByEvent[targetId]) {
      Alert.alert('Already yours', 'You are already assigned to that date.');
      return;
    }

    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Propose this swap?',
        `• ${fmtTimeRange(selected.starts_at, selected.ends_at)}\n↔\n• ${fmtTimeRange(target!.starts_at, target!.ends_at)}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Send request', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
    if (!ok) return;

    try {
      await proposeCrossDateSwap(baseAssignmentId, targetAsgId, 'Swap weeks via mobile');
      Alert.alert(
        'Request sent',
        'The other person will receive a notification to accept or decline.'
      );
      // keep UI selection; no immediate swap
    } catch (e: any) {
      Alert.alert('Could not propose swap', e?.message ?? 'Please try again.');
    }
  };

  const proposeEnabled =
    !!target &&
    !isMineByEvent[target.event_id] &&
    (assigneeNameByEvent[target?.event_id ?? ''] ?? '') !== 'Unassigned' &&
    !!baseAssignmentId;

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
            onPress={doProposeCrossDateSwap}
            disabled={!proposeEnabled}
            style={[styles.secondaryBtn, !proposeEnabled && { opacity: 0.5 }]}
          >
            <Text style={styles.secondaryText}>
              {target ? 'Propose swap' : 'Select a date below'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Other dates in this series (soonest first; base excluded) */}
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
});
