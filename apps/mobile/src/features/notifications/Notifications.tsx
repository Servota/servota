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
  Switch,
  Alert,
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
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [showRead, setShowRead] = useState(false);

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
      setItems(rows);
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
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } else if (error) {
      console.warn('mark_notification_read failed', error);
    }
    setMarking(null);
  }

  /* ---------- Swap helpers ---------- */
  function isSwapRequest(n: NotificationRow): boolean {
    const d = (n.data || {}) as any;
    const hasReq = d?.request_id || d?.swap_request_id || d?.p_request_id;
    return /^swap_requested$/i.test(n.type) && !!hasReq;
  }
  function getSwapRequestId(n: NotificationRow): string | null {
    const d = (n.data || {}) as any;
    return d?.request_id || d?.swap_request_id || d?.p_request_id || null;
  }
  function isSwapOutcome(n: NotificationRow): boolean {
    return /^swap_accepted$/i.test(n.type) || /^swap_declined$/i.test(n.type);
  }
  // chip for read original swap request only
  function swapRequestOutcomeChip(n: NotificationRow): string | null {
    if (!n.read_at || !isSwapRequest(n)) return null;
    const outcome = ((n.data || {}) as any)?.outcome;
    if (outcome === 'accept') return 'Accepted';
    if (outcome === 'decline') return 'Declined';
    return null;
  }

  /* ---------- Replacement helpers ---------- */
  function isReplacementRequest(n: NotificationRow): boolean {
    const d = (n.data || {}) as any;
    const hasId = d?.replacement_request_id || d?.request_id || d?.p_replacement_request_id;
    return /replacement/i.test(n.type || '') && !!hasId && !/claimed|filled/i.test(n.type);
  }
  function getReplacementRequestId(n: NotificationRow): string | null {
    const d = (n.data || {}) as any;
    return d?.replacement_request_id || d?.request_id || d?.p_replacement_request_id || null;
  }
  function isReplacementOutcome(n: NotificationRow): boolean {
    return /^replacement_(claimed|filled)$/i.test(n.type);
  }
  // chip for read original replacement request (ignored/claimed)
  function replacementRequestOutcomeChip(n: NotificationRow): string | null {
    if (!n.read_at || !isReplacementRequest(n)) return null;
    const outcome = ((n.data || {}) as any)?.outcome;
    if (outcome === 'claim') return 'Claimed';
    if (outcome === 'ignore') return 'Ignored';
    return null;
  }

  /* ---------- Swap actions ---------- */
  async function respondSwap(n: NotificationRow, action: 'accept' | 'decline') {
    const reqId = getSwapRequestId(n);
    if (!reqId) return;

    const confirmTitle = action === 'accept' ? 'Accept this swap?' : 'Decline this swap?';
    const confirmMsg =
      action === 'accept' ? 'Your assignment will be exchanged.' : 'This request will be declined.';

    Alert.alert(confirmTitle, confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'accept' ? 'Accept' : 'Decline',
        onPress: async () => {
          try {
            setWorkingId(n.id);
            if (action === 'accept') {
              const { error } = await (supabase as any).rpc('accept_and_apply_swap', {
                p_swap_request_id: reqId,
              });
              if (error) throw error;
            } else {
              const { error } = await (supabase as any).rpc('respond_cross_date_swap', {
                p_swap_request_id: reqId,
                p_action: 'decline',
              });
              if (error) throw error;
            }

            // Persist outcome on server (so chip survives refresh), and keep it visible briefly
            await (supabase as any).rpc('mark_notification_outcome', {
              p_id: n.id,
              p_outcome: action === 'accept' ? 'accept' : 'decline',
            });

            setItems((prev) =>
              prev.map((m) =>
                m.id === n.id
                  ? {
                      ...m,
                      read_at: new Date().toISOString(),
                      data: { ...(m.data || {}), outcome: action, __justActed: true },
                    }
                  : m
              )
            );

            if (action === 'accept') {
              Alert.alert('Swapped!', 'The swap has been accepted and applied.');
            }
          } catch (e: any) {
            Alert.alert('Failed', String(e?.message ?? 'Please try again.'));
          } finally {
            setWorkingId(null);
          }
        },
      },
    ]);
  }

  /* ---------- Replacement actions ---------- */
  async function claimReplacement(n: NotificationRow) {
    const reqId = getReplacementRequestId(n);
    if (!reqId) return;

    try {
      setWorkingId(n.id);

      const u = await supabase.auth.getUser();
      const me = u.data?.user?.id;
      if (!me) throw new Error('Not signed in');

      const { error } = await (supabase as any).rpc('fn_claim_replacement', {
        p_replacement_request_id: reqId,
        p_claimant_user_id: me,
      });
      if (error) {
        const msg = String(error.message || '');
        if (/already.*filled|already.*closed/i.test(msg)) {
          Alert.alert(
            'Already filled',
            'Thanks for putting your hand up, but this one has already been claimed.'
          );
        } else {
          throw error;
        }
      } else {
        Alert.alert('Claimed!', 'You have been assigned to this event.');

        // Persist outcome on server and show chip now
        await (supabase as any).rpc('mark_notification_outcome', {
          p_id: n.id,
          p_outcome: 'claim',
        });

        setItems((prev) =>
          prev.map((m) =>
            m.id === n.id
              ? {
                  ...m,
                  read_at: new Date().toISOString(),
                  data: { ...(m.data || {}), outcome: 'claim', __justActed: true },
                }
              : m
          )
        );
      }
    } catch (e: any) {
      Alert.alert('Failed', String(e?.message ?? 'Please try again.'));
    } finally {
      setWorkingId(null);
    }
  }

  async function ignoreReplacement(n: NotificationRow) {
    // Persist ignore outcome and show chip now
    await (supabase as any).rpc('mark_notification_outcome', {
      p_id: n.id,
      p_outcome: 'ignore',
    });

    setItems((prev) =>
      prev.map((m) =>
        m.id === n.id
          ? {
              ...m,
              read_at: new Date().toISOString(),
              data: { ...(m.data || {}), outcome: 'ignore', __justActed: true },
            }
          : m
      )
    );
  }

  /* ---------- shared ---------- */
  function formatDate(d: unknown) {
    if (!d) return '—';
    const date = new Date(String(d));
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  useEffect(() => {
    load();
  }, [load]);

  // Keep just-acted read items visible in Unread until next refresh
  const visible = showRead
    ? items
    : items.filter((n) => {
        const d = (n.data || {}) as any;
        return !n.read_at || d?.__justActed === true;
      });

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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>Notifications</Text>
            <Text style={styles.meta}>{showRead ? 'All alerts' : 'Unread only'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.meta}>Show read</Text>
            <Switch value={showRead} onValueChange={setShowRead} />
          </View>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
        data={visible}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => {
          const data = (item.data || {}) as any;

          const isSwapReq = isSwapRequest(item);
          const isSwapOut = isSwapOutcome(item);

          const isReplReq = isReplacementRequest(item);
          const isReplOut = isReplacementOutcome(item);

          const swapChip = swapRequestOutcomeChip(item);
          const replChip = replacementRequestOutcomeChip(item);

          const actor = data?.actor_name || 'member';
          const outcomeText =
            isSwapOut && item.type === 'swap_accepted'
              ? `Your swap request has been accepted by ${actor}.`
              : isSwapOut && item.type === 'swap_declined'
                ? `Your swap request has been declined by ${actor}.`
                : isReplOut && item.type === 'replacement_claimed'
                  ? `${actor} has claimed your replacement request.`
                  : isReplOut && item.type === 'replacement_filled'
                    ? `Your replacement request has been filled.`
                    : null;

          // Normalised header title per card type
          const headerTitle = isSwapReq
            ? 'Swap Request'
            : isSwapOut
              ? item.type === 'swap_accepted'
                ? 'Swap Accepted'
                : 'Swap Declined'
              : isReplReq
                ? 'Replacement Request'
                : isReplOut
                  ? item.type === 'replacement_claimed'
                    ? 'Replacement Claimed'
                    : 'Replacement Filled'
                  : item.title;

          return (
            <View style={[styles.item, item.read_at ? { opacity: 0.7 } : null]}>
              {/* chips: only on original request cards after read */}
              {swapChip && <Text style={styles.statusChip}>{swapChip}</Text>}
              {replChip && <Text style={styles.statusChip}>{replChip}</Text>}

              <View style={{ flex: 1, paddingRight: 10 }}>
                {/* Title row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={[styles.dot, { backgroundColor: item.read_at ? '#d1d5db' : '#0ea5e9' }]}
                  />
                  <Text numberOfLines={1} style={styles.title}>
                    {headerTitle}
                  </Text>
                </View>

                {/* Body */}
                {isSwapOut || isReplOut ? (
                  <>
                    {outcomeText ? (
                      <Text style={[styles.body, { marginTop: 6 }]}>{outcomeText}</Text>
                    ) : null}
                  </>
                ) : isSwapReq ? (
                  <>
                    <Text style={styles.body}>{item.title}</Text>
                    <Text style={styles.meta}>Theirs: {formatDate(data?.from_date)}</Text>
                    <Text style={styles.meta}>Yours: {formatDate(data?.to_date)}</Text>
                  </>
                ) : isReplReq ? (
                  <>
                    <Text style={styles.body}>{item.title}</Text>
                    {data?.event_date && (
                      <Text style={styles.meta}>Date: {formatDate(data?.event_date)}</Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.body}>{item.body}</Text>
                    <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                  </>
                )}
              </View>

              {/* Actions */}
              {!item.read_at && isSwapReq && (
                <View style={{ gap: 6 }}>
                  <Pressable
                    onPress={() => respondSwap(item, 'accept')}
                    disabled={workingId === item.id}
                    style={[styles.acceptBtn, workingId === item.id && { opacity: 0.6 }]}
                    android_ripple={{ color: '#166534' }}
                  >
                    <Text style={styles.acceptText}>
                      {workingId === item.id ? 'Working…' : 'Accept'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respondSwap(item, 'decline')}
                    disabled={workingId === item.id}
                    style={[styles.declineBtn, workingId === item.id && { opacity: 0.6 }]}
                    android_ripple={{ color: '#991b1b' }}
                  >
                    <Text style={styles.declineText}>Decline</Text>
                  </Pressable>
                </View>
              )}

              {!item.read_at && isReplReq && (
                <View style={{ gap: 6 }}>
                  <Pressable
                    onPress={() => claimReplacement(item)}
                    disabled={workingId === item.id}
                    style={[styles.acceptBtn, workingId === item.id && { opacity: 0.6 }]}
                    android_ripple={{ color: '#166534' }}
                  >
                    <Text style={styles.acceptText}>
                      {workingId === item.id ? 'Working…' : 'Claim'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => ignoreReplacement(item)}
                    disabled={workingId === item.id}
                    style={[styles.ignoreBtn, workingId === item.id && { opacity: 0.6 }]}
                    android_ripple={{ color: '#e5e7eb' }}
                  >
                    <Text style={styles.ignoreText}>Ignore</Text>
                  </Pressable>
                </View>
              )}

              {/* Mark read on informational & general */}
              {!item.read_at && !isSwapReq && !isReplReq && (
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
              )}
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.meta}>No notifications to display.</Text>}
      />
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13, color: '#444', marginTop: 4 },
  item: {
    position: 'relative',
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

  // chip for read original request only
  statusChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    color: '#111',
    backgroundColor: '#eef1f5',
  },

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

  acceptBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 92,
    alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '800' },
  declineBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 92,
    alignItems: 'center',
  },
  declineText: { color: '#fff', fontWeight: '800' },

  ignoreBtn: {
    backgroundColor: '#eef1f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 92,
    alignItems: 'center',
  },
  ignoreText: { color: '#111', fontWeight: '800' },
});
