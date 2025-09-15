/* eslint-disable no-unused-vars */
// apps/mobile/src/features/roster/MyRoster.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable, Modal } from 'react-native';
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

const BRAND_BLUE = '#1C94B3'; // sampled from logo

export default function MyRoster({ onOpenDetails }: { onOpenDetails: (a: MyAssignment) => void }) {
  const { accountId, accountName, teamId, teamName, setAccount, setTeam, clear } = useCurrent();

  // data + ui state
  const [items, setItems] = useState<MyAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // pickers
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teams, setTeams] = useState<TeamMembership[] | null>(null);
  const [pickAccountOpen, setPickAccountOpen] = useState(false);
  const [pickTeamOpen, setPickTeamOpen] = useState(false);

  // load accounts once
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

  // load teams when account changes
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

  // scope
  const scope: RosterScope = useMemo(
    () => (teamId ? 'team' : accountId ? 'account' : 'all'),
    [accountId, teamId]
  );

  // load assignments (silent)
  const load = useCallback(async () => {
    setError(null);
    try {
      const mine = await getMyUpcomingAssignments({ scope, accountId, teamId, limit: 100 });
      setItems(mine);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load roster');
      setItems([]);
    }
  }, [scope, accountId, teamId]);

  useEffect(() => {
    setItems(null); // quiet placeholder instead of spinner
    load();
  }, [load]);

  // derived + formatting
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
    const s = new Date(sIso);
    const e = new Date(eIso);
    const hhmm = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${hhmm(s)} – ${hhmm(e)}`;
  };

  // filter summary banner
  const filterSummary = teamName
    ? `Showing only ${teamName} events`
    : accountName
      ? `Showing only ${accountName} events`
      : 'Showing all events';

  const anyFilterActive = !!accountId || !!teamId;

  const Header = () => (
    <View style={{ gap: 12, marginBottom: 4, paddingHorizontal: 16, paddingTop: 12 }}>
      {/* Intro card */}
      <View style={styles.card}>
        <Text style={styles.h1}>My Roster</Text>
        <Text style={styles.meta}>
          Tap a rostered event to view details (and other dates in the series).
        </Text>
        {error ? <Text style={[styles.meta, { color: '#c00' }]}>{error}</Text> : null}
      </View>

      {/* Filters */}
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>Filters</Text>
      </View>
      <View style={[styles.rowBetween, { alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <Chip
            label={accountName ? accountName : 'Select account'}
            onPress={() => setPickAccountOpen(true)}
            active={!!accountId}
          />
          <Chip
            label={teamName ? `Team ${teamName}` : 'Select team'}
            onPress={() => accountId && setPickTeamOpen(true)}
            disabled={!accountId}
            active={!!teamId}
          />
        </View>

        {anyFilterActive ? (
          <Pressable
            onPress={() => {
              clear(); // resets account + team in context
            }}
            style={styles.clearFilterBtn}
            android_ripple={{ color: '#e5e7eb' }}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
          >
            <Text style={styles.clearFilterText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Filter summary line */}
      <Text style={styles.filterSummary}>{filterSummary}</Text>

      {/* Quiet loading text (no spinner flicker) */}
      {items === null ? (
        <Text style={[styles.meta, { paddingLeft: 2 }]}>Loading entries…</Text>
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
        // silent pull-to-refresh
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor="#111" colors={['#111']} />
        }
        ListEmptyComponent={
          items !== null && data.length === 0 ? (
            <Text style={[styles.meta, { paddingHorizontal: 16, paddingVertical: 12 }]}>
              No upcoming assignments.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpenDetails(item)}
            style={[styles.cardRow, { marginHorizontal: 16, marginTop: 10 }]}
            android_ripple={{ color: '#e5e7eb' }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.label}`}
          >
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
              <Text style={styles.metaLine}>{fmtTimeRange(item.starts_at, item.ends_at)}</Text>
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
        items={(teams ?? []).map((t) => ({
          id: t.team_id,
          title: t.team_name,
          subtitle: t.role,
        }))}
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

/* ---------- Small bits ---------- */
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
      style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.5 }]}
      android_ripple={{ color: '#e5e7eb' }}
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

/* ---------- Styles (aligned with App + other screens) ---------- */
const styles = StyleSheet.create({
  // tokens
  h1: { fontSize: 18, fontWeight: '700', color: '#111' },
  meta: { fontSize: 13, color: '#6b7280' },
  section: { fontSize: 14, fontWeight: '800', color: '#111', marginTop: 4, marginBottom: 2 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },

  // section bar (like memberships)
  sectionBar: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  sectionBarText: { fontSize: 13, fontWeight: '800', color: '#111', letterSpacing: 0.2 },

  // cards
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
    flexDirection: 'row',
    gap: 12,
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
  cardSub: { fontSize: 12, color: '#555' },
  metaLine: { fontSize: 13, color: '#444' },

  // chips — distinct from section bar
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipActive: {
    backgroundColor: '#eef1f5',
    borderColor: '#cbd5e1',
  },
  chipLabel: { fontSize: 14, fontWeight: '800', color: '#111' },

  // clear filters (subtle button)
  clearFilterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#ececec',
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  clearFilterText: { fontSize: 12, fontWeight: '800', color: '#111' },

  // filter summary
  filterSummary: { fontSize: 12, color: '#111', fontWeight: '700', marginTop: 2 },

  // date badge — brand blue with white text
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
    gap: 6,
    borderWidth: 1,
    borderColor: '#ececec',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 4 },
  modalItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalItemText: { fontSize: 16, fontWeight: '700', color: '#111' },
  modalItemSub: { fontSize: 12, color: '#666' },
  modalClose: { fontSize: 14, fontWeight: '800', color: '#111' },
});
