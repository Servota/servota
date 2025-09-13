// apps/web/src/TeamApprovals.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, requireTeamScope } from '@servota/shared';

type SwapRow = {
  id: string;
  status: string | null;
  message: string | null;
  created_at: string | null;

  // same-event uses event_id; cross-date uses from/to assignments
  event_id: string | null;
  from_assignment_id: string | null;
  to_assignment_id: string | null;

  events?: { label?: string | null; starts_at?: string | null; ends_at?: string | null } | null;
};

export default function TeamApprovals() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = requireTeamScope();

  const [items, setItems] = useState<SwapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      // only show swaps that are waiting for approval
      const { data, error } = await supabase
        .from('swap_requests')
        .select(
          `
          id,
          status,
          message,
          created_at,
          event_id,
          from_assignment_id,
          to_assignment_id,
          events:event_id ( label, starts_at, ends_at )
        `
        )
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .eq('status', 'needs_approval')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setItems((data ?? []) as unknown as SwapRow[]);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, teamId]);

  const approve = async (row: SwapRow) => {
    try {
      // cross-date if both assignment ids are present
      const isCrossDate = !!row.from_assignment_id && !!row.to_assignment_id;

      const { error } = await (supabase as any).rpc(
        isCrossDate ? 'apply_cross_date_swap' : 'apply_swap',
        { p_swap_request_id: row.id }
      );
      if (error) throw error;

      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      alert(e?.message ?? 'Could not approve');
    }
  };

  const decline = async (row: SwapRow) => {
    try {
      // same RPC for both types: respond_* only cares about id + action
      const isCrossDate = !!row.from_assignment_id && !!row.to_assignment_id;
      const { error } = await (supabase as any).rpc(
        isCrossDate ? 'respond_cross_date_swap' : 'respond_swap',
        { p_swap_request_id: row.id, p_action: 'decline' }
      );
      if (error) throw error;

      setItems((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      alert(e?.message ?? 'Could not decline');
    }
  };

  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const day = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const t = d
      .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      .replace(' ', '');
    return `${day} • ${t}`;
  };

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ marginTop: 0 }}>Approvals</h2>
      <p style={{ opacity: 0.8, marginTop: -6 }}>Swaps waiting for scheduler/admin approval.</p>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 10 }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 10, color: '#b91c1c' }}>{err}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 10, opacity: 0.8 }}>No pending approvals.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={thLeft}>Event</th>
                <th style={th}>When</th>
                <th style={thRight}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td style={tdLeft}>
                    {r.events?.label ?? (r.event_id ? 'Event' : 'Cross-date swap')}
                  </td>
                  <td style={td}>{fmt(r.events?.starts_at)}</td>
                  <td style={tdRight}>
                    <button style={btnPrimarySm} onClick={() => approve(r)}>
                      Approve
                    </button>
                    <button style={btnGhostSm} onClick={() => decline(r)} title="Decline">
                      Decline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* styles */
const th = {
  textAlign: 'left' as const,
  background: '#f8fafc',
  borderBottom: '1px solid #e5e7eb',
  padding: '8px 10px',
};
const thLeft = { ...th, borderRight: '1px solid #e5e7eb' };
const thRight = { ...th, textAlign: 'right' as const };
const tdLeft = { padding: '10px', borderTop: '1px solid #f1f5f9' };
const td = { padding: '10px', borderTop: '1px solid #f1f5f9' };
const tdRight = { padding: '10px', borderTop: '1px solid #f1f5f9', textAlign: 'right' as const };

const btnPrimarySm: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  marginRight: 6,
};
const btnGhostSm: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111',
  cursor: 'pointer',
};
