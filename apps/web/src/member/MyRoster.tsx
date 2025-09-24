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

  // Resolve current user
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

  // Load "my" assignments with a generous window (yesterday → +1 year)
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const now = Date.now();
      const fromIso = new Date(now - 24 * 3600 * 1000).toISOString(); // yesterday
      const toIso = new Date(now + 365 * 24 * 3600 * 1000).toISOString(); // +1 year

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
        .gte('events.starts_at', fromIso)
        .lte('events.starts_at', toIso)
        .order('starts_at', { ascending: true, foreignTable: 'events' })
        .not('event_id', 'is', null)
        .limit(200);

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

  return (
    <section className="sv-page">
      <div className="sv-card p-4">
        <h2 className="sv-h1">My Roster</h2>
        <p className="sv-meta">
          Tap a rostered event to view details (and other dates in the series).
        </p>
        {error && (
          <p className="sv-meta" style={{ color: '#c00' }}>
            {error}
          </p>
        )}
      </div>

      {loading && <div className="sv-meta">Loading…</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="sv-card p-4">No upcoming assignments.</div>
      )}

      <ul className="space-y-2 mt-3">
        {rows.map((r) => {
          const ev = r.events;
          if (!ev) return null;

          const startsStr = new Date(ev.starts_at).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });
          const endsStr = new Date(ev.ends_at).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });

          const badge = fmtDayBadge(ev.starts_at);

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
                  account_name: '',
                  team_name: '',
                })
              }
            >
              {/* Left: blue date badge + details */}
              <div className="flex gap-3 items-start">
                {/* Badge (matches mobile look) */}
                <div
                  className="w-11 rounded-[10px] border-2 bg-white flex flex-col items-center py-1.5"
                  style={{ borderColor: '#1C94B3' }}
                >
                  <span className="text-[12px] font-bold" style={{ color: '#1C94B3' }}>
                    {badge.dow}
                  </span>
                  <span className="text-[18px] font-extrabold text-[#111]">{badge.day}</span>
                </div>

                {/* Details */}
                <div>
                  <div className="font-semibold">
                    {ev.label ?? 'Event'}{' '}
                    <span className="opacity-70 text-sm">
                      ({startsStr} – {endsStr})
                    </span>
                  </div>
                  {ev.description && <div className="sv-meta mt-1">{ev.description}</div>}
                </div>
              </div>

              {/* Right: status */}
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

/* ---------------- helpers ---------------- */
function fmtDayBadge(iso: string) {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: d.getDate().toString().padStart(2, '0'),
  };
}
