/* eslint-disable no-unused-vars */
// apps/mobile/src/features/unavailability/MyUnavailability.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useCurrent } from '../../context/CurrentContext';
import {
  listMyFutureUnavailability,
  addUnavailabilityRange,
  removeUnavailability,
  type Unavailability,
} from '../../api/unavailability';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export default function MyUnavailability() {
  const { accountId, accountName } = useCurrent();
  const [items, setItems] = useState<Unavailability[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [startAt, setStartAt] = useState<Date>(roundToNext15(new Date()));
  const [endAt, setEndAt] = useState<Date>(roundToNext15(new Date(Date.now() + 60 * 60 * 1000)));
  const [working, setWorking] = useState(false);

  // iOS inline picker flow
  const [iosPickerTarget, setIosPickerTarget] = useState<'start' | 'end' | null>(null);
  const [iosPickerMode, setIosPickerMode] = useState<'date' | 'time'>('date');
  const [iosTemp, setIosTemp] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!accountId) {
      setItems([]);
      return;
    }
    setError(null);
    setRefreshing(true);
    try {
      const rows = await listMyFutureUnavailability(accountId);
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load unavailability');
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [accountId]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const fmtRange = (sIso: string, eIso: string) => {
    const s = new Date(sIso);
    const e = new Date(eIso);
    const dd = (d: Date) =>
      d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    const tt = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    const sameDay = s.toDateString() === e.toDateString();
    return sameDay ? `${dd(s)} • ${tt(s)}–${tt(e)}` : `${dd(s)} ${tt(s)} → ${dd(e)} ${tt(e)}`;
  };

  const confirmRemove = (id: string) => {
    Alert.alert('Remove unavailability?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeUnavailability(id);
            await load();
          } catch (e: any) {
            Alert.alert('Remove failed', e?.message ?? 'Could not remove entry.');
          }
        },
      },
    ]);
  };

  const openAdd = () => {
    setStartAt(roundToNext15(new Date()));
    setEndAt(roundToNext15(new Date(Date.now() + 60 * 60 * 1000)));
    setAddOpen(true);
  };

  const saveAdd = async () => {
    if (!accountId) return;
    if (endAt <= startAt) return Alert.alert('Invalid time range', 'End must be after start.');
    try {
      setWorking(true);
      await addUnavailabilityRange(accountId, startAt, endAt);
      setAddOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Add failed', e?.message ?? 'Could not add unavailability.');
    } finally {
      setWorking(false);
    }
  };

  // Cross-platform picker handlers
  const pickStart = () =>
    pickDateTime(startAt, setStartAt, setIosPickerTarget, setIosPickerMode, setIosTemp);
  const pickEnd = () =>
    pickDateTime(endAt, setEndAt, setIosPickerTarget, setIosPickerMode, setIosTemp);

  const Header = () => (
    <View style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.h1}>My Unavailability</Text>
        <Pressable
          disabled={!accountId}
          onPress={openAdd}
          style={[styles.addBtn, !accountId && styles.addBtnDisabled]}
        >
          <Text style={styles.addBtnText}>＋ Add</Text>
        </Pressable>
      </View>

      {accountId ? (
        <Text style={styles.muted}>
          For <Text style={{ fontWeight: '700', color: '#111' }}>{accountName}</Text>
        </Text>
      ) : (
        <Text style={styles.muted}>
          Select an account in <Text style={{ fontWeight: '700', color: '#111' }}>Memberships</Text>{' '}
          to manage unavailability.
        </Text>
      )}

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {items === null ? (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator />
        </View>
      ) : null}

      <Text style={styles.section}>Upcoming</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items ?? []}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={<Header />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          items && items.length === 0 ? (
            <Text style={[styles.muted, { padding: 16 }]}>
              {accountId
                ? 'No future unavailability.'
                : 'Select an account to view unavailability.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => confirmRemove(item.id)} style={styles.card}>
            <Text style={styles.cardTitle}>{fmtRange(item.starts_at, item.ends_at)}</Text>
            {item.reason ? <Text style={styles.cardSub}>{item.reason}</Text> : null}
            <Text style={styles.cardHint}>Long-press to remove</Text>
          </Pressable>
        )}
      />

      {/* Add modal */}
      {addOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)}>
            <View />
          </Pressable>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add unavailability</Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>From</Text>
              <Pressable onPress={pickStart} style={styles.modalValueBtn}>
                <Text style={styles.modalValueText}>{fmtDateTimeInline(startAt)}</Text>
              </Pressable>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>To</Text>
              <Pressable onPress={pickEnd} style={styles.modalValueBtn}>
                <Text style={styles.modalValueText}>{fmtDateTimeInline(endAt)}</Text>
              </Pressable>
            </View>

            {/* iOS inline picker area */}
            {Platform.OS === 'ios' && iosPickerTarget && (
              <View style={{ paddingTop: 6 }}>
                <Text style={styles.iosPickLabel}>
                  {iosPickerTarget === 'start' ? 'Set start' : 'Set end'} —{' '}
                  {iosPickerMode === 'date' ? 'Date' : 'Time'}
                </Text>
                <DateTimePicker
                  value={iosTemp}
                  mode={iosPickerMode}
                  display="spinner"
                  onChange={(_, d) => {
                    if (!d) return;
                    setIosTemp(d);
                  }}
                  style={{ alignSelf: 'center' }}
                />
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}
                >
                  {iosPickerMode === 'time' ? (
                    <Pressable
                      onPress={() => {
                        const d = iosTemp;
                        if (iosPickerTarget === 'start') setStartAt(d);
                        else setEndAt(d);
                        setIosPickerTarget(null);
                      }}
                      style={[styles.actionBtn, styles.primaryBtn]}
                    >
                      <Text style={styles.actionText}>Done</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setIosPickerMode('time')}
                      style={[styles.actionBtn, styles.primaryBtn]}
                    >
                      <Text style={styles.actionText}>Next: Time</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setIosPickerTarget(null)}
                    style={[styles.actionBtn, styles.secondaryBtn]}
                  >
                    <Text style={styles.actionText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={{ height: 10 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={[styles.actionBtn, styles.secondaryBtn]}
              >
                <Text style={styles.actionText}>Close</Text>
              </Pressable>
              <Pressable
                onPress={saveAdd}
                disabled={working}
                style={[styles.actionBtn, styles.primaryBtn]}
              >
                <Text style={styles.actionText}>{working ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/* ---------- Helpers ---------- */

function roundToNext15(d: Date) {
  const ms = 1000 * 60 * 15;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}

function fmtDateTimeInline(d: Date) {
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(' ', '');
  return `${date} • ${time}`;
}

// Cross-platform "pick a date+time"
function pickDateTime(
  current: Date,
  setter: (_: Date) => void,
  setIosTarget: (_: 'start' | 'end' | null) => void,
  setIosMode: (_: 'date' | 'time') => void,
  setIosTemp: (_: Date) => void
) {
  if (Platform.OS === 'android') {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onChange: (ev, date) => {
        if (ev.type !== 'set' || !date) return;
        const pickedDate = date;
        DateTimePickerAndroid.open({
          value: current,
          mode: 'time',
          onChange: (ev2, time) => {
            if (ev2.type !== 'set' || !time) return;
            const merged = new Date(pickedDate);
            merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
            setter(merged);
          },
        });
      },
    });
  } else {
    setIosTemp(current);
    setIosMode('date');
    setIosTarget('start');
  }
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800' },
  section: { fontSize: 14, fontWeight: '700' },
  muted: { color: '#666' },
  err: { color: '#c00' },

  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
  },
  addBtnDisabled: { backgroundColor: '#9dbcf7' },
  addBtnText: { color: '#fff', fontWeight: '800' },

  card: {
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardSub: { fontSize: 12, color: '#555' },
  cardHint: { fontSize: 11, color: '#888', marginTop: 2 },

  modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: '#0008' },
  modalSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalLabel: { fontSize: 14, fontWeight: '700' },
  modalValueBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f5f7fb',
  },
  modalValueText: { fontSize: 14, fontWeight: '700', color: '#111' },

  iosPickLabel: { textAlign: 'center', fontWeight: '700', marginBottom: 4 },

  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  primaryBtn: { backgroundColor: '#3b82f6' },
  secondaryBtn: { backgroundColor: '#eef1f5' },
  actionText: { color: '#fff', fontWeight: '800' },
});
