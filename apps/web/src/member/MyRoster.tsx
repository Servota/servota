// apps/web/src/member/MyRoster.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, getContext } from '@servota/shared';

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

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user id once
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

  // Fetch assignments for the current user (scoped to account, optional team), upcoming only
  useEffect(() => {
    if (!userId || !accountId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      // upcoming from "now" for ~60 days
      const nowIso = new Date().toISOString();
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
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .gte('events.starts_at', nowIso)
        .order('starts_at', { ascending: true, foreignTable: 'events' })
        .limit(50);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      // Optional filter by currently selected team
      const filtered = (data ?? []).filter((r: any) =>
        teamId ? r.events?.team_id === teamId : true
      ) as Row[];

      setRows(filtered);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId, accountId, teamId]);

  const title = 'My Roster';
  const hint = teamId
    ? 'Showing assignments for selected Team'
    : 'Showing assignments across this Account';

  return (
    <section className="max-w-4xl mx-auto mt-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="text-sm opacity-80">{hint}</div>
        </div>
      </header>

      <div className="rounded-2xl border border-border shadow-soft bg-surface-card p-4">
        {loading && <div className="opacity-80">Loading your upcoming assignments…</div>}
        {!loading && error && (
          <div className="text-sm rounded-md border border-danger p-3">
            <strong>Error:</strong> {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="text-sm opacity-80">No upcoming assignments found.</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const ev = r.events;
              const starts = ev ? fmtDateTime(ev.starts_at) : '';
              const ends = ev ? fmtTime(ev.ends_at) : '';
              return (
                <li key={r.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {ev?.label || 'Event'}{' '}
                      <span className="opacity-70 text-sm">
                        ({starts} – {ends})
                      </span>
                    </div>
                    {ev?.description && (
                      <div className="opacity-80 text-sm mt-1">{ev.description}</div>
                    )}
                  </div>
                  <div className="text-xs opacity-70">
                    {r.status ? r.status : 'assigned'}
                    {/* later: replacement/swap badges */}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------ helpers ------ */

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    // Show: Sat 21 Sep, 10:00 AM
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}
