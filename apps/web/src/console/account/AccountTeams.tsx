// apps/web/src/console/account/AccountTeams.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type Team = {
  id: string;
  name: string;
  active: boolean | null;
  allow_swaps: boolean | null;
  roster_visibility: 'account' | 'team' | null;
  swap_requires_approval: boolean | null;
};

export default function AccountTeams({ accountId }: { accountId: string }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  // create
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  // inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const input: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid #ddd',
    minWidth: 220,
  };
  const select: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #ddd',
  };
  const btn: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#fff',
    cursor: 'pointer',
  };
  const btnPrimary: React.CSSProperties = {
    ...btn,
    border: '1px solid #2563eb',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 700,
  };
  const btnDanger: React.CSSProperties = {
    ...btn,
    border: '1px solid #ef4444',
    color: '#ef4444',
    fontWeight: 700,
  };

  const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
  };
  const th: React.CSSProperties = {
    textAlign: 'left',
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    padding: '8px 10px',
  };
  const thLeft = { ...th, borderRight: '1px solid #e5e7eb' };
  const tdLeft: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9' };
  const td: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9' };

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id,name,active,allow_swaps,roster_visibility,swap_requires_approval')
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
      // 1) Insert the team and get its id
      const { data: inserted, error: insErr } = await supabase
        .from('teams')
        .insert([{ account_id: accountId, name, active: true }])
        .select('id')
        .single();
      if (insErr) throw insErr;

      // 2) Try to auto-join the creator as scheduler (ignore RLS errors quietly)
      try {
        const me = (await supabase.auth.getUser()).data?.user?.id ?? null;
        if (me && inserted?.id) {
          await supabase.from('team_memberships').insert([
            {
              team_id: inserted.id,
              user_id: me,
              role: 'scheduler',
              status: 'active',
            } as any,
          ]);
        }
      } catch {
        // RLS may block — that's okay; UX stays clean and team still gets created.
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

  const updateSetting = async (
    teamId: string,
    patch: Partial<Pick<Team, 'allow_swaps' | 'roster_visibility' | 'swap_requires_approval'>>
  ) => {
    // Coerce to non-nullable shape expected by supabase types
    const clean: {
      allow_swaps?: boolean;
      roster_visibility?: 'account' | 'team';
      swap_requires_approval?: boolean;
    } = {};

    if ('allow_swaps' in patch) clean.allow_swaps = !!patch.allow_swaps;
    if ('swap_requires_approval' in patch)
      clean.swap_requires_approval = !!patch.swap_requires_approval;
    if ('roster_visibility' in patch && patch.roster_visibility) {
      clean.roster_visibility = patch.roster_visibility;
    }

    try {
      const { error } = await supabase.from('teams').update(clean).eq('id', teamId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not update team settings');
    }
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
        <strong>Teams</strong>
      </div>

      <div style={{ padding: 10 }}>
        {/* Create */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Create team</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.currentTarget.value)}
              style={input}
            />
            <button style={btnPrimary} onClick={createTeam} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Tip: You can archive teams instead of deleting to keep history intact.
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div>Loading...</div>
        ) : err ? (
          <div style={{ color: '#b91c1c' }}>{err}</div>
        ) : teams.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No teams yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={thLeft}>Team</th>
                <th style={th}>Active</th>
                <th style={th}>Allow swaps</th>
                <th style={th}>Roster visibility</th>
                <th style={th}>Swap needs approval</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const isEditing = editingId === t.id;
                return (
                  <tr key={t.id}>
                    <td style={tdLeft}>
                      {isEditing ? (
                        <div
                          style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}
                        >
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.currentTarget.value)}
                            style={input}
                          />
                          <button style={btnPrimary} onClick={() => saveRename(t.id)}>
                            Save
                          </button>
                          <button
                            style={btn}
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
                      <input
                        type="checkbox"
                        checked={!!t.allow_swaps}
                        onChange={(e) =>
                          updateSetting(t.id, { allow_swaps: e.currentTarget.checked })
                        }
                        title="If enabled, members can request swaps"
                      />
                    </td>
                    <td style={td}>
                      <select
                        value={t.roster_visibility ?? 'team'}
                        onChange={(e) =>
                          updateSetting(t.id, {
                            roster_visibility: e.currentTarget.value as Team['roster_visibility'],
                          })
                        }
                        style={select}
                        title="Who can see this team's roster"
                      >
                        <option value="team">team</option>
                        <option value="account">account</option>
                      </select>
                    </td>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={!!t.swap_requires_approval}
                        onChange={(e) =>
                          updateSetting(t.id, { swap_requires_approval: e.currentTarget.checked })
                        }
                        title="If enabled, swaps require admin approval"
                      />
                    </td>
                    <td style={td}>
                      {isEditing ? null : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button style={btn} onClick={() => beginRename(t)}>
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
        )}
      </div>
    </div>
  );
}
