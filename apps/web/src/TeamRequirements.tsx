// apps/web/src/TeamRequirements.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  getBrowserSupabaseClient,
  // use the guard that returns non-null strings:
  requireTeamScope,
} from '@servota/shared';

type Requirement = {
  id: string;
  account_id: string;
  team_id: string;
  name: string;
  active: boolean | null;
};

export default function TeamRequirements() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  // Non-null, throws if not set:
  const { accountId, teamId } = requireTeamScope();

  const [items, setItems] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create/edit state
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from('requirements')
          .select('id, account_id, team_id, name, active')
          .eq('account_id', accountId)
          .eq('team_id', teamId)
          .order('name', { ascending: true });

        if (error) throw error;
        if (!cancelled) setItems((data ?? []) as Requirement[]);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load requirements');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, accountId, teamId]);

  const refresh = async () => {
    const { data, error } = await supabase
      .from('requirements')
      .select('id, account_id, team_id, name, active')
      .eq('account_id', accountId)
      .eq('team_id', teamId)
      .order('name', { ascending: true });
    if (error) throw error;
    setItems((data ?? []) as Requirement[]);
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      // Small TS shim with `as any` because generated row types may not be flowing:
      await supabase.from('requirements').insert(
        {
          account_id: accountId,
          team_id: teamId,
          name,
          active: true,
        } as any
      );
      setNewName('');
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? 'Could not create requirement');
    }
  };

  const onRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await supabase.from('requirements').update({ name } as any).eq('id', id);
      setEditingId(null);
      setEditingName('');
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? 'Could not rename');
    }
  };

  const onToggle = async (id: string, next: boolean) => {
    try {
      await supabase.from('requirements').update({ active: next } as any).eq('id', id);
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, active: next } : r)));
    } catch (e: any) {
      alert(e?.message ?? 'Could not update');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this requirement? This may affect events/templates using it.')) return;
    try {
      await supabase.from('requirements').delete().eq('id', id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message ?? 'Could not delete');
    }
  };

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ marginTop: 0 }}>Requirements</h2>
      <p style={{ opacity: 0.8, marginTop: -6 }}>
        Define skills/roles/checks that gate assignments for this team.
      </p>

      {/* Create */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          placeholder="New requirement name"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          style={input}
        />
        <button onClick={onCreate} style={btnPrimary}>
          Add
        </button>
      </div>

      {/* List */}
      <div style={listWrap}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Loading…</div>
        ) : err ? (
          <div style={{ color: '#b91c1c' }}>{err}</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No requirements yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={thLeft}>Name</th>
                <th style={th}>Active</th>
                <th style={thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const editing = editingId === r.id;
                return (
                  <tr key={r.id}>
                    <td style={tdLeft}>
                      {editing ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.currentTarget.value)}
                          style={input}
                          autoFocus
                        />
                      ) : (
                        r.name
                      )}
                    </td>
                    <td style={tdCenter}>
                      <input
                        type="checkbox"
                        checked={!!r.active}
                        onChange={(e) => onToggle(r.id, e.currentTarget.checked)}
                      />
                    </td>
                    <td style={tdRight}>
                      {editing ? (
                        <>
                          <button style={btnPrimarySm} onClick={() => onRename(r.id)}>
                            Save
                          </button>
                          <button
                            style={btnGhostSm}
                            onClick={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            style={btnSecondarySm}
                            onClick={() => {
                              setEditingId(r.id);
                              setEditingName(r.name);
                            }}
                          >
                            Rename
                          </button>
                          <button style={btnGhostSm} onClick={() => onDelete(r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* ---- styles (inline, no deps) ---- */

const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  minWidth: 240,
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
  marginRight: 6,
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

const listWrap: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
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

const thLeft: React.CSSProperties = { ...th, borderRight: '1px solid #e5e7eb' };
const thRight: React.CSSProperties = { ...th };
const tdLeft: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9' };
const tdCenter: React.CSSProperties = {
  padding: '10px',
  borderTop: '1px solid #f1f5f9',
  textAlign: 'center',
  width: 80,
};
const tdRight: React.CSSProperties = {
  padding: '10px',
  borderTop: '1px solid #f1f5f9',
  textAlign: 'right',
  width: 220,
};
