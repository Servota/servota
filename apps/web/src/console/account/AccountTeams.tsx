// apps/web/src/console/account/AccountTeams.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type Team = {
  id: string;
  name: string;
  active: boolean | null;
};

export default function AccountTeams({ accountId }: { accountId: string }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  /* ===== Styles (mirroring mobile look/feel) ===== */
  const colors = {
    bg: '#fafafa',
    cardBg: '#fff',
    border: '#ececec',
    borderSoft: '#d1d5db',
    text: '#111',
    muted: '#6b7280',
    primary: '#111',
    secondaryBg: '#eef1f5',
  };

  const card: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    background: colors.cardBg,
    overflow: 'hidden',
    boxShadow: '0 3px 6px rgba(0,0,0,0.06)',
  };
  const header: React.CSSProperties = {
    padding: 12,
    borderBottom: `1px solid ${colors.border}`,
    fontWeight: 800,
    color: colors.text,
  };
  const body: React.CSSProperties = { padding: 12, background: colors.cardBg };

  const input: React.CSSProperties = {
    padding: '12px',
    borderRadius: 12,
    border: `1px solid ${colors.borderSoft}`,
    background: '#fff',
    outline: 'none',
  };
  const btnBase: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    fontWeight: 800,
  };
  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: colors.primary,
    color: '#fff',
    border: `1px solid ${colors.primary}`,
  };
  const btnDanger: React.CSSProperties = {
    ...btnBase,
    border: '1px solid #ef4444',
    color: '#ef4444',
    background: '#fff',
  };

  const tableWrap: React.CSSProperties = { overflowX: 'auto' };
  const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  };
  const th: React.CSSProperties = {
    textAlign: 'left',
    background: '#f8fafc',
    borderBottom: `1px solid ${colors.border}`,
    padding: '12px',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: colors.muted,
  };
  const td: React.CSSProperties = {
    padding: '12px',
    borderTop: `1px solid ${colors.border}`,
    verticalAlign: 'middle',
    color: colors.text,
  };

  /* ===== Data ===== */
  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id,name,active')
        .eq('account_id', accountId)
        .order('name', { ascending: true });
      if (error) throw error;
      setTeams((data as Team[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const createTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return alert('Enter a team name.');
    setCreating(true);
    try {
      const { data: inserted, error: insErr } = await supabase
        .from('teams')
        .insert([{ account_id: accountId, name, active: true }])
        .select('id')
        .single();
      if (insErr) throw insErr;

      // auto-join creator quietly
      try {
        const me = (await supabase.auth.getUser()).data?.user?.id ?? null;
        if (me && inserted?.id) {
          await supabase.from('team_memberships').insert([
            {
              account_id: accountId,
              team_id: inserted.id,
              user_id: me,
              role: 'scheduler',
              status: 'active',
            } as any,
          ]);
        }
      } catch {
        // ignore if RLS blocks
      }

      setNewTeamName('');
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not create team');
    } finally {
      setCreating(false);
    }
  };

  const beginRename = (t: Team) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const saveRename = async (teamId: string) => {
    const name = editName.trim();
    if (!name) return alert('Enter a team name.');
    try {
      const { error } = await supabase.from('teams').update({ name }).eq('id', teamId);
      if (error) throw error;
      setEditingId(null);
      setEditName('');
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not rename team');
    }
  };

  const toggleActive = async (teamId: string, nextActive: boolean) => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ active: nextActive })
        .eq('id', teamId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not update team status');
    }
  };

  const hardDelete = async (teamId: string) => {
    if (!confirm('Permanently delete this team? This cannot be undone.')) return;
    try {
      const { error } = await (supabase as any).rpc('delete_team', {
        p_account_id: accountId,
        p_team_id: teamId,
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not delete team');
    }
  };

  /* ===== UI ===== */
  return (
    <div style={card}>
      <div style={header}>Teams</div>

      <div style={{ ...body, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontWeight: 800, marginBottom: 8, color: colors.text }}>Create team</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 10,
            alignItems: 'center',
            maxWidth: 640,
          }}
        >
          <input
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.currentTarget.value)}
            style={input}
          />
          <button
            style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}
            onClick={createTeam}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <div style={body}>
        {loading ? (
          <div style={{ color: colors.muted }}>Loading…</div>
        ) : err ? (
          <div style={{ color: '#b91c1c' }}>{err}</div>
        ) : teams.length === 0 ? (
          <div style={{ color: colors.muted }}>No teams yet.</div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Team</th>
                  <th style={th}>Active</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const isEditing = editingId === t.id;
                  return (
                    <tr key={t.id}>
                      <td style={td}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.currentTarget.value)}
                              style={input}
                            />
                            <button style={btnPrimary} onClick={() => saveRename(t.id)}>
                              Save
                            </button>
                            <button
                              style={btnBase}
                              onClick={() => {
                                setEditingId(null);
                                setEditName('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          t.name
                        )}
                      </td>
                      <td style={td}>
                        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!t.active}
                            onChange={(e) => toggleActive(t.id, e.currentTarget.checked)}
                          />
                          <span>{t.active ? 'active' : 'archived'}</span>
                        </label>
                      </td>
                      <td style={td}>
                        {!isEditing && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={btnBase} onClick={() => beginRename(t)}>
                              Rename
                            </button>
                            <button
                              style={btnDanger}
                              onClick={() => hardDelete(t.id)}
                              title="Permanent delete (consider archiving instead)"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
