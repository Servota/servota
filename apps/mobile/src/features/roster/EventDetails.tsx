/* eslint-disable no-unused-vars */
// apps/mobile/src/features/roster/EventDetails.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, FlatList } from 'react-native';
import { getUpcomingEventsByTemplate, type EventRow } from '../../api/events';
import { openReplacementRequest } from '../../api/replacements';
import { supabase } from '../../lib/supabase';
import { proposeCrossDateSwap } from '../../api/swaps';

const BRAND_BLUE = '#1C94B3'; // match MyRoster

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
  selected,
  setSelected: _setSelected, // reserved for future
}: {
  selected: SelectedEvent;
  setSelected: (_: SelectedEvent) => void;
}) {
  // undefined → still loading; [] → loaded empty
  const [siblings, setSiblings] = useState<EventRow[] | undefined>(undefined);

  const [assigneeNameByEvent, setAssigneeNameByEvent] = useState<Record<string, string>>({});
  const [isMineByEvent, setIsMineByEvent] = useState<Record<string, boolean>>({});
  const [assignmentIdByEvent, setAssignmentIdByEvent] = useState<Record<string, string | null>>({});
  const [baseAssignmentId, setBaseAssignmentId] = useState<string | null>(null);

  const [targetId, setTargetId] = useState<string | null>(null);
  const target = useMemo(
    () => (siblings ?? []).find((e) => e.event_id === targetId) ?? null,
    [siblings, targetId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selected.template_id) {
        if (mounted) setSiblings([]);
        return;
      }

      // Other dates in the series (soonest first), excluding the base
      const rows = (await getUpcomingEventsByTemplate(selected.template_id, 50)).filter(
        (r) => r.event_id !== selected.event_id
      );
      if (!mounted) return;

      // Who am I?
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id ?? null;

      // Base assignment id (mine on the base date)
      if (me) {
        const { data: baseAsg } = await supabase
          .from('assignments')
          .select('id')
          .eq('event_id', selected.event_id)
          .eq('user_id', me)
          .limit(1)
          .maybeSingle();
        if (mounted) setBaseAssignmentId(baseAsg?.id ?? null);
      } else if (mounted) {
        setBaseAssignmentId(null);
      }

      // Early exit if no siblings
      if (rows.length === 0) {
        if (mounted) {
          setSiblings([]);
          setAssigneeNameByEvent({});
          setIsMineByEvent({});
          setAssignmentIdByEvent({});
        }
        return;
      }

      // Batch: earliest assignment per sibling event
      const evIds = rows.map((r) => r.event_id);
      const { data: asgRows } = await supabase
        .from('assignments')
        .select('id, user_id, event_id, assigned_at')
        .in('event_id', evIds)
        .order('assigned_at', { ascending: true });

      const firstByEvent: Record<string, { id: string; user_id: string } | null> = {};
      const userSet = new Set<string>();
      for (const id of evIds) firstByEvent[id] = null;

      for (const a of asgRows ?? []) {
        if (!firstByEvent[a.event_id]) {
          firstByEvent[a.event_id] = { id: a.id, user_id: a.user_id };
          if (a.user_id) userSet.add(a.user_id);
        }
      }

      // Resolve names directly from profiles (RLS now allows account-wide via policy)
      const userIds = Array.from(userSet);
      let profilesByUser: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profRows, error: profErr } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (!profErr && profRows) {
          profilesByUser = Object.fromEntries(
            profRows.map((p: any) => [p.user_id, (p.full_name ?? '').trim()])
          );
        }
      }

      // Build UI maps
      const names: Record<string, string> = {};
      const mine: Record<string, boolean> = {};
      const ids: Record<string, string | null> = {};

      for (const ev of rows) {
        const first = firstByEvent[ev.event_id];
        if (first) {
          ids[ev.event_id] = first.id;
          mine[ev.event_id] = me ? first.user_id === me : false;
          const resolved = profilesByUser[first.user_id] || 'Assigned';
          names[ev.event_id] = resolved;
        } else {
          ids[ev.event_id] = null;
          mine[ev.event_id] = false;
          names[ev.event_id] = 'Unassigned';
        }
      }

      if (!mounted) return;
      setSiblings(rows);
      setAssigneeNameByEvent(names);
      setIsMineByEvent(mine);
      setAssignmentIdByEvent(ids);
    })();
    return () => {
      mounted = false;
    };
  }, [selected.event_id, selected.template_id, selected.account_id, selected.team_id]);

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

  const fmtDayBadge = (iso: string) => {
    const d = new Date(iso);
    return {
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: d.getDate().toString().padStart(2, '0'),
    };
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
      Alert.alert('Request sent', 'Eligible teammates will be notified.');
    } catch (e: any) {
      Alert.alert('Could not open replacement', e?.message ?? 'Please try again.');
    }
  };

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

    const src = (siblings ?? []).find((e) => e.event_id === targetId)!;

    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Propose this swap?',
        `• ${fmtTimeRange(selected.starts_at, selected.ends_at)}\n→\n• ${fmtTimeRange(
          src.starts_at,
          src.ends_at
        )}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Send request', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
    if (!ok) return;

    try {
      await proposeCrossDateSwap(baseAssignmentId, targetAsgId, 'Swap weeks via mobile');
      Alert.alert('Request sent', 'The other person will be notified to accept or decline.');
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
      {/* Base event (fixed card with inline date badge) */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDow}>{fmtDayBadge(selected.starts_at).dow}</Text>
            <Text style={styles.dateDay}>{fmtDayBadge(selected.starts_at).day}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{selected.label}</Text>
            <Text style={styles.cardSub}>
              {selected.account_name ?? 'Account'}
              {selected.team_name ? ` — ${selected.team_name}` : ''}
            </Text>
            <Text style={styles.metaLine}>
              {fmtTimeRange(selected.starts_at, selected.ends_at)}
            </Text>
          </View>
        </View>

        <View style={{ height: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Filled neutral button */}
          <Pressable
            onPress={cantMakeIt}
            style={styles.subtleBtn}
            android_ripple={{ color: '#e5e7eb' }}
            accessibilityRole="button"
            accessibilityLabel="Open replacement request"
          >
            <Text style={styles.subtleBtnText}>Can't make it</Text>
          </Pressable>

          {/* Outline neutral button */}
          <Pressable
            onPress={doProposeCrossDateSwap}
            disabled={!proposeEnabled}
            style={[styles.subtleBtnOutline, !proposeEnabled && { opacity: 0.5 }]}
            android_ripple={{ color: '#e5e7eb' }}
            accessibilityRole="button"
            accessibilityLabel={target ? 'Propose swap' : 'Select a date below to enable swap'}
          >
            <Text style={styles.subtleBtnText}>
              {target ? 'Propose swap' : 'Select a date below'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Section header */}
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>Other events in this series</Text>
      </View>

      {/* Quiet loading line */}
      {siblings === undefined ? (
        <Text style={[styles.meta, { paddingLeft: 2 }]}>Loading entries…</Text>
      ) : null}

      {/* List / empty state (no date badges below) */}
      {siblings !== undefined && (siblings ?? []).length === 0 ? (
        <Text style={styles.meta}>No other upcoming dates.</Text>
      ) : siblings !== undefined ? (
        <FlatList
          data={siblings ?? []}
          keyExtractor={(it) => it.event_id}
          renderItem={({ item }) => {
            const mine = !!isMineByEvent[item.event_id];
            const active = targetId === item.event_id;
            return (
              <Pressable
                onPress={() => setTargetId(item.event_id)}
                style={[
                  styles.cardRow,
                  { marginTop: 8 },
                  active && { borderColor: '#10b981' },
                  mine && { opacity: 0.6 },
                ]}
                android_ripple={{ color: '#e5e7eb' }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.label}`}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardTitle}>{item.label}</Text>
                  <Text style={styles.metaLine}>{fmtTimeRange(item.starts_at, item.ends_at)}</Text>
                  <Text style={styles.assigneeLine}>
                    Assigned: {assigneeNameByEvent[item.event_id] ?? '—'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : null}
    </View>
  );
}

