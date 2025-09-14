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
import { supabase } from '../../lib/supabase';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export default function MyUnavailability() {
  const { accountId: ctxAccountId, accountName } = useCurrent();

  // resolved account id we’ll actually use (auto-picked if user didn’t select)
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvingAcct, setResolvingAcct] = useState(true);

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

  // Resolve an account id automatically so user doesn’t need to pick one
  useEffect(() => {
    let mounted = true;
    (async () => {
      setResolvingAcct(true);
      try {
        // 1) If context selected, use it
        if (ctxAccountId) {
          if (mounted) setResolvedAccountId(ctxAccountId);
          return;
        }
        // 2) Try profiles.default_account_id
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const uid = userRes.user?.id;
        if (!uid) throw new Error('Not signed in');

        const { data: prof } = await supabase
          .from('profiles')
          .select('default_account_id')
          .eq('user_id', uid)
          .maybeSingle();

        if (prof?.default_account_id) {
          if (mounted) setResolvedAccountId(prof.default_account_id);
          return;
        }

        // 3) Fall back to first active account_membership
        const { data: mems } = await supabase
          .from('account_memberships')
          .select('account_id')
          .eq('user_id', uid)
          .eq('status', 'active');

        const first = (mems ?? [])[0]?.account_id ?? null;
        if (mounted) setResolvedAccountId(first ?? null);
      } finally {
        if (mounted) setResolvingAcct(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ctxAccountId]);

  const load = useCallback(async () => {
    if (!resolvedAccountId) {
      setItems([]); // show empty quietly if we couldn’t resolve any account
      return;
    }
    setError(null);
    setRefreshing(true);
    try {
      const rows = await listMyFutureUnavailability(resolvedAccountId);
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load unavailability');
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [resolvedAccountId]);

  useEffect(() => {
    setItems(null);
    if (!resolvingAcct) load();
  }, [resolvingAcct, load]);

  const fmtRange = (sIso: string, eIso: string) => {
    const s = new Date(sIso);
    const e = new Date(eIso);
    const dd = (d: Date) =>
      d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const tt = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    const sameDay = s.toDateString() === e.toDateString();
    return sameDay ? `${dd(s)} • ${tt(s)}–${tt(e)}` : `${dd(s)} ${tt(s)} — ${dd(e)} ${tt(e)}`;
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
    if (!resolvedAccountId) {
      return Alert.alert(
        'No account available',
        'We couldn’t find an account to attach this to. Please create or join an account first.'
      );
    }
    if (endAt <= startAt) return Alert.alert('Invalid time range', 'End must be after start.');
    try {
      setWorking(true);
      await addUnavailabilityRange(resolvedAccountId, startAt, endAt);
      setAddOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Add failed', e?.message ?? 'Could not add unavailability.');
    } finally {
      setWorking(false);
    }
  };

  // Cross-platform date/time pickers
  const pickStart = () =>
    pickDateTime('start', startAt, setStartAt, setIosPickerTarget, setIosPickerMode, setIosTemp);
  const pickEnd = () =>
    pickDateTime('end', endAt, setEndAt, setIosPickerTarget, setIosPickerMode, setIosTemp);

  const Header = () => (
    <View style={{ gap: 14 }}>
      <View style={styles.card}>
        <View style={[styles.rowBetween, { alignItems: 'center' }]}>
          <Text style={styles.h1}>My Unavailability</Text>
          <Pressable
            onPress={openAdd}
            style={styles.primaryBtn}
            android_ripple={{ color: '#2563eb' }}
            disabled={resolvingAcct}
          >
            <Text style={styles.primaryText}>Add</Text>
          </Pressable>
        </View>

        {/* Optional context hint if available; otherwise say nothing */}
        {ctxAccountId && accountName ? (
          <Text style={[styles.meta, { marginTop: 6 }]}>
            Applies across <Text style={{ fontWeight: '800', color: '#111' }}>{accountName}</Text>
          </Text>
        ) : null}

        {error ? <Text style={[styles.meta, { color: '#c00' }]}>{error}</Text> : null}
        {items === null || resolvingAcct ? (
          <View style={{ paddingTop: 6 }}>
            <ActivityIndicator />
          </View>
        ) : null}
      </View>

      <Text style={styles.section}>Upcoming</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      <FlatList
        data={items ?? []}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={<Header />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          items && items.length === 0 ? (
            <Text style={[styles.meta, { padding: 16 }]}>No future unavailability.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => confirmRemove(item.id)}
            style={[styles.card, { marginTop: 10 }]}
            android_ripple={{ color: '#e5e7eb' }}
          >
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
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  {iosPickerMode === 'time' ? (
                    <Pressable
                      onPress={() => {
                        const d = iosTemp;
                        if (iosPickerTarget === 'start') setStartAt(d);
                        else setEndAt(d);
                        setIosPickerTarget(null);
                      }}
                      style={styles.primaryBtn}
                      android_ripple={{ color: '#2563eb' }}
                    >
                      <Text style={styles.primaryText}>Done</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => setIosPickerMode('time')}
                      style={styles.primaryBtn}
                      android_ripple={{ color: '#2563eb' }}
                    >
                      <Text style={styles.primaryText}>Next: Time</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setIosPickerTarget(null)}
                    style={styles.secondaryBtn}
                    android_ripple={{ color: '#e5e7eb' }}
                  >
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={{ height: 10 }} />

            <View style={[styles.rowBetween, { gap: 8 }]}>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={styles.secondaryBtn}
                android_ripple={{ color: '#e5e7eb' }}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
              <Pressable
                onPress={saveAdd}
                disabled={working}
                style={[styles.primaryBtn, working && { opacity: 0.6 }]}
                android_ripple={{ color: '#2563eb' }}
              >
                <Text style={styles.primaryText}>{working ? 'Saving…' : 'Save'}</Text>
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

// Cross-platform "pick a date+time" (fixed iOS target handling)
function pickDateTime(
  target: 'start' | 'end',
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
    setIosTarget(target);
  }
}

/* ---------- Styles (mirrors App.tsx tokens) ---------- */

const styles = StyleSheet.create({
  // tokens
  h1: { fontSize: 18, fontWeight: '700', color: '#111' },
  section: { fontSize: 14, fontWeight: '800', color: '#111', marginTop: 4, marginBottom: 2 },
  meta: { fontSize: 13, color: '#6b7280' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // buttons (match App.tsx)
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  secondaryText: { color: '#111', fontWeight: '800' },

  // cards (match App.tsx)
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

  // list cards
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardSub: { fontSize: 12, color: '#444', marginTop: 2 },
  cardHint: { fontSize: 11, color: '#6b7280', marginTop: 6 },

  // modal
  modalBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#0006',
  },
  modalSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  modalValueBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#eef1f5',
  },
  modalValueText: { fontSize: 14, fontWeight: '700', color: '#111' },

  iosPickLabel: { textAlign: 'center', fontWeight: '700', marginBottom: 4, color: '#111' },
});
