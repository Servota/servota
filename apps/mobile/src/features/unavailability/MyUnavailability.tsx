// apps/mobile/src/features/unavailability/MyUnavailability.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
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
  const { accountId: ctxAccountId } = useCurrent();

  // resolved account id we’ll actually use (auto-picked if user didn’t select)
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvingAcct, setResolvingAcct] = useState(true);

  // list state — initialise to [] so there’s no flicker
  const [items, setItems] = useState<Unavailability[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add modal state (date-only)
  const today = stripTime(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [startDay, setStartDay] = useState<Date>(today);
  const [endDay, setEndDay] = useState<Date>(today);
  const [working, setWorking] = useState(false);

  // Remove confirm modal
  const [removeTarget, setRemoveTarget] = useState<Unavailability | null>(null);
  const [removing, setRemoving] = useState(false);

  // iOS inline picker flow (date-only)
  const [iosPickerTarget, setIosPickerTarget] = useState<'start' | 'end' | null>(null);
  const [iosTemp, setIosTemp] = useState<Date>(today);

  // Resolve an account id automatically so user doesn’t need to pick one
  useEffect(() => {
    let mounted = true;
    (async () => {
      setResolvingAcct(true);
      try {
        if (ctxAccountId) {
          if (mounted) setResolvedAccountId(ctxAccountId);
          return;
        }
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
      setItems([]);
      setHasLoadedOnce(true);
      return;
    }
    setError(null);
    try {
      const rows = await listMyFutureUnavailability(resolvedAccountId);
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load unavailability');
    } finally {
      setHasLoadedOnce(true);
    }
  }, [resolvedAccountId]);

  useEffect(() => {
    if (!resolvingAcct) load();
  }, [resolvingAcct, load]);

  // ----- UI helpers -----
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const fmtIsoDay = (iso: string) => fmtDay(stripTime(new Date(iso)));

  // Add modal actions
  const openAdd = () => {
    const today0 = stripTime(new Date());
    setStartDay(today0);
    setEndDay(today0);
    setAddOpen(true);
  };

  const saveAdd = async () => {
    if (!resolvedAccountId) {
      return Alert.alert(
        'No account available',
        'We couldn’t find an account to attach this to. Please create or join an account first.'
      );
    }
    if (endDay < startDay) {
      return Alert.alert('Invalid date range', '“To” must be the same day or after “From”.');
    }
    try {
      setWorking(true);
      const starts_at = normalizeStart(startDay); // 00:00
      const ends_at = normalizeEnd(endDay); // 23:59:59.999
      await addUnavailabilityRange(resolvedAccountId, starts_at, ends_at);
      setAddOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Add failed', e?.message ?? 'Could not add unavailability.');
    } finally {
      setWorking(false);
    }
  };

  // Remove flow
  const doRemove = async () => {
    const id = removeTarget?.id;
    if (!id) return;
    try {
      setRemoving(true);
      await removeUnavailability(id);
      setRemoveTarget(null);
      await load();
    } catch (e: any) {
      Alert.alert('Remove failed', e?.message ?? 'Could not remove entry.');
    } finally {
      setRemoving(false);
    }
  };

  // Date pickers (date-only) with minDate on “To”
  const pickStart = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startDay,
        mode: 'date',
        onChange: (ev, date) => {
          if (ev.type !== 'set' || !date) return;
          const d = stripTime(date);
          setStartDay(d);
          setEndDay((prev) => (prev < d ? d : prev));
        },
      });
    } else {
      setIosTemp(startDay);
      setIosPickerTarget('start');
    }
  };

  const pickEnd = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: endDay,
        mode: 'date',
        minimumDate: startDay,
        onChange: (ev, date) => {
          if (ev.type !== 'set' || !date) return;
          const d = stripTime(date);
          if (d < startDay) return;
          setEndDay(d);
        },
      });
    } else {
      setIosTemp(endDay);
      setIosPickerTarget('end');
    }
  };

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
        {error ? <Text style={[styles.meta, { color: '#c00' }]}>{error}</Text> : null}
      </View>

      <Text style={styles.section}>Upcoming</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={<Header />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={
          // calm text while first load happens, no spinner/flicker
          !hasLoadedOnce ? (
            <Text style={[styles.meta, { padding: 16 }]}>Loading entries…</Text>
          ) : items.length === 0 ? (
            <Text style={[styles.meta, { padding: 16 }]}>No future unavailability.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { marginTop: 10 }]}>
            <View style={[styles.rowBetween, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.label}>From</Text>
                <Text style={styles.cardTitle}>{fmtIsoDay(item.starts_at)}</Text>
                <Text style={[styles.label, { marginTop: 6 }]}>To</Text>
                <Text style={styles.cardTitle}>{fmtIsoDay(item.ends_at)}</Text>
                {item.reason ? <Text style={styles.cardSub}>{item.reason}</Text> : null}
              </View>

              {/* Subtle grey × button */}
              <Pressable
                onPress={() => setRemoveTarget(item)}
                style={styles.closeBtn}
                android_ripple={{ color: '#e5e7eb' }}
                accessibilityLabel="Remove unavailability"
              >
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>
          </View>
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
                <Text style={styles.modalValueText}>{fmtDay(startDay)}</Text>
              </Pressable>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>To</Text>
              <Pressable onPress={pickEnd} style={styles.modalValueBtn}>
                <Text style={styles.modalValueText}>{fmtDay(endDay)}</Text>
              </Pressable>
            </View>

            {/* iOS inline picker area (date only) */}
            {Platform.OS === 'ios' && iosPickerTarget && (
              <View style={{ paddingTop: 6 }}>
                <Text style={styles.iosPickLabel}>
                  {iosPickerTarget === 'start' ? 'Set start date' : 'Set end date'}
                </Text>
                <DateTimePicker
                  value={iosTemp}
                  mode="date"
                  display="spinner"
                  minimumDate={iosPickerTarget === 'end' ? startDay : undefined}
                  onChange={(_, d) => {
                    if (!d) return;
                    const clean = stripTime(d);
                    setIosTemp(clean);
                  }}
                  style={{ alignSelf: 'center' }}
                />
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <Pressable
                    onPress={() => {
                      if (iosPickerTarget === 'start') {
                        setStartDay(iosTemp);
                        setEndDay((prev) => (prev < iosTemp ? iosTemp : prev));
                      } else {
                        if (iosTemp >= startDay) setEndDay(iosTemp);
                      }
                      setIosPickerTarget(null);
                    }}
                    style={styles.primaryBtn}
                    android_ripple={{ color: '#2563eb' }}
                  >
                    <Text style={styles.primaryText}>Done</Text>
                  </Pressable>
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

      {/* Remove confirm modal (small, centered) */}
      <Modal
        visible={!!removeTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveTarget(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remove this unavailability?</Text>
            <Text style={styles.meta}>This cannot be undone.</Text>

            <View style={[styles.rowBetween, { marginTop: 12, gap: 8 }]}>
              <Pressable
                onPress={() => setRemoveTarget(null)}
                style={styles.secondaryBtn}
                android_ripple={{ color: '#e5e7eb' }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={doRemove}
                disabled={removing}
                style={[styles.dangerOutlineBtn, removing && { opacity: 0.7 }]}
                android_ripple={{ color: '#e5e7eb' }}
              >
                <Text style={styles.dangerOutlineText}>{removing ? 'Removing…' : 'Remove'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Helpers ---------- */

// strip any time, keep local date (00:00 local)
function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function normalizeStart(day: Date) {
  const s = new Date(day);
  s.setHours(0, 0, 0, 0);
  return s;
}

function normalizeEnd(day: Date) {
  const e = new Date(day);
  e.setHours(23, 59, 59, 999);
  return e;
}

/* ---------- Styles (mirrors App.tsx tokens) ---------- */

const styles = StyleSheet.create({
  // tokens
  h1: { fontSize: 18, fontWeight: '700', color: '#111' },
  section: { fontSize: 14, fontWeight: '800', color: '#111', marginTop: 4, marginBottom: 2 },
  meta: { fontSize: 13, color: '#6b7280' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  label: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 },

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

  // list card text
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardSub: { fontSize: 12, color: '#444', marginTop: 6 },

  // subtle grey "×" button
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeIcon: { fontSize: 18, color: '#111', lineHeight: 18, textAlign: 'center' },

  // modal (add)
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

  // confirm modal (centered)
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  confirmCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  confirmTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 6 },

  // subtle destructive (grey outline to match your theme)
  dangerOutlineBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  dangerOutlineText: { color: '#111', fontWeight: '800' },
});
