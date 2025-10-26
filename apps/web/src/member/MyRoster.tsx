// apps/web/src/member/MyRoster.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';
import EventDetails, { type SelectedEvent } from './EventDetails';

type Row = {
  id: string;
  account_id: string;
  team_id: string | null;
  event_id: string;
  status: string | null;
  assigned_at: string | null;
  events: {
    id: string;
    template_id: string | null;
    label: string | null;
    description: string | null;
    starts_at: string;
    ends_at: string;
    team_id: string;
  } | null;
};

type IdName = { id: string; name: string };

async function resolveNames(
  supabase: any,
  accountIds: string[],
  teamIds: string[]
): Promise<{ accounts: Record<string, string>; teams: Record<string, string> }> {
  const outA: Record<string, string> = {};
  const outT: Record<string, string> = {};
  for (const id of accountIds) outA[id] = `Account ${id.slice(0, 6)}`;
  for (const id of teamIds) outT[id] = `Team ${id.slice(0, 6)}`;

  try {
    if (accountIds.length > 0) {
      const { data } = await supabase.from('accounts').select('id,name').in('id', accountIds);
      (data as IdName[] | null)?.forEach((r) => {
        if ((r.name ?? '').trim()) outA[r.id] = r.name.trim();
      });
    }
  } catch {
    /* keep defaults */
  }
  try {
    if (teamIds.length > 0) {
      const { data } = await supabase.from('teams').select('id,name').in('id', teamIds);
      (data as IdName[] | null)?.forEach((r) => {
        if ((r.name ?? '').trim()) outT[r.id] = r.name.trim();
      });
    }
  } catch {
    /* keep defaults */
  }
  return { accounts: outA, teams: outT };
}

