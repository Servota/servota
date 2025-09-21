/* eslint-disable no-unused-vars */

// apps/web/src/member/MyRoster.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getBrowserSupabaseClient, getContext, setContext } from '@servota/shared';

/* ---------------- Types (minimal) ---------------- */
type AccountMembership = {
  account_id: string;
  role: 'owner' | 'admin' | null;
  status: string | null;
  accounts?: { name?: string | null } | null;
};
type TeamMembership = {
  team_id: string;
  account_id: string;
  role: 'scheduler' | 'member' | null;
  status: string | null;
  team_name?: string | null; // joined below if needed
};
type Row = {
  id: string;
  account_id: string;
  team_id: string | null;
  event_id: string;
  status: string | null;
  assigned_at: string | null;
  events: {
    id: string;
    label: string | null;
    description: string | null;
    starts_at: string; // timestamptz
    ends_at: string; // timestamptz
    team_id: string;
  } | null;
};

export default function MyRoster() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = (getContext() ?? {}) as {
    accountId: string | null;
    teamId: string | null;
  };

  /* ---------------- UI state ---------------- */
  const [userId, setUserId] = useState<string | null>(null);

  // filters + pickers
  const [accounts, setAccounts] = useState<AccountMembership[] | null>(null);
  const [teams, setTeams] = useState<TeamMembership[] | null>(null);
  const [accountName, setAccountName] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [pickAccountOpen, setPickAccountOpen] = useState(false);
  const [pickTeamOpen, setPickTeamOpen] = useState(false);

  // data
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- bootstrap ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setUserId(null);
        return;
      }
      setUserId(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Load account memberships once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('account_memberships')
          .select('account_id, role, status, accounts:account_id(name)')
          .eq('status', 'active');
        if (!mounted) return;
        if (error) throw error;
        const accs = (data ?? []) as AccountMembership[];
        setAccounts(accs);

        if (accountId) {
          const current = accs.find((a) => a.account_id === accountId);
          setAccountName(current?.accounts?.name ?? '');
        } else {
          setAccountName('');
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load accounts');
        setAccounts([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, accountId]);

  // Load team memberships when account changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accountId) {
        setTeams([]);
        setTeamName('');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('team_memberships')
          .select('team_id, account_id, role, status, teams:team_id(name)')
          .eq('account_id', accountId)
          .eq('status', 'active');
        if (!mounted) return;
        if (error) throw error;
        const rows = (data ?? []).map((t: any) => ({
          team_id: t.team_id,
          account_id: t.account_id,
          role: t.role,
          status: t.status,
          team_name: t.teams?.name ?? null,
        })) as TeamMembership[];
        setTeams(rows);

        if (teamId) {
          const current = rows.find((t) => t.team_id === teamId);
          setTeamName(current?.team_name ?? '');
        } else {
          setTeamName('');
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load teams');
        setTeams([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, accountId, teamId]);

  /* ---------------- load assignments ---------------- */
  const loadAssignments = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const nowIso = new Date().toISOString();

      let q = supabase
        .from('assignments')
        .select(
          `
          id,
          account_id,
          team_id,
          event_id,
          status,
          assigned_at,
          events:events!assignments_event_id_fkey (
            id,
            label,
            description,
            starts_at,
            ends_at,
            team_id
          )
        `
        )
        .eq('user_id', userId)
        .gte('events.starts_at', nowIso)
        .order('starts_at', { ascending: true, foreignTable: 'events' })
        .limit(100);

      if (accountId) q = q.eq('account_id', accountId);
      if (teamId) q = q.eq('events.team_id', teamId);

      const { data, error } = await q;
      if (error) throw error;

      setRows((data ?? []) as Row[]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load roster');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, accountId, teamId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  /* ---------------- filter actions ---------------- */
  const selectAccount = (id: string | null) => {
    if (!id) {
      localStorage.removeItem('servota.accountId');
      localStorage.removeItem('servota.teamId');
      setContext({ accountId: null as any });
      setContext({ teamId: null as any });
      setAccountName('');
      setTeamName('');
      setPickAccountOpen(false);
      setPickTeamOpen(false);
      return;
    }
    localStorage.setItem('servota.accountId', id);
    localStorage.removeItem('servota.teamId');
    setContext({ accountId: id, teamId: null as any });
    const a = (accounts ?? []).find((x) => x.account_id === id);
    setAccountName(a?.accounts?.name ?? '');
    setTeamName('');
    setPickAccountOpen(false);
  };

  const selectTeam = (id: string | null) => {
    if (!id) {
      localStorage.removeItem('servota.teamId');
      setContext({ teamId: null as any });
      setTeamName('');
      setPickTeamOpen(false);
      return;
    }
    localStorage.setItem('servota.teamId', id);
    setContext({ teamId: id });
    const t = (teams ?? []).find((x) => x.team_id === id);
    setTeamName(t?.team_name ?? '');
    setPickTeamOpen(false);
  };

  const clearFilters = () => {
    selectAccount(null);
  };

  // derived
  const anyFilterActive = !!accountId || !!teamId;
  const filterSummary = teamName
    ? `Showing only ${teamName} events`
    : accountName
      ? `Showing only ${accountName} events`
      : 'Showing all events';

  /* ---------------- render ---------------- */
  return (
    <section className="sv-page">
      {/* Intro / Header card */}
      <div className="sv-card p-4">
        <h2 className="sv-h1">My Roster</h2>
        <p className="sv-meta">Tap an event to view details (and other dates in the series).</p>
        {error ? (
          <p className="sv-meta" style={{ color: '#c00' }}>
            {error}
          </p>
        ) : null}
      </div>

      {/* Filters */}
      <div className="sv-section-bar">
        <div className="sv-section-bar-text">Filters</div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            className={`sv-chip ${accountId ? 'sv-chip-active' : ''}`}
            onClick={() => setPickAccountOpen(true)}
            aria-label="Select account"
          >
            <span className="sv-chip-label">{accountName ? accountName : 'Select account'}</span>
          </button>

          <button
            className={`sv-chip ${teamId ? 'sv-chip-active' : ''}`}
            onClick={() => accountId && setPickTeamOpen(true)}
            aria-label="Select team"
            disabled={!accountId}
          >
            <span className="sv-chip-label">{teamName ? `Team ${teamName}` : 'Select team'}</span>
          </button>
        </div>

        {anyFilterActive ? (
          <button className="sv-btn-ghost" onClick={clearFilters} aria-label="Clear filters">
            Clear
          </button>
        ) : null}
      </div>

      <div className="sv-meta mt-1">{filterSummary}</div>

      <div className="sv-section mt-3">Upcoming</div>
      {loading && <div className="sv-meta">Loading your upcoming assignments…</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="sv-card p-3">
          <div className="sv-meta">No upcoming assignments found.</div>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => {
            const ev = r.events;
            const starts = ev ? fmtDateTime(ev.starts_at) : '';
            const ends = ev ? fmtTime(ev.ends_at) : '';
            return (
              <li key={r.id} className="sv-card-row justify-between items-start">
                <div className="flex items-start gap-3">
                  {/* Date badge like mobile */}
                  <span className="sv-date-badge">
                    <span className="sv-date-dow">{fmtDow(ev?.starts_at)}</span>
                    <span className="sv-date-day">{fmtDay(ev?.starts_at)}</span>
                  </span>
                  <div>
                    <div className="font-semibold">
                      {ev?.label || 'Event'}{' '}
                      <span className="opacity-70 text-sm">
                        ({starts} – {ends})
                      </span>
                    </div>
                    {ev?.description && <div className="sv-meta mt-1">{ev.description}</div>}
                    <div className="sv-meta mt-1">
                      {r.account_id}
                      {ev?.team_id ? ' — ' + (teamName || 'Team') : ''}
                    </div>
                  </div>
                </div>
                <div className="text-xs opacity-70 self-center">
                  {r.status ? r.status : 'assigned'}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Account picker modal */}
      <PickerModal
        title="Select account"
        open={pickAccountOpen}
        onClose={() => setPickAccountOpen(false)}
        items={(accounts ?? []).map((a) => ({
          id: a.account_id,
          title: a.accounts?.name ?? a.account_id,
          subtitle: a.role ?? undefined,
        }))}
        allowClear
        onSelect={selectAccount}
      />

      {/* Team picker modal */}
      <PickerModal
        title="Select team"
        open={pickTeamOpen && !!accountId}
        onClose={() => setPickTeamOpen(false)}
        items={(teams ?? []).map((t) => ({
          id: t.team_id,
          title: t.team_name ?? t.team_id,
          subtitle: t.role ?? undefined,
        }))}
        allowClear
        onSelect={selectTeam}
      />
    </section>
  );
}

/* ---------------- Pickers (simple modal) ---------------- */
function PickerModal({
  title,
  open,
  onClose,
  items,
  onSelect,
  allowClear,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  items: { id: string; title: string; subtitle?: string }[];
  onSelect: (id: string | null) => void;
  allowClear?: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] border border-[#ececec] shadow p-4 w-[360px] max-w-[90vw]"
      >
        <div className="font-extrabold text-[16px] text-[#111] mb-2">{title}</div>
        {allowClear && (
          <button
            className="w-full text-left py-2 px-2 rounded-[10px] border border-[#f0f0f0] mb-2 font-bold text-[#c00]"
            onClick={() => onSelect(null)}
          >
            Clear selection
          </button>
        )}

        {}
        <div className="max-h-[50vh] overflow-y-auto">
          {items.map((it) => (
            <button
              key={it.id}
              className="w-full text-left py-2 px-2 rounded-[10px] border border-transparent hover:border-[#e5e7eb]"
              onClick={() => onSelect(it.id)}
            >
              <div className="font-bold text-[#111]">{it.title}</div>
              {it.subtitle ? <div className="sv-meta">{it.subtitle}</div> : null}
            </button>
          ))}
        </div>
        {/* eslint-enable no-unused-vars */}

        <div className="mt-3 text-center">
          <button className="sv-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------- helpers ---------------- */
function fmtDateTime(iso?: string | null) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso ?? '';
  }
}
function fmtTime(iso?: string | null) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
  } catch {
    return '';
  }
}
function fmtDow(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
function fmtDay(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return String(d.getDate()).padStart(2, '0');
}
