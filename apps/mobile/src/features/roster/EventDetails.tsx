/* eslint-disable no-unused-vars */
// apps/mobile/src/features/roster/EventDetails.tsx
import React, { useEffect, useState } from 'react';
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
  setSelected,
}: {
  selected: SelectedEvent;
  setSelected: (_: SelectedEvent) => void;
}) {
  const [siblings, setSiblings] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selected.template_id) {
        setSiblings([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await getUpcomingEventsByTemplate(selected.template_id, 30);
        if (!mounted) return;
        setSiblings(rows);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selected.template_id]);

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

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, gap: 12 }}>
      {/* Selected event card */}
      <View style={styles.card}>
        <Text style={styles.title}>{selected.label}</Text>
        <Text style={styles.sub}>
          {selected.account_name ?? 'Account'}
          {selected.team_name ? ` — ${selected.team_name}` : ''}
        </Text>
        <Text style={styles.meta}>🗓️ {fmtTimeRange(selected.starts_at, selected.ends_at)}</Text>

        <View style={{ height: 8 }} />
        <Pressable onPress={cantMakeIt} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Can’t make it</Text>
        </Pressable>
      </View>

      {/* Series list */}
      <Text style={styles.h2}>Other dates in this series</Text>
      {!selected.template_id ? (
        <Text style={styles.muted}>This event is not part of a recurring series.</Text>
      ) : loading ? (
        <ActivityIndicator />
      ) : (siblings ?? []).length === 0 ? (
        <Text style={styles.muted}>No other upcoming dates.</Text>
      ) : (
        <FlatList
          data={siblings}
          keyExtractor={(it) => it.event_id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                setSelected({
                  ...selected,
                  event_id: item.event_id,
                  label: item.label,
                  starts_at: item.starts_at,
                  ends_at: item.ends_at,
                  account_id: item.account_id,
                  team_id: item.team_id,
                })
              }
              style={[
                styles.row,
                item.event_id === selected.event_id && { borderColor: '#3b82f6' },
              ]}
            >
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.rowMeta}>{fmtTimeRange(item.starts_at, item.ends_at)}</Text>
            </Pressable>
          )}
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
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  rowMeta: { fontSize: 12, color: '#555', marginTop: 2 },
  muted: { color: '#666' },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
});