export default function MyRoster() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accountNameById, setAccountNameById] = useState<Record<string, string>>({});
  const [teamNameById, setTeamNameById] = useState<Record<string, string>>({});

  // Filters (default none)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Event details
  const [selected, setSelected] = useState<SelectedEvent | null>(null);

  // Auth
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setError(error.message);
        return;
      }
      setUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Load my assignments (yesterday -> +1 year). Unscoped; we filter client-side.
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const fromIso = new Date(now - 24 * 3600 * 1000).toISOString();
      const toIso = new Date(now + 365 * 24 * 3600 * 1000).toISOString();

      const { data, error } = await supabase
        .from('assignments')
        .select(
          `
          id,
          account_id,
          team_id,
          event_id,
          status,
          assigned_at,
          events:events!inner (
            id,
            template_id,
            label,
            description,
            starts_at,
            ends_at,
            team_id
          )
        `
        )
        .eq('user_id', userId)
        .gte('events.starts_at', fromIso)
        .lte('events.starts_at', toIso)
        .order('starts_at', { ascending: true, foreignTable: 'events' })
        .not('event_id', 'is', null)
        .limit(200);

      if (error) throw error;
      const rs = (data ?? []) as Row[];

      // Resolve names used in these rows
      const accountIds = Array.from(new Set(rs.map((r) => r.account_id).filter(Boolean)));
      const teamIds = Array.from(
        new Set(rs.map((r) => r.team_id ?? r.events?.team_id ?? '').filter(Boolean))
      );
      const { accounts, teams } = await resolveNames(supabase, accountIds, teamIds);

      setAccountNameById(accounts);
      setTeamNameById(teams);
      setRows(rs);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load roster');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Derived: sorted + filtered
  const data = useMemo(() => {
    const base = (rows ?? []).slice().sort((a, b) => {
      const as = new Date(a.events?.starts_at ?? 0).getTime();
      const bs = new Date(b.events?.starts_at ?? 0).getTime();
      return as - bs;
    });
    return base.filter((r) => {
      const accOk = selectedAccountId ? r.account_id === selectedAccountId : true;
      const teamId = r.team_id ?? r.events?.team_id ?? null;
      const teamOk = selectedTeamId ? teamId === selectedTeamId : true;
      return accOk && teamOk;
    });
  }, [rows, selectedAccountId, selectedTeamId]);

  // Filter options
  const accountOptions = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.account_id)));
    return ids.map((id) => ({ id, name: accountNameById[id] ?? `Account ${id.slice(0, 6)}` }));
  }, [rows, accountNameById]);

  const teamOptions = useMemo(() => {
    const ids = Array.from(
      new Set(
        rows
          .filter((r) => (selectedAccountId ? r.account_id === selectedAccountId : true))
          .map((r) => r.team_id ?? r.events?.team_id ?? '')
          .filter(Boolean)
      )
    );
    return ids.map((id) => ({ id, name: teamNameById[id] ?? `Team ${id.slice(0, 6)}` }));
  }, [rows, selectedAccountId, teamNameById]);

  // Summary
  const filterSummary = selectedTeamId
    ? `Showing only ${teamNameById[selectedTeamId] ?? 'team'} events`
    : selectedAccountId
      ? `Showing only ${accountNameById[selectedAccountId] ?? 'account'} events`
      : 'Showing all events';

  const anyFilterActive = !!selectedAccountId || !!selectedTeamId;

  return (
    <section className="sv-page">
      {/* Intro card */}
      <div className="sv-card p-4">
        <h2 className="sv-h1">My Roster</h2>
        <p className="sv-meta">
          Tap a rostered event to view details (and other dates in the series).
        </p>
        {error ? (
          <p className="sv-meta" style={{ color: '#c00' }}>
            {error}
          </p>
        ) : null}
      </div>

      {/* Filters */}
      <div className="sv-section-bar mt-3">
        <div className="sv-section-bar-text">Filters</div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        {/* Account */}
        <label className="flex items-center gap-2">
          <span className="sv-meta font-semibold">Account</span>
          <select
            className="sv-input"
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(e.target.value);
              setSelectedTeamId('');
            }}
          >
            <option value="">All accounts</option>
            {accountOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </label>

        {/* Team (scoped to account) */}
        <label className="flex items-center gap-2">
          <span className="sv-meta font-semibold">Team</span>
          <select
            className="sv-input"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            disabled={!selectedAccountId || teamOptions.length === 0}
            title={!selectedAccountId ? 'Select an account first' : undefined}
          >
            <option value="">All teams</option>
            {teamOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </label>

        {/* Clear */}
        {anyFilterActive ? (
          <button
            className="py-2 px-3 rounded-[10px] border border-[#ececec] bg-[#eef1f5] text-[12px] font-extrabold text-[#111] hover:bg-[#e9eef4]"
            onClick={() => {
              setSelectedAccountId('');
              setSelectedTeamId('');
            }}
            title="Clear filters"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Filter summary */}
      <div className="sv-meta mt-1">{filterSummary}</div>

      {/* Loading / empty */}
      {loading && <div className="sv-meta mt-2">Loading…</div>}
      {!loading && !error && data.length === 0 && (
        <div className="sv-card p-4 mt-2">No upcoming assignments.</div>
      )}

      {/* List */}
      <ul className="space-y-2 mt-3">
        {data.map((r) => {
          const ev = r.events;
          if (!ev) return null;

          // Badge values (month short + day)
          const d = new Date(ev.starts_at);
          const mon = d.toLocaleDateString(undefined, { month: 'short' }); // e.g., "Dec"
          const day = d.getDate().toString().padStart(2, '0'); // e.g., "07"

          // Time range
          const s = new Date(ev.starts_at);
          const e = new Date(ev.ends_at);
          const hhmm = (x: Date) =>
            x
              .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
              .replace(' ', '');
          const timeRange = `${hhmm(s)} – ${hhmm(e)}`;

          const accountName = accountNameById[r.account_id] ?? '';
          const teamName = teamNameById[r.team_id ?? ev.team_id] ?? '';

          return (
            <li
              key={r.id}
              className="sv-card-row justify-between items-start cursor-pointer"
              onClick={() =>
                setSelected({
                  event_id: ev.id,
                  template_id: ev.template_id ?? null,
                  account_id: r.account_id,
                  team_id: ev.team_id,
                  label: ev.label ?? 'Event',
                  starts_at: ev.starts_at,
                  ends_at: ev.ends_at,
                  account_name: accountName,
                  team_name: teamName,
                })
              }
            >
              {/* Left: date badge + details */}
              <div className="flex gap-3 items-start">
                <div
                  className="w-11 rounded-[10px] border-2 bg-white flex flex-col items-center py-1.5"
                  style={{ borderColor: '#1C94B3' }}
                >
                  <span className="text-[12px] font-bold" style={{ color: '#1C94B3' }}>
                    {mon}
                  </span>
                  <span className="text-[18px] font-extrabold text-[#111]">{day}</span>
                </div>

                <div>
                  <div className="font-semibold text-[#111]">{ev.label ?? 'Event'}</div>
                  <div className="sv-meta mt-1">
                    {accountName || 'Account'}
                    {teamName ? ` — ${teamName}` : ''}
                  </div>
                  <div className="sv-meta mt-1">{timeRange}</div>
                  {ev.description && <div className="sv-meta mt-1">{ev.description}</div>}
                </div>
              </div>

              {/* Right: status */}
              <div className="text-xs opacity-70 self-center">{r.status ?? 'assigned'}</div>
            </li>
          );
        })}
      </ul>

      {/* Drawer */}
      {selected && (
        <EventDetails
          open={true}
          onClose={() => setSelected(null)}
          selected={selected}
          accountName={selected.account_name ?? ''}
          teamName={selected.team_name ?? ''}
        />
      )}
    </section>
  );
}
