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
  Alert,
} from 'react-native';
import {
  getMyUpcomingAssignments,
  type MyAssignment,
  type Scope as RosterScope,
} from '../../api/roster';
import { getUpcomingEvents, type EventRow, type Scope as EventsScope } from '../../api/events';
import {
  getMyAccountMemberships,
  getMyTeamMemberships,
  type AccountMembership,
  type TeamMembership,
} from '../../api/memberships';
import { openReplacementRequest } from '../../api/replacements';
import { useCurrent } from '../../context/CurrentContext';

export default function MyRoster() {
  const { accountId, accountName, teamId, teamName, setAccount, setTeam, clear } = useCurrent();

  // UI state
  const [onlyMine, setOnlyMine] = useState(true);
  const [itemsMine, setItemsMine] = useState<MyAssignment[] | null>(null);
  const [itemsAll, setItemsAll] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Picker data (local)
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teams, setTeams] = useState<TeamMembership[] | null>(null);
  const [pickAccountOpen, setPickAccountOpen] = useState(false);
  const [pickTeamOpen, setPickTeamOpen] = useState(false);

  // load accounts (once)
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

  // load teams whenever account changes
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

  const scope: RosterScope | EventsScope = useMemo(
    () => (teamId ? 'team' : accountId ? 'account' : 'all'),
    [accountId, teamId]
  );

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      if (onlyMine) {
        const mine = await getMyUpcomingAssignments({
          scope: scope as RosterScope,
          accountId,
          teamId,
          limit: 100,
        });
        setItemsMine(mine);
      } else {
        const all = await getUpcomingEvents({
          scope: scope as EventsScope,
          accountId,
          teamId,
          limit: 100,
        });
        setItemsAll(all);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load roster');
      setItemsMine([]);
      setItemsAll([]);
    } finally {
      setRefreshing(false);
    }
  }, [onlyMine, scope, accountId, teamId]);

  useEffect(() => {
    setItemsMine(null);
    setItemsAll(null);
    load();
  }, [load]);

  const fmtDayBadge = (iso: string) => {
    const d = new Date(iso);
    return {
      dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: d.getDate().toString().padStart(2, '0'),
    };
  };
  const fmtTimeRange = (startIso: string, endIso: string) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const day = s.toLocaleDateString(undefined, { weekday: 'short' });
    const hhmm = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${day} ${hhmm(s)} – ${hhmm(e)}`;
  };

  // Open replacement for an assignment
  const handleOpenReplacement = async (a: MyAssignment) => {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Can't make it?",
        `Open a replacement request for "${a.label}"?\n\nThis will notify eligible teammates.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Open request', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });
    if (!ok) return;

    try {
      setRefreshing(true);
      await openReplacementRequest({
        accountId: a.account_id,
        teamId: a.team_id,
        eventId: a.event_id,
      });
      Alert.alert('Replacement opened', 'We’ll notify eligible teammates.');
    } catch (e: any) {
      Alert.alert('Could not open replacement', e?.message ?? 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const Header = () => (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.screenTitle}>Roster</Text>
      </View>

      {/* Chips row */}
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
        <ToggleChip
          active={onlyMine}
          labelOn="My roster only"
          labelOff="Show all visible"
          onToggle={() => setOnlyMine((v) => !v)}
        />
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {(onlyMine ? itemsMine === null : itemsAll === null) ? (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator />
        </View>
      ) : null}

      <Text style={styles.section}>Upcoming</Text>
    </View>
  );

  const empty = (onlyMine ? itemsMine : itemsAll) ?? [];
  const data = onlyMine ? (itemsMine ?? []) : (itemsAll ?? []);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data}
        keyExtractor={(it) =>
          onlyMine ? (it as MyAssignment).assignment_id : (it as EventRow).event_id
        }
        ListHeaderComponent={<Header />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          empty.length === 0 ? (
            <Text style={[styles.muted, { padding: 16 }]}>
              {onlyMine ? 'No upcoming assignments.' : 'No upcoming events.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) =>
          onlyMine ? (
            <AssignmentCard
              row={item as MyAssignment}
              fmtDayBadge={fmtDayBadge}
              fmtTimeRange={fmtTimeRange}
              onOpenReplacement={handleOpenReplacement}
            />
          ) : (
            <EventCard
              row={item as EventRow}
              fmtDayBadge={fmtDayBadge}
              fmtTimeRange={fmtTimeRange}
            />
          )
        }
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
          if (!id) {
            clear();
          } else {
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
          if (!id) {
            setTeam('', '');
          } else {
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

/* ---------- Small components ---------- */

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

function ToggleChip({
  active,
  labelOn,
  labelOff,
  onToggle,
}: {
  active: boolean;
  labelOn: string;
  labelOff: string;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.chip, active && styles.chipActive]}>
      <Text style={styles.chipLabel}>{active ? labelOn : labelOff}</Text>
    </Pressable>
  );
}

function AssignmentCard({
  row,
  fmtDayBadge,
  fmtTimeRange,
  onOpenReplacement,
}: {
  row: MyAssignment;
  fmtDayBadge: (_: string) => { dow: string; day: string };
  fmtTimeRange: (_: string, __: string) => string;
  onOpenReplacement: (a: MyAssignment) => void;
}) {
  const badge = fmtDayBadge(row.starts_at);
  const statusLabel =
    row.assignment_status?.toLowerCase() === 'confirmed'
      ? 'Confirmed'
      : row.assignment_status
        ? row.assignment_status
        : 'Assigned';
  const statusStyle =
    row.assignment_status?.toLowerCase() === 'confirmed'
      ? styles.badgeSuccess
      : styles.badgeNeutral;

  return (
    <View style={styles.card}>
      {/* Left date badge */}
      <View style={styles.dateBadge}>
        <Text style={styles.dateDow}>{badge.dow}</Text>
        <Text style={styles.dateDay}>{badge.day}</Text>
      </View>

      {/* Right content */}
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={styles.cardTitle}>{row.label}</Text>
            <Text style={styles.cardSub}>
              {row.account_name ?? 'Account'}
              {row.team_name ? ` — ${row.team_name}` : ''}
            </Text>
          </View>
          <View style={[styles.badge, statusStyle]}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.metaLine}>🗓️ {fmtTimeRange(row.starts_at, row.ends_at)}</Text>

        {/* Actions */}
        <Pressable onPress={() => onOpenReplacement(row)} style={styles.linkBtn}>
          <Text style={styles.linkText}>Can’t make it</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EventCard({
  row,
  fmtDayBadge,
  fmtTimeRange,
}: {
  row: EventRow;
  fmtDayBadge: (_: string) => { dow: string; day: string };
  fmtTimeRange: (_: string, __: string) => string;
}) {
  const badge = fmtDayBadge(row.starts_at);
  return (
    <View style={styles.card}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateDow}>{badge.dow}</Text>
        <Text style={styles.dateDay}>{badge.day}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardTitle}>{row.label}</Text>
        <Text style={styles.metaLine}>🗓️ {fmtTimeRange(row.starts_at, row.ends_at)}</Text>
      </View>
    </View>
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
  if (!open) return null;
  if (disabled) return null;
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

/* ---------- Styles ---------- */

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

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0a3' },
  badgeSuccess: { backgroundColor: '#e6f8ec' },
  badgeNeutral: { backgroundColor: '#eef1f5' },

  linkBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    backgroundColor: '#fff',
  },
  linkText: { fontSize: 13, fontWeight: '700', color: '#b91c1c' },

  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#0008',
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
  },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  modalItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: { fontSize: 16, fontWeight: '600', color: '#111' },
  modalItemSub: { fontSize: 12, color: '#666' },
  modalClose: { fontSize: 14, fontWeight: '700', color: '#3b82f6' },
});
