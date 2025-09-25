// apps/web/src/member/MyUnavailability.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type Unavailability = {
  id: string;
  user_id: string;
  account_id: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  reason?: string | null;
};

export default function MyUnavailability() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  // account resolution (context-like flow: default -> first membership)
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvingAcct, setResolvingAcct] = useState(true);

  // list state
  const [items, setItems] = useState<Unavailability[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // add dialog
  const today = stripTime(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [startDay, setStartDay] = useState<Date>(today);
  const [endDay, setEndDay] = useState<Date>(today);
  const [savingAdd, setSavingAdd] = useState(false);

  // remove dialog
  const [removeTarget, setRemoveTarget] = useState<Unavailability | null>(null);
  const [removing, setRemoving] = useState(false);

  // resolve an account id automatically so user doesn't need to pick one
  useEffect(() => {
    let mounted = true;
    (async () => {
      setResolvingAcct(true);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const uid = userRes.user?.id;
        if (!uid) throw new Error('Not signed in');

        // profiles.default_account_id
        const { data: prof } = await supabase
          .from('profiles')
          .select('default_account_id')
          .eq('user_id', uid)
          .maybeSingle();

        if (prof?.default_account_id) {
          if (mounted) setResolvedAccountId(prof.default_account_id);
          return;
        }

        // first active account_membership
        const { data: mems } = await supabase
          .from('account_memberships')
          .select('account_id')
          .eq('user_id', uid)
          .eq('status', 'active')
          .order('created_at', { ascending: true });

        const first = (mems ?? [])[0]?.account_id ?? null;
        if (mounted) setResolvedAccountId(first);
      } finally {
        if (mounted) setResolvingAcct(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // load list
  const load = useCallback(async () => {
    if (!resolvedAccountId) {
      setItems([]);
      setHasLoadedOnce(true);
      return;
    }
    setError(null);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not signed in');

      const startCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); // yesterday

      const { data, error } = await supabase
        .from('unavailability')
        .select('id,user_id,account_id,starts_at,ends_at,reason')
        .eq('user_id', uid)
        .eq('account_id', resolvedAccountId)
        .gte('ends_at', startCutoff)
        .order('starts_at', { ascending: true });

      if (error) throw error;
      setItems((data ?? []) as Unavailability[]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load unavailability');
    } finally {
      setHasLoadedOnce(true);
    }
  }, [resolvedAccountId, supabase]);

  useEffect(() => {
    if (!resolvingAcct) load();
  }, [resolvingAcct, load]);

  // add range
  const saveAdd = useCallback(async () => {
    if (!resolvedAccountId) {
      alert('No account available. Join or create an account first.');
      return;
    }
    if (endDay < startDay) {
      alert('"To" must be the same day or after "From".');
      return;
    }
    try {
      setSavingAdd(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not signed in');

      const starts_at = normalizeStart(startDay); // 00:00 local
      const ends_at = normalizeEnd(endDay); // 23:59:59.999 local

      const { error } = await supabase
        .from('unavailability')
        .insert([{ user_id: uid, account_id: resolvedAccountId, starts_at, ends_at }]);

      if (error) throw error;
      setAddOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not add unavailability.');
    } finally {
      setSavingAdd(false);
    }
  }, [resolvedAccountId, startDay, endDay, supabase, load]);

  // remove
  const doRemove = useCallback(async () => {
    const id = removeTarget?.id;
    if (!id) return;
    try {
      setRemoving(true);
      const { error } = await supabase.from('unavailability').delete().eq('id', id);
      if (error) throw error;
      setRemoveTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not remove entry.');
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, supabase, load]);

  // formatting
  const fmtIsoDay = (iso: string) =>
    stripTime(new Date(iso)).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <section className="sv-page">
      {/* header */}
      <div className="sv-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="sv-h1">My Unavailability</h2>
            <p className="sv-meta">Block out times you can&apos;t serve.</p>
          </div>
          <button
            className="sv-btn"
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={resolvingAcct}
            aria-busy={resolvingAcct}
          >
            Add
          </button>
        </div>
        {error ? (
          <p className="sv-meta" style={{ color: '#c00' }}>
            {error}
          </p>
        ) : null}
      </div>

      {/* empty / loading states */}
      {!hasLoadedOnce ? (
        <div className="sv-meta mt-2">Loading entries...</div>
      ) : items.length === 0 ? (
        <div className="sv-card p-4 mt-2 sv-meta">No future unavailability.</div>
      ) : null}

      {/* list */}
      <div className="mt-3 space-y-2">
        {items.map((it) => (
          <div key={it.id} className="sv-card p-3">
            <div className="sv-card-row items-start justify-between">
              <div className="pr-3">
                <div className="text-xs uppercase tracking-wide text-[#6b7280]">From</div>
                <div className="font-semibold text-[#111]">{fmtIsoDay(it.starts_at)}</div>
                <div className="text-xs uppercase tracking-wide text-[#6b7280] mt-2">To</div>
                <div className="font-semibold text-[#111]">{fmtIsoDay(it.ends_at)}</div>
                {it.reason ? <div className="sv-meta mt-2">{it.reason}</div> : null}
              </div>

              <button
                className="w-8 h-8 rounded-full bg-[#eef1f5] border border-[#e5e7eb] grid place-items-center"
                title="Remove"
                onClick={() => setRemoveTarget(it)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* add dialog */}
      {addOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setAddOpen(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 -translate-x-1/2 bottom-4 w-[min(560px,92vw)]">
            <div className="rounded-[14px] border border-[#ececec] bg-white p-4 shadow">
              <div className="font-extrabold text-[#111] text-[18px]">Add unavailability</div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="grid">
                  <span className="text-sm font-bold text-[#111] mb-1">From</span>
                  <input
                    type="date"
                    className="border rounded-[10px] px-3 py-2"
                    value={toInputDate(startDay)}
                    onChange={(e) => {
                      const d = fromInputDate(e.currentTarget.value);
                      setStartDay(d);
                      setEndDay((prev) => (prev < d ? d : prev));
                    }}
                  />
                </label>

                <label className="grid">
                  <span className="text-sm font-bold text-[#111] mb-1">To</span>
                  <input
                    type="date"
                    className="border rounded-[10px] px-3 py-2"
                    min={toInputDate(startDay)}
                    value={toInputDate(endDay)}
                    onChange={(e) => {
                      const d = fromInputDate(e.currentTarget.value);
                      if (d >= startDay) setEndDay(d);
                    }}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button className="sv-btn-ghost" type="button" onClick={() => setAddOpen(false)}>
                  Close
                </button>
                <button
                  className="sv-btn"
                  type="button"
                  disabled={savingAdd}
                  aria-busy={savingAdd}
                  onClick={saveAdd}
                >
                  {savingAdd ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* remove confirm */}
      {!!removeTarget && (
        <>
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setRemoveTarget(null)}
            aria-hidden
          />
          <div className="fixed left-1/2 -translate-x-1/2 top-[20vh] w-[min(460px,92vw)]">
            <div className="rounded-[16px] bg-white p-4 border border-[#e5e7eb] shadow">
              <div className="font-extrabold text-[#111] text-[16px] mb-1">
                Remove this unavailability?
              </div>
              <div className="sv-meta">This cannot be undone.</div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="sv-btn-ghost" onClick={() => setRemoveTarget(null)}>
                  Cancel
                </button>
                <button
                  className="sv-btn"
                  onClick={doRemove}
                  disabled={removing}
                  aria-busy={removing}
                >
                  {removing ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* helpers */
function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function normalizeStart(day: Date) {
  const s = new Date(day);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
}
function normalizeEnd(day: Date) {
  const e = new Date(day);
  e.setHours(23, 59, 59, 999);
  return e.toISOString();
}
function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function fromInputDate(s: string) {
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return stripTime(new Date(y, (m || 1) - 1, d || 1));
}
