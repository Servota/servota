// apps/web/src/TeamSchedule.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserSupabaseClient, requireTeamScope } from '@servota/shared';

type RequirementMode = 'ALL_OF' | 'ANY_OF';
type Freq = '1' | '2' | '4';
type WeekKey = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

type EventTemplate = {
  id: string;
  account_id: string;
  team_id: string;
  label: string | null;
  description: string | null;
  start_time: string | null; // "HH:mm"
  duration: number | null; // minutes
  rrule: string | null; // e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=SU,TH
  capacity: number | null;
  requirement_mode: RequirementMode | null;
};

type EventRow = {
  id: string;
  label: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
};

type RequirementRow = { id: string; name: string; active: boolean | null };

/* Assign modal types */
type EligibleUser = {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  team_role: 'member' | 'scheduler' | null;
};

type Assignee = { user_id: string; name: string };

const WEEKDAYS: { key: WeekKey; label: string }[] = [
  { key: 'SU', label: 'Sun' },
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
];
const DEFAULT_DAYS: Record<WeekKey, boolean> = {
  SU: true,
  MO: false,
  TU: false,
  WE: false,
  TH: false,
  FR: false,
  SA: false,
};

export default function TeamSchedule() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = requireTeamScope();

  // templates list
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // creation modal
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tplLabel, setTplLabel] = useState('');
  const [rangeFrom, setRangeFrom] = useState(isoDateToday());
  const [rangeTo, setRangeTo] = useState(isoDatePlusDays(56));
  const [freq, setFreq] = useState<Freq>('1'); // every 1/2/4 weeks
  const [days, setDays] = useState<Record<WeekKey, boolean>>({ ...DEFAULT_DAYS });
  const [startTime, setStartTime] = useState('10:00'); // HH:mm
  const [durationMin, setDurationMin] = useState(60);
  const [capacity, setCapacity] = useState<number | ''>(1);
  const [mode, setMode] = useState<RequirementMode>('ALL_OF');

  // requirements picker
  const [reqs, setReqs] = useState<RequirementRow[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<Record<string, boolean>>({});

  // open series
  const [openId, setOpenId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventsErr, setEventsErr] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  /* Track assignments for events in the open series */
  const [assignCounts, setAssignCounts] = useState<Record<string, number>>({});
  const [assigneesByEvent, setAssigneesByEvent] = useState<Record<string, Assignee[]>>({});

  /* Assign modal state */
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEventId, setAssignEventId] = useState<string | null>(null);
  const [eligibles, setEligibles] = useState<EligibleUser[]>([]);
  const [eligLoading, setEligLoading] = useState(false);
  const [eligQuery, setEligQuery] = useState('');

  /* Current event info inside modal */
  const [currentCapacity, setCurrentCapacity] = useState<number | null>(null);
  const [currentAssignees, setCurrentAssignees] = useState<Assignee[]>([]);

  // load templates + requirements
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [{ data: tData, error: tErr }, { data: rData, error: rErr }] = await Promise.all([
          supabase
            .from('event_templates')
            .select(
              'id, account_id, team_id, label, description, start_time, duration, rrule, capacity, requirement_mode'
            )
            .eq('account_id', accountId)
            .eq('team_id', teamId)
            .order('label', { ascending: true }),
          supabase
            .from('requirements')
            .select('id, name, active')
            .eq('account_id', accountId)
            .eq('team_id', teamId)
            .eq('active', true)
            .order('name', { ascending: true }),
        ]);
        if (tErr) throw tErr;
        if (rErr) throw rErr;
        if (!cancelled) {
          setTemplates((tData ?? []) as EventTemplate[]);
          setReqs((rData ?? []) as RequirementRow[]);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load schedule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, teamId, supabase]);

  // open a series to view events + fetch assignments summary (counts + names)
  async function openTemplate(id: string) {
    setOpenId(id);
    setEvents(null);
    setEventsErr(null);
    setEventsLoading(true);
    setAssignCounts({});
    setAssigneesByEvent({});
    try {
      const nowIso = new Date().toISOString();
      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('id, label, starts_at, ends_at, capacity')
        .eq('template_id', id)
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(200);
      if (evErr) throw evErr;
      const list = (ev ?? []) as EventRow[];
      setEvents(list);

      if (list.length > 0) {
        const ids = list.map((e) => e.id);
        // fetch assignments joined to profiles for these event IDs
        const { data: asg, error: aErr } = await supabase
          .from('assignments')
          .select('event_id, user_id, profiles:user_id(full_name, display_name)')
          .in('event_id', ids);
        if (aErr) throw aErr;

        const counts: Record<string, number> = {};
        const namesMap: Record<string, Assignee[]> = {};
        for (const e of list) {
          counts[e.id] = 0;
          namesMap[e.id] = [];
        }
        for (const row of (asg ?? []) as any[]) {
          counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
          const name = row.profiles?.display_name ?? row.profiles?.full_name ?? row.user_id;
          namesMap[row.event_id].push({ user_id: row.user_id, name });
        }
        setAssignCounts(counts);
        setAssigneesByEvent(namesMap);
      }
    } catch (e: any) {
      setEventsErr(e?.message ?? 'Failed to load events');
    } finally {
      setEventsLoading(false);
    }
  }

  // delete a series + its events
  const deleteTemplate = async (id: string, label?: string | null) => {
    const ok = confirm(
      `Delete this series${label ? ` (“${label}”)` : ''}?\n\nThis will delete ALL events in this series.`
    );
    if (!ok) return;
    try {
      await supabase.from('events').delete().eq('template_id', id);
      await supabase.from('event_templates').delete().eq('id', id);
      if (openId === id) {
        setOpenId(null);
        setEvents(null);
      }
      // refresh list
      const { data, error } = await supabase
        .from('event_templates')
        .select(
          'id, account_id, team_id, label, description, start_time, duration, rrule, capacity, requirement_mode'
        )
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .order('label', { ascending: true });
      if (error) throw error;
      setTemplates((data ?? []) as EventTemplate[]);
    } catch (e: any) {
      alert(e?.message ?? 'Could not delete series');
    }
  };

  // create series (template + generated events + attach requirements)
  const createSeries = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const name = tplLabel.trim();
      if (!name) {
        alert('Please enter a name');
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(startTime)) {
        alert('Start time must be HH:mm');
        return;
      }
      const cap = capacity === '' ? null : Number(capacity);
      if (cap !== null && (isNaN(cap) || cap < 1)) {
        alert('Capacity must be a positive number');
        return;
      }

      const chosenDays = WEEKDAYS.filter((d) => (days ?? DEFAULT_DAYS)[d.key]).map((d) => d.key);
      if (chosenDays.length === 0) {
        alert('Pick at least one weekday');
        return;
      }

      const from = parseISODate(rangeFrom),
        to = parseISODate(rangeTo);
      if (!from || !to || to < from) {
        alert('Invalid date range (From must be <= To)');
        return;
      }

      const interval = Number(freq); // 1,2,4
      const rrule = `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${chosenDays.join(',')}`;

      // 1) Insert template
      const { data: tplIns, error: tplErr } = await supabase
        .from('event_templates')
        .insert({
          account_id: accountId,
          team_id: teamId,
          label: name,
          description: null,
          start_time: startTime,
          duration: durationMin,
          rrule,
          capacity: cap,
          requirement_mode: mode,
        } as any)
        .select('id')
        .single();
      if (tplErr) throw tplErr;
      const templateId = (tplIns as any).id as string;

      // 2) Generate instances
      const instants = computeWeeklyInstances({
        from,
        to,
        startTime,
        durationMin,
        intervalWeeks: interval,
        byDays: chosenDays as WeekKey[],
      });

      // 3) Insert events
      const eventsPayload = instants.map(({ startISO, endISO }) => ({
        account_id: accountId,
        team_id: teamId,
        template_id: templateId,
        label: name,
        description: null,
        starts_at: startISO,
        ends_at: endISO,
        capacity: cap,
        requirement_mode: mode,
      }));
      if (eventsPayload.length > 0) {
        const { data: evIns, error: evErr } = await supabase
          .from('events')
          .insert(eventsPayload as any)
          .select('id');
        if (evErr) throw evErr;
        const newEventIds: string[] = (evIns ?? []).map((r: any) => r.id);

        // 4) Attach requirements to those events
        const pickedReqIds = Object.keys(selectedReqIds).filter((k) => selectedReqIds[k]);
        if (pickedReqIds.length > 0 && newEventIds.length > 0) {
          const evReqPayload = newEventIds.flatMap((eid) =>
            pickedReqIds.map((rid) => ({
              account_id: accountId,
              team_id: teamId,
              event_id: eid,
              requirement_id: rid,
            }))
          );
          const { error: erErr } = await supabase
            .from('event_requirements')
            .insert(evReqPayload as any);
          if (erErr) throw erErr;
        }
      }

      // close + refresh + open series
      setCreating(false);
      // reset form fields
      setTplLabel('');
      setRangeFrom(isoDateToday());
      setRangeTo(isoDatePlusDays(56));
      setFreq('1');
      setDays({ ...DEFAULT_DAYS });
      setStartTime('10:00');
      setDurationMin(60);
      setCapacity(1);
      setMode('ALL_OF');
      setSelectedReqIds({});

      const { data: tData, error: tErr } = await supabase
        .from('event_templates')
        .select(
          'id, account_id, team_id, label, description, start_time, duration, rrule, capacity, requirement_mode'
        )
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .order('label', { ascending: true });
      if (tErr) throw tErr;
      setTemplates((tData ?? []) as EventTemplate[]);
      await openTemplate(templateId);
    } catch (e: any) {
      alert(e?.message ?? 'Could not create series');
    } finally {
      setSaving(false);
    }
  };

  // open Assign modal and load eligible users, plus current assignees & capacity
  const openAssign = async (eventId: string) => {
    setAssignOpen(true);
    setAssignEventId(eventId);
    setEligLoading(true);
    setEligibles([]);
    setEligQuery('');
    setCurrentAssignees(assigneesByEvent[eventId] ?? []);
    const ev = (events ?? []).find((e) => e.id === eventId);
    setCurrentCapacity(ev?.capacity ?? null);

    try {
      const { data, error } = await (supabase as any).rpc('get_eligible_users_for_event', {
        p_account_id: accountId,
        p_team_id: teamId,
        p_event_id: eventId,
      });
      if (error) throw error;
      setEligibles((data ?? []) as EligibleUser[]);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to load eligible users');
      setAssignOpen(false);
    } finally {
      setEligLoading(false);
    }
  };

  // assign selected user, update local state, keep modal open
  const assignToEvent = async (userId: string) => {
    if (!assignEventId) return;
    const cap = currentCapacity ?? null;
    const assigned = currentAssignees.length;
    if (cap !== null && assigned >= cap) {
      alert('Event is already at capacity.');
      return;
    }

    try {
      await supabase.from('assignments').insert({
        account_id: accountId,
        team_id: teamId,
        event_id: assignEventId,
        user_id: userId,
        status: 'confirmed',
        source: 'manual',
        assigned_at: new Date().toISOString(),
      } as any);

      // update modal state
      const match = eligibles.find((e) => e.user_id === userId);
      const name = match?.display_name ?? match?.full_name ?? userId;
      setCurrentAssignees((prev) => [...prev, { user_id: userId, name }]);

      // refresh counts on main table
      setAssignCounts((prev) => ({
        ...prev,
        [assignEventId]: (prev[assignEventId ?? ''] ?? 0) + 1,
      }));
      setAssigneesByEvent((prev) => {
        const copy = { ...prev };
        const arr = copy[assignEventId ?? ''] ? [...copy[assignEventId ?? '']] : [];
        arr.push({ user_id: userId, name });
        copy[assignEventId ?? ''] = arr;
        return copy;
      });
    } catch (e: any) {
      alert(e?.message ?? 'Could not assign user');
    }
  };

  const filteredEligibles = eligibles.filter((e) => {
    const label = (e.display_name ?? e.full_name ?? e.user_id ?? '').toString();
    return label.toLowerCase().includes(eligQuery.toLowerCase());
  });

  const modalFull = currentCapacity !== null && currentAssignees.length >= currentCapacity;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Event Series</h2>
        <button style={btnPrimary} onClick={() => setCreating(true)}>
          + New
        </button>
      </div>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Create a recurring series. Each date becomes an event (inherits requirements and settings).
      </p>

      {/* Series list */}
      <div style={listWrap}>
        {loading ? (
          <div style={{ padding: 10, opacity: 0.8 }}>Loading…</div>
        ) : err ? (
          <div style={{ padding: 10, color: '#b91c1c' }}>{err}</div>
        ) : templates.length === 0 ? (
          <div style={{ padding: 10, opacity: 0.8 }}>No series yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={thLeft}>Name</th>
                <th style={th}>When</th>
                <th style={th}>Start</th>
                <th style={th}>Duration</th>
                <th style={th}>Mode</th>
                <th style={thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td style={tdLeft}>{t.label ?? '(untitled)'}</td>
                  <td style={td}>{t.rrule ?? '—'}</td>
                  <td style={td}>{t.start_time ?? '—'}</td>
                  <td style={td}>{t.duration ?? '—'} min</td>
                  <td style={td}>{t.requirement_mode ?? 'ALL_OF'}</td>
                  <td style={tdRight}>
                    <button style={btnSecondarySm} onClick={() => openTemplate(t.id)}>
                      Open
                    </button>
                    <button style={btnGhostSm} onClick={() => deleteTemplate(t.id, t.label)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Open series → Upcoming events */}
      {openId && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Upcoming dates</h3>
          <div style={listWrap}>
            {eventsLoading ? (
              <div style={{ padding: 10, opacity: 0.8 }}>Loading…</div>
            ) : eventsErr ? (
              <div style={{ padding: 10, color: '#b91c1c' }}>{eventsErr}</div>
            ) : !events || events.length === 0 ? (
              <div style={{ padding: 10, opacity: 0.8 }}>No upcoming events.</div>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={thLeft}>Label</th>
                    <th style={th}>Starts</th>
                    <th style={th}>Ends</th>
                    <th style={th}>Capacity</th>
                    <th style={th}>Assignees</th>
                    <th style={thRight}>Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const count = assignCounts[e.id] ?? 0;
                    const cap = e.capacity ?? 0;
                    const names = (assigneesByEvent[e.id] ?? []).map((a) => a.name).join(', ');
                    return (
                      <tr key={e.id}>
                        <td style={tdLeft}>{e.label ?? 'Event'}</td>
                        <td style={td}>{fmt(e.starts_at)}</td>
                        <td style={td}>{fmt(e.ends_at)}</td>
                        <td style={td}>{cap ? `${count}/${cap}` : `${count}/—`}</td>
                        <td style={td}>{names || '—'}</td>
                        <td style={tdRight}>
                          <button
                            style={btnPrimarySm}
                            onClick={() => openAssign(e.id)}
                            disabled={e.capacity !== null && count >= e.capacity}
                            title={
                              e.capacity !== null && count >= e.capacity ? 'At capacity' : 'Assign'
                            }
                          >
                            {e.capacity !== null && count >= e.capacity ? 'Full' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create series modal */}
      {creating && (
        <div style={{ ...modalWrap, opacity: saving ? 0.9 : 1 }}>
          <div style={modalCard}>
            <h3 style={{ marginTop: 0 }}>New event series</h3>

            <div style={formRow}>
              <label style={labelStyle}>Name</label>
              <input
                value={tplLabel}
                onChange={(e) => setTplLabel(e.currentTarget.value)}
                style={input}
                disabled={saving}
              />
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Date range</label>
              <div style={dateGrid}>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.currentTarget.value)}
                  style={inputFull}
                  disabled={saving}
                />
                <span style={toChip}>to</span>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.currentTarget.value)}
                  style={inputFull}
                  disabled={saving}
                />
              </div>
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Frequency</label>
              <select
                value={freq}
                onChange={(e) => setFreq(e.currentTarget.value as Freq)}
                style={input}
                disabled={saving}
              >
                <option value="1">Every week</option>
                <option value="2">Every 2 weeks</option>
                <option value="4">Every 4 weeks</option>
              </select>
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Weekdays</label>
              <WeekdayPicker value={days} onChange={setDays as any} disabled={saving} />
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Start time</label>
              <input
                value={startTime}
                onChange={(e) => setStartTime(e.currentTarget.value)}
                style={input}
                placeholder="HH:mm"
                disabled={saving}
              />
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Duration (min)</label>
              <input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.currentTarget.value))}
                style={input}
                disabled={saving}
              />
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Capacity</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) =>
                  setCapacity(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))
                }
                style={input}
                disabled={saving}
              />
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Requirement mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.currentTarget.value as RequirementMode)}
                style={input}
                disabled={saving}
              >
                <option value="ALL_OF">ALL_OF (must have all)</option>
                <option value="ANY_OF">ANY_OF (at least one)</option>
              </select>
            </div>

            <div style={formRow}>
              <label style={labelStyle}>Requirements</label>
              <RequirementsPicker
                items={reqs}
                selected={selectedReqIds}
                onChange={setSelectedReqIds as any}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}
                onClick={createSeries}
                disabled={saving}
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button style={btnGhostSm} onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0006',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: 'calc(100vw - 24px)',
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 8px 30px rgba(0,0,0,.12)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Assign to event
              {currentCapacity !== null ? (
                <span style={{ fontWeight: 400, marginLeft: 8 }}>
                  ({currentAssignees.length}/{currentCapacity})
                </span>
              ) : null}
            </h3>
            {eligLoading ? (
              <div style={{ padding: 8 }}>Loading…</div>
            ) : (
              <>
                <input
                  placeholder="Search people…"
                  value={eligQuery}
                  onChange={(e) => setEligQuery(e.currentTarget.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid #ddd',
                    minWidth: 220,
                  }}
                />
                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    maxHeight: 360,
                    overflowY: 'auto',
                    marginTop: 8,
                  }}
                >
                  {filteredEligibles.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>No eligible users.</div>
                  ) : (
                    filteredEligibles.map((u) => {
                      const label = u.display_name ?? u.full_name ?? u.user_id;
                      const alreadyAssigned = currentAssignees.some((a) => a.user_id === u.user_id);
                      const atCap = modalFull;
                      const disabled = alreadyAssigned || atCap;
                      return (
                        <div
                          key={u.user_id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            alignItems: 'center',
                            padding: 8,
                            border: '1px solid #f1f5f9',
                            borderRadius: 10,
                            opacity: disabled ? 0.6 : 1,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{label}</div>
                            {u.team_role ? (
                              <div style={{ opacity: 0.7, fontSize: 12 }}>{u.team_role}</div>
                            ) : null}
                            {u.phone ? (
                              <div style={{ opacity: 0.7, fontSize: 12 }}>{u.phone}</div>
                            ) : null}
                            {alreadyAssigned ? (
                              <div style={{ opacity: 0.8, fontSize: 12 }}>Assigned</div>
                            ) : null}
                            {atCap && !alreadyAssigned ? (
                              <div style={{ opacity: 0.8, fontSize: 12 }}>Full</div>
                            ) : null}
                          </div>
                          <button
                            style={btnPrimarySm}
                            onClick={() => assignToEvent(u.user_id)}
                            disabled={disabled}
                            title={
                              disabled
                                ? alreadyAssigned
                                  ? 'Already assigned'
                                  : 'At capacity'
                                : 'Add'
                            }
                          >
                            {alreadyAssigned ? 'Assigned' : 'Add'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button style={btnGhostSm} onClick={() => setAssignOpen(false)}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Weekday Picker (dropdown) ---------- */
// props typed as any to avoid ESLint flagging unused param names in function types
function WeekdayPicker(props: any) {
  const { value, onChange, disabled } = props as {
    value: Record<WeekKey, boolean> | undefined;
    onChange: any;
    disabled?: boolean;
  };
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const v = value ?? DEFAULT_DAYS;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = WEEKDAYS.filter((d) => v[d.key]).map((d) => d.label);
  const summary = selected.length ? selected.join(', ') : 'Pick weekdays';

  const toggle = (k: WeekKey, checked: boolean) => {
    const base = value ?? DEFAULT_DAYS;
    onChange({ ...base, [k]: checked });
  };

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <button
        type="button"
        style={pickerBtn}
        onClick={() => !disabled && setOpen((s) => !s)}
        disabled={disabled}
      >
        {summary} <span style={{ marginLeft: 8, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={pickerCard}>
          <div style={pickerList}>
            {WEEKDAYS.map((d) => (
              <label key={d.key} style={pickerRow}>
                <input
                  type="checkbox"
                  checked={!!v[d.key]}
                  onChange={(e) => toggle(d.key, e.currentTarget.checked)}
                />{' '}
                {d.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Requirements Picker (searchable dropdown) ---------- */
// props typed as any to avoid ESLint flagging unused param names in function types
function RequirementsPicker(props: any) {
  const { items, selected, onChange } = props as {
    items: RequirementRow[];
    selected: Record<string, boolean>;
    onChange: any;
  };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = items.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const count = Object.values(selected).filter(Boolean).length;
  const summary = count === 0 ? 'Select requirements' : `${count} selected`;

  const toggle = (id: string, checked: boolean) => onChange({ ...selected, [id]: checked });
  const clearAll = () => onChange({});

  return (
    <div style={{ position: 'relative' }} ref={boxRef}>
      <button type="button" style={pickerBtn} onClick={() => setOpen((s) => !s)}>
        {summary} <span style={{ marginLeft: 8, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={pickerCard}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              placeholder="Search requirements…"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
              style={{ ...input, width: '100%' }}
            />
            <button type="button" style={btnGhostSm} onClick={clearAll}>
              Clear
            </button>
          </div>
          <div style={pickerList}>
            {filtered.length === 0 ? (
              <div style={{ opacity: 0.7, padding: 4 }}>No matches</div>
            ) : (
              filtered.map((r) => (
                <label key={r.id} style={pickerRow}>
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={(e) => toggle(r.id, e.currentTarget.checked)}
                  />{' '}
                  {r.name}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function isoDateToday() {
  const d = new Date();
  const yyyy = d.getFullYear(),
    mm = String(d.getMonth() + 1).padStart(2, '0'),
    dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function isoDatePlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear(),
    mm = String(d.getMonth() + 1).padStart(2, '0'),
    dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function computeWeeklyInstances(opts: {
  from: Date;
  to: Date;
  startTime: string;
  durationMin: number;
  intervalWeeks: number;
  byDays: WeekKey[];
}) {
  const { from, to, startTime, durationMin, intervalWeeks, byDays } = opts;
  const out: { startISO: string; endISO: string }[] = [];
  const [hh, mm] = startTime.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return out;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const key = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()] as WeekKey;
    if (!byDays.includes(key)) continue;
    const weeksSince = Math.floor(
      (stripTime(d).getTime() - startOfWeek(stripTime(from)).getTime()) / (7 * 24 * 3600 * 1000)
    );
    if (weeksSince % intervalWeeks !== 0) continue;
    const s = new Date(d);
    s.setHours(hh, mm, 0, 0);
    const e = new Date(s.getTime() + durationMin * 60 * 1000);
    out.push({ startISO: s.toISOString(), endISO: e.toISOString() });
  }
  return out;
}
function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}
function fmt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(' ', '');
  return `${date} • ${time}`;
}

/* ---------- styles ---------- */
const listWrap: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'separate', borderSpacing: 0 };
const th: React.CSSProperties = {
  textAlign: 'left',
  background: '#f8fafc',
  borderBottom: '1px solid #e5e7eb',
  padding: '8px 10px',
};
const thLeft: React.CSSProperties = { ...th, borderRight: '1px solid #e5e7eb' };
const thRight: React.CSSProperties = { ...th, textAlign: 'right' as const };
const tdLeft: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9' };
const td: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9' };
const tdRight: React.CSSProperties = {
  padding: '10px',
  borderTop: '1px solid #f1f5f9',
  textAlign: 'right',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const btnPrimarySm: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
const btnSecondarySm: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111',
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
const modalWrap: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#0006',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
};
const modalCard: React.CSSProperties = {
  width: 520,
  maxWidth: 'calc(100vw - 24px)',
  background: '#fff',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 8px 30px rgba(0,0,0,.12)',
};
const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  minWidth: 200,
  boxSizing: 'border-box',
};
const formRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '160px 1fr',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
};
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputFull: React.CSSProperties = { ...input, width: '100%', minWidth: 0 };
const dateGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
};
const toChip: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #e5e7eb',
  borderRadius: 999,
  background: '#fff',
  whiteSpace: 'nowrap',
};
const pickerBtn: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 240,
  textAlign: 'left',
};
const pickerCard: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  marginTop: 6,
  width: 360,
  maxWidth: 'calc(100vw - 64px)',
  maxHeight: 280,
  overflow: 'hidden',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  boxShadow: '0 8px 30px rgba(0,0,0,.08)',
  padding: 10,
};
const pickerList: React.CSSProperties = {
  overflowY: 'auto',
  maxHeight: 200,
  border: '1px solid #f1f5f9',
  borderRadius: 10,
  padding: 6,
};
const pickerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 8,
};
