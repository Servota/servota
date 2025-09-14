// apps/web/src/AccountConsole.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, getContext } from '@servota/shared';
import AccountMembers from './AccountMembers';

/**
 * Manage Account console:
 * - Members tab lives in ./AccountMembers (invite = Viewer; owner-only role edits)
 * - Teams tab is here (create/delete)
 * - Settings tab placeholder
 */

type TeamRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type Tab = 'members' | 'teams' | 'settings';

export default function AccountConsole() {
  const { accountId } = getContext() as { accountId: string | null; teamId: string | null };
  const [tab, setTab] = useState<Tab>('members');

  if (!accountId) {
    return (
      <section style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Manage Account</h2>
        <p>Select an account in <strong>Memberships</strong> first.</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ marginTop: 0 }}>Manage Account</h2>
      <Tabs value={tab} onChange={setTab} />
      {tab === 'members' && <AccountMembers accountId={accountId} />}
      {tab === 'teams' && <AccountTeams accountId={accountId} />}
      {tab === 'settings' && <AccountSettings />}
    </section>
  );
}

/* ---------------- Tabs ---------------- */

function Tabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => onChange('members')} style={tabBtn(value === 'members')}>
        Members
      </button>
      <button onClick={() => onChange('teams')} style={tabBtn(value === 'teams')}>
        Teams
      </button>
      <button onClick={() => onChange('settings')} style={tabBtn(value === 'settings')}>
        Settings
      </button>
    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: active ? '#f3f4f6' : '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  marginRight: 6,
});

/* ---------------- Teams ---------------- */

function AccountTeams({ accountId }: { accountId: string }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, active')
        .eq('account_id', accountId)
        .order('name', { ascending: true });
      if (error) throw error;
      setTeams((data ?? []) as TeamRow[]);
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
    const label = name.trim();
    if (!label) return alert('Enter a team name.');
    setWorking(true);
    try {
      const { error } = await (supabase as any).rpc('create_team', {
        p_account_id: accountId,
        p_name: label,
      });
      if (error) throw error;
      setName('');
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not create team');
    } finally {
      setWorking(false);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team and its data?')) return;
    setWorking(true);
    try {
      const { error } = await (supabase as any).rpc('delete_team', {
        p_account_id: accountId,
        p_team_id: teamId,
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not delete team');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
        <strong>Teams</strong>
      </div>

      <div style={{ padding: 10, display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="New team name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={input}
          />
          <button style={btnPrimary} onClick={createTeam} disabled={working}>
            {working ? 'Creating…' : 'Create team'}
          </button>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : err ? (
          <div style={{ color: '#b91c1c' }}>{err}</div>
        ) : teams.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No teams yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={thLeft}>Name</th>
                <th style={thRight}>Action</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td style={tdLeft}>{team.name}</td>
                  <td style={tdRight}>
                    <button style={btnGhostSm} onClick={() => deleteTeam(team.id)} disabled={working}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */

function AccountSettings() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
        <strong>Settings</strong>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ opacity: 0.8 }}>
          Coming soon: plan, limits, suspension, export, billing links, etc.
        </div>
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

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
const thRight = { ...th, textAlign: 'right' as const };
const tdLeft: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9' };
const tdRight: React.CSSProperties = { padding: '10px', borderTop: '1px solid #f1f5f9', textAlign: 'right' };

const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  minWidth: 200,
};

const btnPrimary: React.CSSProperties = {
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
