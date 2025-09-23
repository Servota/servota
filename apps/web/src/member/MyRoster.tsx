// apps/web/src/member/MyRoster.tsx

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getBrowserSupabaseClient, getContext } from '@servota/shared';
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

export default function MyRoster() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = (getContext() ?? {}) as {
    accountId: string | null;
    teamId: string | null;
  };

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedEvent | null>(null);

  // Get current user
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

  // Load assignments for me
  const load = useCallback(async () => {
    if (!userId) return;
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
        .gte('events.starts_at', nowIso)
        .order('starts_at', { ascending: true, foreignTable: 'events' })
        .not('event_id', 'is', null) // keep only valid links
        .limit(100);

      if (accountId) q = q.eq('account_id', accountId);
      if (teamId) q = q.eq('events.team_id', teamId);

      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load roster');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, accountId, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- render ---------- */
  return (
    <section className="sv-page">
      <div className="sv-card p-4">
        <h2 className="sv-h1">My Roster</h2>
        <p className="sv-meta">Your upcoming assignments</p>
      </div>

      {loading && <div className="sv-meta">Loading…</div>}
      {error && <div className="sv-meta text-red-600">Error: {error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="sv-card p-4">No upcoming assignments.</div>
      )}

      <ul className="space-y-2 mt-3">
        {rows.map((r) => {
          const ev = r.events;
          if (!ev) return null;
          const starts = new Date(ev.starts_at).toLocaleString();
          const ends = new Date(ev.ends_at).toLocaleTimeString();
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
                  // names optional in your EventDetails; passing empty for now
                  account_name: '',
                  team_name: '',
                })
              }
            >
              <div>
                <div className="font-semibold">
                  {ev.label ?? 'Event'}{' '}
                  <span className="opacity-70 text-sm">
                    ({starts} – {ends})
                  </span>
                </div>
                {ev.description && <div className="sv-meta mt-1">{ev.description}</div>}
              </div>
              <div className="text-xs opacity-70 self-center">{r.status ?? 'assigned'}</div>
            </li>
          );
        })}
      </ul>

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
