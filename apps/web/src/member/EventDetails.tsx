// apps/web/src/member/EventDetails.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

export type SelectedEvent = {
  event_id: string;
  template_id: string | null;
  account_id: string;
  team_id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  account_name?: string | null;
  team_name?: string | null;
};

type EventRow = {
  event_id: string;
  starts_at: string;
  ends_at: string;
  label: string;
};

export default function EventDetails({
  open,
  onClose,
  selected,
  accountName,
  teamName,
}: {
  open: boolean;
  onClose: () => void;
  selected: SelectedEvent;
  accountName: string;
  teamName: string;
}) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [siblings, setSiblings] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!open || !selected?.template_id) {
        setSiblings([]);
        return;
      }
      setLoading(true);
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('id, starts_at, ends_at, label')
        .eq('template_id', selected.template_id)
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true });

      if (!mounted) return;
      if (error) {
        setSiblings([]);
      } else {
        const rows: EventRow[] =
          (data ?? [])
            .filter((e: any) => e.id !== selected.event_id)
            .map((e: any) => ({
              event_id: e.id,
              starts_at: e.starts_at,
              ends_at: e.ends_at,
              label: e.label ?? 'Event',
            })) || [];
        setSiblings(rows);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [open, selected?.template_id, selected?.event_id, supabase]);

  const fmtTimeRange = (sIso: string, eIso: string) => {
    const s = new Date(sIso);
    const e = new Date(eIso);
    const day = s.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const hhmm = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
    return `${day} • ${hhmm(s)}–${hhmm(e)}`;
  };

  const cantMakeIt = async () => {
    try {
      setBusy(true);
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id ?? null;
      if (!me) throw new Error('Not signed in');

      // Minimal insert (RLS must allow)
      const { error } = await supabase.from('replacement_requests').insert({
        account_id: selected.account_id,
        team_id: selected.team_id,
        event_id: selected.event_id,
        requester_user_id: me,
        opened_at: new Date().toISOString(),
        status: 'open',
      });
      if (error) throw error;
      alert('Replacement request opened. Eligible teammates will be notified.');
    } catch (e: any) {
      alert(`Could not open replacement: ${e?.message ?? 'Please try again.'}`);
    } finally {
      setBusy(false);
    }
  };

  const proposeSwap = () => {
    // Next step: call your RPC (apply once we wire the server function)
    alert('Swap request UI ready. We will wire this to your swap RPC next.');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow p-5 overflow-y-auto">
        <div className="flex items-start justify-between">
          <h2 className="sv-h1">{selected.label}</h2>
          <button className="sv-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sv-meta mt-1">
          {accountName}
          {teamName ? ` — ${teamName}` : ''}
        </div>
        <div className="sv-meta mt-1">{fmtTimeRange(selected.starts_at, selected.ends_at)}</div>

        <div className="flex gap-2 mt-4">
          <button className="sv-btn-ghost" onClick={cantMakeIt} disabled={busy}>
            {busy ? 'Working…' : "Can't make it"}
          </button>
          <button className="sv-btn-ghost" onClick={proposeSwap}>
            Propose swap
          </button>
        </div>

        <div className="sv-section-bar mt-5">
          <div className="sv-section-bar-text">Other dates in this series</div>
        </div>
        {loading && <div className="sv-meta mt-2">Loading…</div>}
        {!loading && (siblings ?? []).length === 0 && (
          <div className="sv-meta mt-2">No other upcoming dates.</div>
        )}
        {!loading && (siblings ?? []).length > 0 && (
          <ul className="mt-2 space-y-2">
            {siblings!.map((s) => (
              <li key={s.event_id} className="sv-card p-3">
                <div className="font-semibold">{s.label}</div>
                <div className="sv-meta">{fmtTimeRange(s.starts_at, s.ends_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
