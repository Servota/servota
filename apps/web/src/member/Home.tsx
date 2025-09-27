// apps/web/src/member/Home.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type Row = {
  id: string;
  status: string | null;
  events: {
    id: string;
    label: string | null;
    starts_at: string;
    ends_at: string;
  } | null;
};

export default function Home({ onNavigate }: { onNavigate: any }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    const now = Date.now();
    const fromIso = new Date(now - 24 * 3600 * 1000).toISOString();
    const toIso = new Date(now + 14 * 24 * 3600 * 1000).toISOString(); // next 2 weeks

    const { data, error } = await supabase
      .from('assignments')
      .select(
        `
        id,
        status,
        events:events!inner (
          id,
          label,
          starts_at,
          ends_at
        )
      `
      )
      .eq('user_id', uid)
      .gte('events.starts_at', fromIso)
      .lte('events.starts_at', toIso)
      .order('starts_at', { ascending: true, foreignTable: 'events' })
      .limit(5);

    if (error) {
      console.warn('home load error', error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const next = rows[0] ?? null;
  const upcoming = rows.slice(1);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <section className="sv-page space-y-3">
      <div className="sv-card p-4">
        <h2 className="sv-h1">Welcome back</h2>
        <p className="sv-meta">Here’s what’s coming up for you.</p>
      </div>

      {loading && <div className="sv-meta">Loading…</div>}

      {next && (
        <div className="sv-card p-4">
          <h3 className="font-bold text-[#111]">Next Assignment</h3>
          <div className="mt-2">
            <div className="font-semibold">{next.events?.label ?? 'Event'}</div>
            <div className="sv-meta">{fmt(next.events!.starts_at)}</div>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="sv-card p-4">
          <h3 className="font-bold text-[#111]">This Week</h3>
          <ul className="mt-2 space-y-1">
            {upcoming.map((r) => (
              <li key={r.id} className="sv-meta">
                {r.events?.label ?? 'Event'} — {fmt(r.events!.starts_at)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sv-card p-4">
        <h3 className="font-bold text-[#111]">Quick Actions</h3>
        <div className="mt-2 flex gap-2">
          <button className="sv-btn" onClick={() => onNavigate('unavailability')}>
            Add Unavailability
          </button>
          <button className="sv-btn-ghost" onClick={() => onNavigate('roster')}>
            View Roster
          </button>
          <button className="sv-btn-ghost" onClick={() => onNavigate('memberships')}>
            Memberships
          </button>
        </div>
      </div>
    </section>
  );
}
