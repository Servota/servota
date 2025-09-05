/* eslint-disable no-unused-vars */
// apps/mobile/src/features/roster/MyRoster.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Modal,
} from 'react-native';
import {
  getMyUpcomingAssignments,
  type MyAssignment,
  type Scope as RosterScope,
} from '../../api/roster';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';
import { useCurrent } from '../../context/CurrentContext';

export default function MyRoster({ onOpenDetails }: { onOpenDetails: (a: MyAssignment) => void }) {
  const { accountId, accountName, teamId, teamName, setAccount, setTeam, clear } = useCurrent();

  const [items, setItems] = useState<MyAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teams, setTeams] = useState<TeamMembership[] | null>(null);
  const [pickAccountOpen, setPickAccountOpen] = useState(false);
  const [pickTeamOpen, setPickTeamOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const accs = await getMyAccountMemberships();
        if (!mounted) return;
        setAccounts(accs);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load accounts');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accountId) {
        setTeams([]);
        return;
      }
      try {
        const rows = await getMyTeamMemberships(accountId);
        if (!mounted) return;
        setTeams(rows);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load teams');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accountId]);

  const scope: RosterScope = useMemo(
    () => (teamId ? 'team' : accountId ? 'account' : 'all'),
    [accountId, teamId]
  );

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const mine = await getMyUpcomingAssignments({ scope, accountId, teamId, limit: 100 });
      setItems(mine);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load roster');
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [scope, accountId, teamId]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  // Ensure soonest first explicitly (defensive, even though API orders ASC)
  const data = useMemo(
    () =>
      (items ?? [])
        .slice()
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [items]
  );

  const fmtDayBadge = (iso: string) => {
    const d = new Date(iso);
    return {
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: d.getDate().toString().padStart(2, '0'),
    };
  };
  const fmtTimeRange = (sIso: string, eIso: string) => {
    const s = new Date(sIso),
      e = new Date(eIso);
    const day = s.toLocaleDateString(undefined, { weekday: 'short' });
    const hhmm = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${day} ${hhmm(s)} – ${hhmm(e)}`;
  };

  const Header = () => (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.screenTitle}>My roster</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip
          label={accountName ? accountName : 'Account'}
          onPress={() => setPickAccountOpen(true)}
          active={!!accountId}
        />
        <Chip
          label={teamName ? `Team ${teamName}` : 'Team'}
          onPress={() => accountId && setPickTeamOpen(true)}
          disabled={!accountId}
          active={!!teamId}
        />
      </View>

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
        data={data}
        keyExtractor={(it) => it.assignment_id}
        ListHeaderComponent={<Header />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          data.length === 0 ? (
            <Text style={[styles.muted, { padding: 16 }]}>No upcoming assignments.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenDetails(item)} style={styles.card}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateDow}>{fmtDayBadge(item.starts_at).dow}</Text>
              <Text style={styles.dateDay}>{fmtDayBadge(item.starts_at).day}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardSub}>
                {item.account_name ?? 'Account'}
                {item.team_name ? ` — ${item.team_name}` : ''}
              </Text>
              <Text style={styles.metaLine}>🗓️ {fmtTimeRange(item.starts_at, item.ends_at)}</Text>
            </View>
          </Pressable>
        )}
      />

      {/* Account picker */}
      <PickerModal
        title="Select account"
        open={pickAccountOpen}
        onClose={() => setPickAccountOpen(false)}
        items={(accounts ?? []).map((a) => ({
          id: a.account_id,
          title: a.account_name,
          subtitle: a.role,
        }))}
        onSelect={(id) => {
          if (!id) clear();
          else {
            const a = (accounts ?? []).find((x) => x.account_id === id);
            if (a) setAccount(a.account_id, a.account_name);
          }
          setPickAccountOpen(false);
        }}
        allowClear
      />

      {/* Team picker */}
      <PickerModal
        title="Select team"
        open={pickTeamOpen}
        onClose={() => setPickTeamOpen(false)}
        items={(teams ?? []).map((t) => ({ id: t.team_id, title: t.team_name, subtitle: t.role }))}
        onSelect={(id) => {
          if (!id) setTeam('', '');
          else {
            const t = (teams ?? []).find((x) => x.team_id === id);
            if (t) setTeam(t.team_id, t.team_name);
          }
          setPickTeamOpen(false);
        }}
        allowClear
        disabled={!accountId}
      />
    </View>
  );
}

/* small bits */
function Chip({
  label,
  onPress,
  active,
  disabled,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
    >
      <Text style={styles.chipLabel}>{label}</Text>
    </Pressable>
  );
}
function PickerModal({
  title,
  open,
  onClose,
  items,
  onSelect,
  allowClear,
  disabled,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  items: { id: string; title: string; subtitle?: string }[];
  onSelect: (_id: string | null) => void;
  allowClear?: boolean;
  disabled?: boolean;
}) {
  if (!open || disabled) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>{title}</Text>
        {allowClear ? (
          <Pressable style={styles.modalItem} onPress={() => onSelect(null)}>
            <Text style={[styles.modalItemText, { color: '#c00' }]}>Clear selection</Text>
          </Pressable>
        ) : null}
        {items.map((it) => (
          <Pressable key={it.id} style={styles.modalItem} onPress={() => onSelect(it.id)}>
            <Text style={styles.modalItemText}>{it.title}</Text>
            {it.subtitle ? <Text style={styles.modalItemSub}>{it.subtitle}</Text> : null}
          </Pressable>
        ))}
        <Pressable style={[styles.modalItem, { alignItems: 'center' }]} onPress={onClose}>
          <Text style={styles.modalClose}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 24, fontWeight: '800' },
  section: { fontSize: 14, fontWeight: '700' },
  err: { color: '#c00' },
  muted: { color: '#666' },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: '#3b82f6' },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { fontSize: 14, fontWeight: '600', color: '#222' },

  card: {
    flexDirection: 'row',
    gap: 12,
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
  },
  dateBadge: {
    width: 44,
    borderRadius: 10,
    backgroundColor: '#eaf2ff',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateDow: { fontSize: 12, color: '#3b82f6', fontWeight: '800' },
  dateDay: { fontSize: 18, color: '#1f2937', fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardSub: { fontSize: 12, color: '#555' },
  metaLine: { fontSize: 13, color: '#444' },

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
