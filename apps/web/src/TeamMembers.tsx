// apps/web/src/TeamMembers.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, requireTeamScope } from '@servota/shared';

type AccountUser = {
  user_id: string;
  display: string; // RPC label (display_name || full_name || user_id)
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'admin' | 'viewer' | null;
  status: string | null;
};

type TeamMember = {
  user_id: string;
  display: string;
  full_name: string | null;
  phone: string | null;
  role: 'scheduler' | 'member' | null;
  status: string | null;
};

type Requirement = {
  id: string;
  name: string;
  active: boolean | null;
};

export default function TeamMembers() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = requireTeamScope();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [accountUsers, setAccountUsers] = useState<AccountUser[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [q, setQ] = useState('');

  // requirements modal state
  const [reqOpen, setReqOpen] = useState(false);
  const [reqUserId, setReqUserId] = useState<string | null>(null);
  const [reqUserLabel, setReqUserLabel] = useState<string>('');
  const [reqLoading, setReqLoading] = useState(false);
  const [allReqs, setAllReqs] = useState<Requirement[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [existingRowIdsByReq, setExistingRowIdsByReq] = useState<Record<string, string>>({}); // req_id -> user_requirements.id

  // ---- reusable loader: refresh account users (via RPC) + team members ----
  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) current team members
      const { data: tm, error: tmErr } = await supabase
        .from('team_memberships')
        .select('user_id, role, status')
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .eq('status', 'active');
      if (tmErr) throw tmErr;
      const tmRows = (tm ?? []) as any[];

      // 2) account members via RPC (bypasses RLS safely)
      const { data: am, error: amErr } = await (supabase as any).rpc('get_account_members', {
        p_account_id: accountId,
      });
      if (amErr) throw amErr;
      const amRows = (am ?? []) as any[];

      // 3) right side list
      const acctUsers: AccountUser[] = amRows.map((r: any) => ({
        user_id: r.user_id as string,
        display: (r.display_name as string) ?? (r.full_name as string) ?? (r.user_id as string),
        full_name: (r.full_name as string) ?? null,
        phone: (r.phone as string) ?? null,
        role: (r.role as AccountUser['role']) ?? null,
        status: (r.status as AccountUser['status']) ?? null,
      }));

      // 4) left side list (use RPC label if available)
      const byId = new Map<string, AccountUser>(acctUsers.map((u) => [u.user_id, u]));
      const teamMems: TeamMember[] = tmRows.map((r: any) => {
        const match = byId.get(r.user_id);
        return {
          user_id: r.user_id,
          display: match?.display ?? r.user_id,
          full_name: match?.full_name ?? null,
          phone: match?.phone ?? null,
          role: (r.role as TeamMember['role']) ?? null,
          status: r.status ?? null,
        };
      });

      setAccountUsers(acctUsers);
      setTeamMembers(teamMems);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, teamId, supabase]);

  // ---- mutations ----
  const addToTeam = async (userId: string) => {
    try {
      await supabase.from('team_memberships').insert({
        account_id: accountId,
        team_id: teamId,
        user_id: userId,
        role: 'member',
        status: 'active',
      } as any);
      await loadAll(); // move right -> left
    } catch (e: any) {
      alert(e?.message ?? 'Could not add member');
    }
  };

  const removeFromTeam = async (userId: string) => {
    if (!confirm('Remove this user from the team?')) return;
    try {
      await supabase
        .from('team_memberships')
        .delete()
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .eq('user_id', userId);
      await loadAll(); // move left -> right
    } catch (e: any) {
      alert(e?.message ?? 'Could not remove member');
    }
  };

  const setTeamRole = async (userId: string, newRole: 'member' | 'scheduler') => {
    try {
      await supabase
        .from('team_memberships')
        .update({ role: newRole } as any)
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .eq('user_id', userId);
      await loadAll(); // keep both lists consistent
    } catch (e: any) {
      alert(e?.message ?? 'Could not update role');
    }
  };

  // ---- requirements modal helpers ----
  const openReqs = async (userId: string, label: string) => {
    setReqOpen(true);
    setReqUserId(userId);
    setReqUserLabel(label);
    setReqLoading(true);
    setAllReqs([]);
    setChecked({});
    setExistingRowIdsByReq({});

    try {
      // All active team requirements
      const { data: reqs, error: reqErr } = await supabase
        .from('requirements')
        .select('id, name, active')
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .eq('active', true)
        .order('name', { ascending: true });
      if (reqErr) throw reqErr;

      const reqList = (reqs ?? []) as Requirement[];
      setAllReqs(reqList);

      // Existing user_requirements for this user
      const { data: urs, error: urErr } = await supabase
        .from('user_requirements')
        .select('id, requirement_id')
        .eq('account_id', accountId)
        .eq('team_id', teamId)
        .eq('user_id', userId);
      if (urErr) throw urErr;

      const current = new Set<string>((urs ?? []).map((r: any) => r.requirement_id));
      const idByReq: Record<string, string> = {};
      for (const r of urs ?? []) {
        idByReq[(r as any).requirement_id] = (r as any).id;
      }

      const chk: Record<string, boolean> = {};
      for (const r of reqList) chk[r.id] = current.has(r.id);

      setChecked(chk);
      setExistingRowIdsByReq(idByReq);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to load requirements');
      setReqOpen(false);
    } finally {
      setReqLoading(false);
    }
  };

  const toggleReq = (reqId: string, v: boolean) => setChecked((prev) => ({ ...prev, [reqId]: v }));

  const saveReqs = async () => {
    if (!reqUserId) return;
    setReqLoading(true);
    try {
      const toInsert: any[] = [];
      const toDeleteIds: string[] = [];

      for (const r of allReqs) {
        const want = !!checked[r.id];
        const existingUrId = existingRowIdsByReq[r.id];
        if (want && !existingUrId) {
          toInsert.push({
            account_id: accountId,
            team_id: teamId,
            user_id: reqUserId,
            requirement_id: r.id,
          });
        } else if (!want && existingUrId) {
          toDeleteIds.push(existingUrId);
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('user_requirements').insert(toInsert as any);
        if (insErr) throw insErr;
      }
      if (toDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('user_requirements')
          .delete()
          .in('id', toDeleteIds);
        if (delErr) throw delErr;
      }

      setReqOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Could not save requirements');
    } finally {
      setReqLoading(false);
    }
  };

  // ---- derived lists ----
  const teamIds = new Set(teamMembers.map((m) => m.user_id));
  const available = accountUsers.filter((u) => !teamIds.has(u.user_id));
  const filter = (s: string) => (s ?? '').toLowerCase().includes(q.toLowerCase());

  // ---- UI ----
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Team Members</h2>
      <p style={{ opacity: 0.8, marginTop: -6 }}>
        Add or remove members from this team. Only users from this account are shown.
      </p>

      {loading ? (
        <div style={{ padding: 10 }}>Loading…</div>
      ) : err ? (
        <div style={{ padding: 10, color: '#b91c1c' }}>{err}</div>
      ) : (
        <div style={gridWrap}>
          {/* In this team */}
          <div style={panel}>
            <div style={panelHead}>
              <strong>In this team</strong>
              <input
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                style={search}
              />
            </div>
            <div style={list}>
              {teamMembers.filter((m) => filter(m.display ?? m.user_id)).length === 0 ? (
                <div style={{ opacity: 0.6 }}>No matches.</div>
              ) : (
                teamMembers
                  .filter((m) => filter(m.display ?? m.user_id))
                  .map((m) => (
                    <div key={m.user_id} style={row}>
                      <div style={colMain}>
                        <div style={{ fontWeight: 700 }}>{m.display}</div>
                        {m.phone ? <div style={muted}>{m.phone}</div> : null}
                      </div>
                      <div style={colActions}>
                        <select
                          value={m.role ?? 'member'}
                          onChange={(e) =>
                            setTeamRole(
                              m.user_id,
                              (e.currentTarget.value as 'member' | 'scheduler') || 'member'
                            )
                          }
                          style={select}
                        >
                          <option value="member">Member</option>
                          <option value="scheduler">Scheduler</option>
                        </select>

                        <button style={btnGhostSm} onClick={() => openReqs(m.user_id, m.display)}>
                          Requirements
                        </button>

                        <button style={btnGhostSm} onClick={() => removeFromTeam(m.user_id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Available in account */}
          <div style={panel}>
            <div style={panelHead}>
              <strong>Available (in account)</strong>
            </div>
            <div style={list}>
              {available.length === 0 ? (
                <div style={{ opacity: 0.6 }}>No more users to add.</div>
              ) : (
                available.map((u) => (
                  <div key={u.user_id} style={row}>
                    <div style={colMain}>
                      <div style={{ fontWeight: 700 }}>{u.display}</div>
                      {u.phone ? <div style={muted}>{u.phone}</div> : null}
                    </div>
                    <div style={colActions}>
                      <button style={btnPrimarySm} onClick={() => addToTeam(u.user_id)}>
                        Add
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requirements modal */}
      {reqOpen && (
        <div style={modalWrap}>
          <div style={modalCard}>
            <h3 style={{ marginTop: 0 }}>Requirements — {reqUserLabel}</h3>

            {reqLoading ? (
              <div style={{ padding: 8 }}>Loading…</div>
            ) : allReqs.length === 0 ? (
              <div style={{ padding: 8, opacity: 0.7 }}>No active requirements for this team.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {allReqs.map((r) => (
                  <label key={r.id} style={checkRow}>
                    <input
                      type="checkbox"
                      checked={!!checked[r.id]}
                      onChange={(e) => toggleReq(r.id, e.currentTarget.checked)}
                    />{' '}
                    {r.name}
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button style={btnGhostSm} onClick={() => setReqOpen(false)} disabled={reqLoading}>
                Close
              </button>
              <button style={btnPrimarySm} onClick={saveReqs} disabled={reqLoading}>
                {reqLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---- styles ---- */
const gridWrap: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

const panel: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
  background: '#fff',
};

const panelHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 10,
  borderBottom: '1px solid #f1f5f9',
};

const list: React.CSSProperties = {
  padding: 10,
  display: 'grid',
  gap: 8,
  maxHeight: 420,
  overflowY: 'auto',
};

const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 8,
  alignItems: 'center',
  border: '1px solid #f1f5f9',
  borderRadius: 10,
  padding: 8,
};

const colMain: React.CSSProperties = { minWidth: 0 };
const colActions: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };

const search: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  minWidth: 200,
};

const select: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #ddd',
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

const btnGhostSm: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111',
  cursor: 'pointer',
};

const muted: React.CSSProperties = { opacity: 0.7, fontSize: 12 };

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

const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