/* ---------- Styles aligned with MyRoster ---------- */
const styles = StyleSheet.create({
  // tokens (mirror MyRoster)
  h1: { fontSize: 18, fontWeight: '700', color: '#111' },
  meta: { fontSize: 13, color: '#6b7280' },
  metaLine: { fontSize: 13, color: '#444' },

  // section bar
  sectionBar: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  sectionBarText: { fontSize: 13, fontWeight: '800', color: '#111', letterSpacing: 0.2 },

  // cards/rows (match MyRoster)
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
  cardRow: {
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardSub: { fontSize: 12, color: '#555', marginTop: 2 },

  assigneeLine: { fontSize: 12, color: '#333' },

  // subtle buttons (filled + outline)
  subtleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#eef1f5', // filled neutral
    borderWidth: 1,
    borderColor: '#ececec',
    alignSelf: 'flex-start',
  },
  subtleBtnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff', // outline variant
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignSelf: 'flex-start',
  },
  subtleBtnText: { fontSize: 12, fontWeight: '800', color: '#111' },

  // date badge (match MyRoster)
  dateBadge: {
    width: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BRAND_BLUE,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateDow: { fontSize: 12, color: BRAND_BLUE, fontWeight: '700' },
  dateDay: { fontSize: 18, color: '#111', fontWeight: '800' },
});
