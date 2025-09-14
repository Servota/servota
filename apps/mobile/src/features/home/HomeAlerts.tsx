// apps/mobile/src/features/home/HomeAlerts.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Modal } from 'react-native';
import { useCurrent } from '../../context/CurrentContext';
import { claimReplacement } from '../../api/replacements';
import { supabase } from '../../lib/supabase';

type OfferRow = {
  request_id: string;
  account_id: string;
  team_id: string | null;
  event_id: string;
  label: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  requester_user_id: string | null;
  requester_name: string | null;
};

export default function HomeAlerts() {
  const { accountId, teamId } = useCurrent();

  // Data state
  const [items, setItems] = useState<OfferRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Modal state
  const [selected, setSelected] = useState<OfferRow | null>(null);

  const scopeKey = useMemo(() => `${accountId ?? 'null'}:${teamId ?? 'null'}`, [accountId, teamId]);

  // ---- Helpers ----
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const fmtTime = (iso: string) =>
    new Date(iso)
      .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      .replace(' ', '');

  // ---- Effects ----

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

  // Load replacement offers via RPC (scoped)
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Only show spinner if we already showed visible content
      if (hasLoadedOnce && (items?.length ?? 0) > 0) setLoading(true);

      try {
        // Omit generics; cast after to keep TS happy in all setups
        const { data, error } = await supabase.rpc('list_replacement_offers', {
          _account_id: accountId ?? null,
          _team_id: teamId ?? null,
          _limit: 10,
        });
        if (error) throw error;
        if (!mounted) return;

        const rows: OfferRow[] = (data ?? []) as OfferRow[];

        // Exclude my own requests (the requester shouldn’t see their own request)
        const filtered = myUserId
          ? rows.filter((r: OfferRow) => r.requester_user_id !== myUserId)
          : rows;

        setItems(filtered);
      } catch {
        if (mounted) setItems((prev) => prev ?? null); // keep previous if any
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
  }, [scopeKey, myUserId, hasLoadedOnce]);

  // ---- Modal handlers ----
  const openDetails = (row: OfferRow) => setSelected(row);

  const onClaim = async (reqId: string) => {
    Alert.alert('Claim this shift?', 'You will be assigned to this event.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim',
        style: 'default',
        onPress: async () => {
          try {
            await claimReplacement(reqId);
            Alert.alert('Claimed!', 'You have been assigned to this event.');
            setItems((prev) => (prev ?? []).filter((r) => r.request_id !== reqId)); // optimistic remove
            setSelected(null);
          } catch (e: any) {
            Alert.alert('Could not claim', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const onHide = (reqId: string) => {
    setItems((prev) => (prev ?? []).filter((r) => r.request_id !== reqId)); // local hide only
    setSelected(null);
  };

  // ---- Render rules ----

  // Silent first mount
  if (!hasLoadedOnce) return null;

  // No data → render nothing (no empty placeholder)
  if (!items || items.length === 0) return null;

  const top = items.slice(0, 3);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Replacement requests</Text>
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>

        {top.map((r) => (
          <View key={r.request_id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{r.label}</Text>
              {/* Card shows DATE ONLY (no times) */}
              <Text style={styles.itemSub}>{fmtDate(r.starts_at)}</Text>
            </View>
            <Pressable onPress={() => openDetails(r)} style={styles.detailsBtn}>
              <Text style={styles.detailsText}>Details</Text>
            </Pressable>
          </View>
        ))}
        {items.length > top.length ? (
          <Text style={styles.moreHint}>+{items.length - top.length} more available</Text>
        ) : null}
      </View>

      {/* Details Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Replacement details</Text>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>

            {selected ? (
              <>
                {/* Date & time layout as requested */}
                <Text style={styles.modalLineTitle}>{selected.label}</Text>
                <Text style={styles.modalLine}>{fmtDate(selected.starts_at)}</Text>
                <Text style={styles.modalLine}>
                  {fmtTime(selected.starts_at)}–{fmtTime(selected.ends_at)}
                </Text>

                <View style={{ height: 8 }} />

                <Text style={styles.modalSubtle}>
                  Requested by: {selected.requester_name?.trim() || 'Member'}
                </Text>

                <View style={{ height: 12 }} />

                <View style={styles.modalActions}>
                  <Pressable onPress={() => onClaim(selected.request_id)} style={styles.claimBtn}>
                    <Text style={styles.claimText}>Claim</Text>
                  </Pressable>
                  <Pressable onPress={() => onHide(selected.request_id)} style={styles.hideBtn}>
                    <Text style={styles.hideText}>Hide</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
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

  detailsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  detailsText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  moreHint: { fontSize: 12, color: '#666', marginTop: 8, textAlign: 'right' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  modalClose: { fontSize: 12, color: '#666' },
  modalLineTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  modalLine: { fontSize: 13, color: '#333', marginTop: 2 },
  modalSubtle: { fontSize: 12, color: '#666', marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },

  claimBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  claimText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  hideBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  hideText: { color: '#111', fontWeight: '800', fontSize: 12 },
});
