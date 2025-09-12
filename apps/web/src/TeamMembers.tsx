// apps/web/src/TeamMembers.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, requireTeamScope } from '@servota/shared';

type AccountUser = {
  user_id: string;
  display: string; // derived label for UI
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'admin' | 'viewer' | null; // account-level
  status: string | null;
};

type TeamMember = {
  user_id: string;
  display: string; // derived label for UI
  full_name: string | null;
  phone: string | null;
  role: 'scheduler' | 'member' | null; // team-level
  status: string | null;
};

export default function TeamMembers() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = requireTeamScope();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [accountUsers, setAccountUsers] = useState<AccountUser[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [q, setQ] = useState('');

  // ----- reusable loader: refresh account users + team members -----
  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) bare membership rows (no FK joins)
      const [{ data: am, error: amErr }, { data: tm, error: tmErr }] = await Promise.all([
        supabase
          .from('account_memberships')
          .select('user_id, role, status')
          .eq('account_id', accountId)
          .eq('status', 'active'),
        supabase
          .from('team_memberships')
          .select('user_id, role, status')
          .eq('account_id', accountId)
          .eq('team_id', teamId)
          .eq('status', 'active'),
      ]);
      if (amErr) throw amErr;
      if (tmErr) throw tmErr;

      const amRows = (am ?? []) as any[];
      const tmRows = (tm ?? []) as any[];

      // 2) fetch profiles via IN(user_id) — use full_name/phone only
      const ids = Array.from(
        new Set([...amRows.map((r: any) => r.user_id), ...tmRows.map((r: any) => r.user_id)])
      );
      const profMap = new Map<string, { full_name: string | null; phone: string | null }>();
      if (ids.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', ids);
        if (pErr) throw pErr;
        for (const p of (profs ?? []) as any[]) {
          profMap.set(p.user_id, {
            full_name: p.full_name ?? null,
            phone: p.phone ?? null,
          });
        }
      }

      // 3) hydrate lists (derive display = full_name ?? user_id)
      const acctUsers: AccountUser[] = amRows.map((r: any) => {
        const p = profMap.get(r.user_id);
        const full = p?.full_name ?? null;
        return {
          user_id: r.user_id,
          display: full ?? r.user_id,
          full_name: full,
          phone: p?.phone ?? null,
          role: (r.role as AccountUser['role']) ?? null,
          status: r.status ?? null,
        };
      });

      const teamMems: TeamMember[] = tmRows.map((r: any) => {
        const p = profMap.get(r.user_id);
        const full = p?.full_name ?? null;
        return {
          user_id: r.user_id,
          display: full ?? r.user_id,
          full_name: full,
          phone: p?.phone ?? null,
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

  // ----- mutations -----

  const addToTeam = async (userId: string) => {
    try {
      await supabase.from('team_memberships').insert({
        account_id: accountId,
        team_id: teamId,
        user_id: userId,
        role: 'member',
        status: 'active',
      } as any);
      await loadAll(); // refresh both lists so they move from right -> left
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
      await loadAll(); // refresh both lists so they move from left -> right
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

  // ----- derived lists -----
  const teamIds = new Set(teamMembers.map((m) => m.user_id));
  const available = accountUsers.filter((u) => !teamIds.has(u.user_id));

  const filter = (s: string) => (s ?? '').toLowerCase().includes(q.toLowerCase());

  // ----- render -----
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
