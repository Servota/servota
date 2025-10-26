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

type SiblingRow = {
  event_id: string;
  starts_at: string;
  ends_at: string;
  label: string;
};

type EnrichedSibling = SiblingRow & {
  assignment_id: string | null; // earliest assignment for that event (if any)
  assignee_name: string; // "Unassigned" | profile full_name | "Assigned"
  is_mine: boolean; // true if I'm the earliest/primary assignee
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

  const [siblings, setSiblings] = useState<EnrichedSibling[] | undefined>(undefined);
  const [baseAssignmentId, setBaseAssignmentId] = useState<string | null>(null);

  const [targetId, setTargetId] = useState<string | null>(null);
  const target = (siblings ?? []).find((e) => e.event_id === targetId) ?? null;

  useEffect(() => {
    setTargetId(null);
  }, [selected.event_id]);

  // Load base assignment + sibling events with assignee context (match mobile behaviour)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!open) return;

      // Determine current user
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id ?? null;

      // Base assignment (am I assigned on the selected/base date?)
      if (me) {
        const { data: baseAsg } = await supabase
          .from('assignments')
          .select('id')
          .eq('event_id', selected.event_id)
          .eq('user_id', me)
          .limit(1)
          .maybeSingle();
        if (!mounted) return;
        setBaseAssignmentId(baseAsg?.id ?? null);
      } else if (mounted) {
        setBaseAssignmentId(null);
      }

      // If this event is not part of a template series, there are no "other dates"
      if (!selected.template_id) {
        if (!mounted) return;
        setSiblings([]);
        return;
      }

      // Sibling events in the same series (not including the base event)
      const nowIso = new Date().toISOString();
      const { data: evRows, error: evErr } = await supabase
        .from('events')
        .select('id, starts_at, ends_at, label')
        .eq('template_id', selected.template_id)
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true });
      if (!mounted) return;

      if (evErr) {
        setSiblings([]);
        return;
      }

      const baseFiltered: SiblingRow[] =
        (evRows ?? [])
          .filter((e: any) => e.id !== selected.event_id)
          .map((e: any) => ({
            event_id: e.id,
            starts_at: e.starts_at,
            ends_at: e.ends_at,
            label: e.label ?? 'Event',
          })) || [];

      if (baseFiltered.length === 0) {
        setSiblings([]);
        return;
      }

      // Pull earliest assignment per sibling event
      const evIds = baseFiltered.map((r) => r.event_id);
      const { data: asgRows } = await supabase
        .from('assignments')
        .select('id, user_id, event_id, assigned_at')
        .in('event_id', evIds)
        .order('assigned_at', { ascending: true });

      // Map earliest per event
      const firstByEvent: Record<string, { id: string; user_id: string } | null> = {};
      const userSet = new Set<string>();
      for (const id of evIds) firstByEvent[id] = null;
      for (const a of asgRows ?? []) {
        if (!firstByEvent[a.event_id]) {
          firstByEvent[a.event_id] = { id: a.id, user_id: a.user_id };
          if (a.user_id) userSet.add(a.user_id);
        }
      }

      // Resolve assignee names
      let profilesByUser: Record<string, string> = {};
      if (userSet.size > 0) {
        const { data: profRows } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', Array.from(userSet));
        profilesByUser = Object.fromEntries(
          (profRows ?? []).map((p: any) => [p.user_id, (p.full_name ?? '').trim()])
        );
      }

      // Build enriched sibling rows
      const out: EnrichedSibling[] = baseFiltered.map((ev) => {
        const first = firstByEvent[ev.event_id];
        if (first) {
          const name = profilesByUser[first.user_id] || 'Assigned';
          return {
            ...ev,
            assignment_id: first.id,
            assignee_name: name,
            is_mine: me ? first.user_id === me : false,
          };
        } else {
          return {
            ...ev,
            assignment_id: null,
            assignee_name: 'Unassigned',
            is_mine: false,
          };
        }
      });

      if (!mounted) return;
      setSiblings(out);
    })();

    return () => {
      mounted = false;
    };
  }, [
    open,
    selected.event_id,
    selected.template_id,
    selected.account_id,
    selected.team_id,
    supabase,
  ]);

  // ---- formatting helpers (simple ASCII to avoid encoding glitches) ----
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
    // Example: Mon, Oct 27 - 9:00 AM to 5:00 PM
    return `${day} - ${hhmm(s)} to ${hhmm(e)}`;
  };

  const fmtDayBadge = (iso: string) => {
    const d = new Date(iso);
    const dow = d.toLocaleDateString(undefined, { weekday: 'short' });
    const day = d.getDate().toString().padStart(2, '0');
    return { dow, day };
  };

  // ---- actions ----
  const cantMakeIt = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user?.id ?? null;
      if (!me) throw new Error('Not signed in');
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
    }
  };

  const proposeSwap = async () => {
    if (!target) return;
    // NOTE: Keeping this as a stub until you confirm the RPC you want to call.
    alert(
      'Propose swap clicked for:\n' +
        `${fmtTimeRange(selected.starts_at, selected.ends_at)}  ↔  ${fmtTimeRange(
          target.starts_at,
          target.ends_at
        )}\n\n(We will wire this to your swap RPC next.)`
    );
  };

  // Eligible to propose only if:
  // - I have a baseAssignmentId
  // - Target exists
  // - Target is assigned to someone (not "Unassigned")
  // - Target is NOT mine
  const proposeEnabled =
    !!baseAssignmentId &&
    !!target &&
    target.assignment_id !== null &&
    target.assignee_name !== 'Unassigned' &&
    !target.is_mine;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow p-5 overflow-y-auto">
        {/* Header actions card (matches mobile structure) */}
        <div className="border border-[#ececec] rounded-[14px] p-3 bg-white shadow-sm">
          <div className="flex items-center gap-3">
            {/* date badge */}
            <div className="w-[44px] rounded-[10px] border-2 border-[#1C94B3] bg-white flex flex-col items-center py-1.5">
              <div className="text-[12px] font-bold text-[#1C94B3] leading-none">
                {fmtDayBadge(selected.starts_at).dow}
              </div>
              <div className="text-[18px] font-extrabold text-[#111] leading-none">
                {fmtDayBadge(selected.starts_at).day}
              </div>
            </div>

            {/* base event meta */}
            <div className="flex-1">
              <div className="text-[18px] font-bold text-[#111]">{selected.label}</div>
              <div className="text-[12px] text-[#555] mt-[2px]">
                {accountName}
                {teamName ? ` — ${teamName}` : ''}
              </div>
              <div className="text-[13px] text-[#444]">
                {fmtTimeRange(selected.starts_at, selected.ends_at)}
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="h-2" />
          <div className="flex gap-2">
            {/* Filled neutral */}
            <button
              className="py-2 px-3 rounded-[12px] border border-[#ececec] bg-[#eef1f5] font-extrabold text-[12px] text-[#111]"
              onClick={cantMakeIt}
              title="Open replacement request"
            >
              Can't make it
            </button>

            {/* Outline neutral (disabled until eligible) */}
            <button
              className={`py-2 px-3 rounded-[12px] border font-extrabold text-[12px] ${
                proposeEnabled
                  ? 'border-[#d1d5db] bg-white text-[#111]'
                  : 'border-[#e5e7eb] bg-white text-[#9aa3af] cursor-not-allowed'
              }`}
              onClick={proposeSwap}
              disabled={!proposeEnabled}
              title={proposeEnabled ? 'Propose swap' : 'Select a date below to enable'}
            >
              {target ? 'Propose swap' : 'Select a date below'}
            </button>
          </div>
        </div>

        {/* Section header */}
        <div className="bg-[#f3f4f6] rounded-[10px] py-[6px] px-[10px] border border-[#ececec] mt-4">
          <div className="text-[13px] font-extrabold text-[#111] tracking-[0.2px]">
            Other dates in this series
          </div>
        </div>

        {/* Loading / empty states */}
        {siblings === undefined && (
          <div className="text-[13px] text-[#6b7280] pl-[2px] mt-1">Loading…</div>
        )}
        {siblings !== undefined && (siblings ?? []).length === 0 && (
          <div className="text-[13px] text-[#6b7280] mt-2">No other upcoming dates.</div>
        )}

        {/* Sibling list */}
        {siblings !== undefined && (siblings ?? []).length > 0 && (
          <ul className="mt-2 space-y-2">
            {(siblings ?? []).map((s) => {
              const active = targetId === s.event_id;
              const isDisabled = s.assignee_name === 'Unassigned' || s.is_mine;
              return (
                <li key={s.event_id}>
                  <button
                    className={`w-full text-left p-3 rounded-[14px] bg-white border shadow-sm transition
                      ${active ? 'border-[#10b981]' : 'border-[#ececec]'}
                      ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    onClick={() => {
                      if (isDisabled) return;
                      setTargetId(s.event_id);
                    }}
                    disabled={isDisabled}
                    title={
                      isDisabled
                        ? s.is_mine
                          ? 'You are assigned to this date'
                          : 'No assignee on this date'
                        : 'Select this date to propose a swap'
                    }
                  >
                    <div className="font-bold text-[16px] text-[#111]">{s.label}</div>
                    <div className="text-[13px] text-[#444]">
                      {fmtTimeRange(s.starts_at, s.ends_at)}
                    </div>
                    <div className="text-[12px] text-[#333] mt-[2px]">
                      Assigned: {s.assignee_name}
                    </div>
                    {active && <div className="text-[12px] text-[#10b981] mt-1">Selected</div>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
