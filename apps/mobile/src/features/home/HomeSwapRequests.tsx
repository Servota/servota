// apps/mobile/src/features/home/HomeSwapRequests.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal } from 'react-native';
import { useCurrent } from '../../context/CurrentContext';
import { supabase } from '../../lib/supabase';
import { respondCrossDateSwap } from '../../api/swaps';

type Row = {
  id: string;
  account_id: string;
  team_id: string | null;
  from_user_id: string | null;
  to_user_id: string | null;
  from_event_label: string;
  from_starts: string;
  from_ends: string;
  to_event_label: string;
  to_starts: string;
  to_ends: string;
  requester_name: string | null;
};

export default function HomeSwapRequests() {
  const { accountId, teamId } = useCurrent();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Modal
  const [selected, setSelected] = useState<Row | null>(null);

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

  // Load pending swaps via RPC (silent; no spinners)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('list_pending_swaps', {
          _account_id: accountId ?? null,
          _team_id: teamId ?? null,
          _limit: 10,
        });
        if (error) throw error;
        if (!mounted) return;
        setRows((data ?? []) as Row[]);
      } catch {
        if (mounted) setRows((prev) => prev ?? null);
      } finally {
        if (mounted) setHasLoadedOnce(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accountId, teamId]);

  const onRespond = (id: string, action: 'accept' | 'decline') => {
    const title = action === 'accept' ? 'Accept this swap?' : 'Decline this swap?';
    const body =
      action === 'accept' ? 'Your assignment will be exchanged.' : 'This request will be declined.';
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action === 'accept' ? 'Accept' : 'Decline',
        style: 'default',
        onPress: async () => {
          try {
            await respondCrossDateSwap(id, action);
            setRows((prev) => (prev ?? []).filter((x) => x.id !== id));
            setSelected(null);
            if (action === 'accept') Alert.alert('Swapped!');
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const openDetails = (row: Row) => setSelected(row);

  // Render rules
  if (!hasLoadedOnce) return null;
  if (!rows || rows.length === 0) return null;

  const top = rows.slice(0, 3);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>Swap requests</Text>
        </View>

        {top.map((r) => (
          <View key={r.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              {/* Title: your shift name (like HomeAlerts) */}
              <Text style={styles.itemTitle}>{r.to_event_label}</Text>
              {/* Subtitle: Date(yours) → Date(theirs) */}
              <Text style={styles.itemSub}>
                {fmtDate(r.to_starts)} → {fmtDate(r.from_starts)}
              </Text>
            </View>

            <Pressable onPress={() => openDetails(r)} style={styles.detailsBtn}>
              <Text style={styles.detailsText}>Details</Text>
            </Pressable>
          </View>
        ))}

        {rows.length > top.length ? (
          <Text style={styles.moreHint}>+{rows.length - top.length} more pending</Text>
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
              <Text style={styles.modalTitle}>Swap details</Text>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>

            {selected ? (
              <>
                {/* Name + clear context */}
                <Text style={styles.modalIntro}>
                  {selected.requester_name || 'Member'} has requested to swap
                </Text>

                <View style={{ height: 10 }} />

                {/* Their shift */}
                <Text style={styles.groupLabel}>Their shift</Text>
                <Text style={styles.modalLineTitle}>{selected.from_event_label}</Text>
                <Text style={styles.modalLine}>{fmtDate(selected.from_starts)}</Text>
                <Text style={styles.modalLine}>
                  {fmtTime(selected.from_starts)}–{fmtTime(selected.from_ends)}
                </Text>

                <View style={{ height: 12 }} />

                {/* With your shift */}
                <Text style={styles.groupLabel}>With your shift</Text>
                <Text style={styles.modalLineTitle}>{selected.to_event_label}</Text>
                <Text style={styles.modalLine}>{fmtDate(selected.to_starts)}</Text>
                <Text style={styles.modalLine}>
                  {fmtTime(selected.to_starts)}–{fmtTime(selected.to_ends)}
                </Text>

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => onRespond(selected.id, 'accept')}
                    style={styles.acceptBtn}
                  >
                    <Text style={styles.btnText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onRespond(selected.id, 'decline')}
                    style={styles.declineBtn}
                  >
                    <Text style={styles.btnText}>Decline</Text>
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
  itemSub: { fontSize: 12, color: '#666' },

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

  modalIntro: { fontSize: 13, color: '#111' },
  groupLabel: { fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },

  modalLineTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  modalLine: { fontSize: 13, color: '#333', marginTop: 2 },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },

  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
