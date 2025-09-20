import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, setContext, clearContext } from '@servota/shared';
import TeamRequirements from './TeamRequirements';
import TeamSchedule from './console/team/TeamSchedule';
import TeamSettings from './TeamSettings';
import TeamApprovals from './TeamApprovals';
import TeamMembers from './TeamMembers';
import AccountConsole from './AccountConsole';

/* ------------ Types ------------ */

type View =
  | 'home'
  | 'memberships'
  | 'unavailability'
  | 'roster'
  | 'settings'
  | 'account-manage'
  | 'team-manage';

type TeamTab = 'members' | 'requirements' | 'schedule' | 'approvals' | 'settings';

type SessionT = {
  user: { id: string; email?: string | null } | null;
} | null;

type AccountMembership = {
  account_id: string;
  role: 'owner' | 'admin' | null;
  status: string | null;
  accounts?: { name?: string | null } | null;
};

type Team = {
  id: string;
  account_id: string;
  name: string | null;
  active: boolean | null;
  allow_swaps?: boolean | null;
  swap_requires_approval?: boolean | null;
};

type TeamMembership = {
  account_id: string;
  team_id: string;
  role: 'scheduler' | 'member' | null;
  status: string | null;
};

/* ------------ App ------------ */

export default function App() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [session, setSession] = useState<SessionT>(null);
  const [loading, setLoading] = useState(true);

  // auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // navigation / scope
  const [view, setView] = useState<View>('home');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState<string>('');
  const [teamLabel, setTeamLabel] = useState<string>('');

  // team sub-nav
  const [teamTab, setTeamTab] = useState<TeamTab>('requirements');

  // policy (toggles Approvals tab)
  const [allowSwaps, setAllowSwaps] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);

  // data for memberships / teams
  const [accounts, setAccounts] = useState<AccountMembership[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamRolesById, setTeamRolesById] = useState<Record<string, TeamMembership['role']>>({});

  /* ---- bootstrap auth + saved context ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) console.warn(error);
      setSession(data.session ? { user: data.session.user } : { user: null });
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s ? { user: s.user } : { user: null });
    });

    // restore context
    const savedA = localStorage.getItem('servota.accountId');
    const savedT = localStorage.getItem('servota.teamId');
    if (savedA) {
      setAccountId(savedA);
      setContext({ accountId: savedA });
    }
    if (savedT) {
      setTeamId(savedT);
      setContext({ teamId: savedT });
    }

    return () => {
      sub.subscription.unsubscribe();
      mounted = false;
    };
  }, [supabase]);

  /* ---- persist/restore team tab per team ---- */
  useEffect(() => {
    if (!teamId) return;
    const key = `servota.teamTab.${teamId}`;
    const saved = (localStorage.getItem(key) as TeamTab | null) ?? null;
    if (saved) setTeamTab(saved);
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    const key = `servota.teamTab.${teamId}`;
    localStorage.setItem(key, teamTab);
  }, [teamId, teamTab]);

  /* ---- load account memberships ---- */
  useEffect(() => {
    if (!session?.user?.id) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('account_memberships')
        .select('account_id, role, status, accounts:account_id(name)')
        .eq('user_id', session.user!.id)
        .eq('status', 'active');

      if (error) {
        console.warn('account_memberships error:', error.message);
        if (!cancelled) setAccounts([]);
        return;
      }
      const rows = (data ?? []) as AccountMembership[];
      if (!cancelled) setAccounts(rows);

      const row = rows.find((r) => r.account_id === accountId);
      setAccountLabel(row?.accounts?.name ?? '');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, supabase, accountId]);

  /* ---- load teams + team roles + policy for selected account ---- */
  useEffect(() => {
    if (!session?.user?.id || !accountId) {
      setTeams([]);
      setTeamRolesById({});
      setTeamLabel('');
      setAllowSwaps(false);
      setRequireApproval(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: tData, error: tErr }, { data: tmData, error: tmErr }] = await Promise.all([
        supabase
          .from('teams')
          .select<any>('id, account_id, name, active, allow_swaps, swap_requires_approval')
          .eq('account_id', accountId)
          .eq('active', true),
        supabase
          .from('team_memberships')
          .select('team_id, account_id, role, status')
          .eq('account_id', accountId)
          .eq('user_id', session.user!.id)
          .eq('status', 'active'),
      ]);
      if (tErr) console.warn('teams error:', tErr.message);
      if (tmErr) console.warn('team_memberships error:', tmErr.message);

      const tRows = (tData ?? []) as unknown as Team[];
      const tmRows = (tmData ?? []) as TeamMembership[];

      if (!cancelled) {
        setTeams(tRows);
        setTeamRolesById(Object.fromEntries(tmRows.map((r) => [r.team_id, r.role ?? null])));
      }

      const selected = tRows.find((t) => t.id === teamId) ?? null;
      setTeamLabel(selected?.name ?? '');
      setAllowSwaps(!!selected?.allow_swaps);
      setRequireApproval(!!(selected as any)?.swap_requires_approval);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, supabase, accountId, teamId]);

  /* ------------ actions ------------ */

  const signIn = async () => {
    if (!email || !password) return alert('Enter email and password');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) alert(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearContext();
    localStorage.removeItem('servota.accountId');
    localStorage.removeItem('servota.teamId');
    setAccountId(null);
    setTeamId(null);
    setAccounts([]);
    setTeams([]);
    setView('home');
  };

  const openAccount = (id: string) => {
    setAccountId(id);
    setTeamId(null);
    setContext({ accountId: id, teamId: null });
    localStorage.setItem('servota.accountId', id);
    localStorage.removeItem('servota.teamId');
    setView('memberships');
  };

  const manageAccount = (id: string) => {
    if (id !== accountId) openAccount(id);
    setView('account-manage');
  };

  const openTeam = (id: string) => {
    setTeamId(id);
    setContext({ teamId: id });
    localStorage.setItem('servota.teamId', id);
    setView('team-manage');
  };

  const manageTeam = (id: string) => {
    if (id !== teamId) openTeam(id);
    setView('team-manage');
  };

  /* ------------ layout ------------ */

  if (loading) {
    return (
      <div style={wrap}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div style={centerWrap}>
        <div style={card}>
          <h1 style={{ marginTop: 0 }}>Servota Web</h1>
          <p style={{ opacity: 0.8 }}>Sign in to continue.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              style={input}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              style={input}
            />
            <button onClick={signIn} style={btnPrimary}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const me = session.user.email ?? session.user.id;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily }}>
      {/* Sidebar */}
      <aside style={side}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Servota</div>

        <NavItem label="Home" active={view === 'home'} onClick={() => setView('home')} />
        <NavItem
          label="Memberships"
          active={view === 'memberships'}
          onClick={() => setView('memberships')}
        />
        <NavItem
          label="Unavailability"
          active={view === 'unavailability'}
          onClick={() => setView('unavailability')}
        />
        <NavItem label="Roster" active={view === 'roster'} onClick={() => setView('roster')} />
        <NavItem
          label="Settings"
          active={view === 'settings'}
          onClick={() => setView('settings')}
        />

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>{me}</div>
        <button style={btnGhost} onClick={signOut}>
          Sign out
        </button>
      </aside>

      {/* Main */}
      <main style={main}>
        {view === 'home' && (
          <section>
            <h1>Home</h1>
            <p>Welcome. This will become a “My Roster” summary.</p>
          </section>
        )}

        {view === 'memberships' && (
          <section>
            <h1>Memberships</h1>
            <p style={{ opacity: 0.8 }}>
              Pick an account to work in. Admins see “Manage Account”. Schedulers see “Manage Team”.
            </p>

            <h2 style={{ marginTop: 16 }}>Accounts</h2>
            {accounts.length === 0 ? (
              <p>No accounts found.</p>
            ) : (
              <div style={grid}>
                {accounts.map((a) => {
                  const isAdmin = a.role === 'owner' || a.role === 'admin';
                  const active = a.account_id === accountId;
                  return (
                    <div key={a.account_id} style={tile(active)}>
                      <div style={{ fontWeight: 700 }}>{a.accounts?.name ?? a.account_id}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Role: {a.role ?? 'member'} | Status: {a.status ?? 'active'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button style={btnPrimary} onClick={() => openAccount(a.account_id)}>
                          Open
                        </button>
                        {isAdmin && (
                          <button style={btnSecondary} onClick={() => manageAccount(a.account_id)}>
                            Manage Account
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {accountId && (
              <>
                <h2 style={{ marginTop: 20 }}>
                  Teams in <span style={{ fontWeight: 700 }}>{accountLabel || accountId}</span>
                </h2>
                {teams.length === 0 ? (
                  <p>No teams yet.</p>
                ) : (
                  <div style={grid}>
                    {teams.map((t) => {
                      const role = teamRolesById[t.id] ?? null;
                      const isScheduler =
                        role === 'scheduler' ||
                        accounts.find(
                          (a) =>
                            a.account_id === accountId && (a.role === 'owner' || a.role === 'admin')
                        );
                      const active = t.id === teamId;
                      return (
                        <div key={t.id} style={tile(active)}>
                          <div style={{ fontWeight: 700 }}>{t.name ?? t.id}</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            {role ? `Your role: ${role}` : 'Member'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button style={btnPrimary} onClick={() => openTeam(t.id)}>
                              Open Team
                            </button>
                            {isScheduler && (
                              <button style={btnSecondary} onClick={() => manageTeam(t.id)}>
                                Manage Team
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {view === 'account-manage' && (
          <section>
            <h1>Account Console</h1>
            <p>
              Managing account: <strong>{accountLabel || accountId || '(none selected)'}</strong>
            </p>
            {/* Render the full Manage Account console */}
            <AccountConsole />
          </section>
        )}

        {view === 'team-manage' && (
          <section>
            <header style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h1 style={{ marginBottom: 0 }}>Team Console</h1>
            </header>
            <p style={{ marginTop: 6 }}>
              Team: <strong>{teamLabel || teamId || '(none selected)'}</strong> in{' '}
              <em>{accountLabel || accountId || '(no account)'}</em>
            </p>

            <TeamTabs
              value={teamTab}
              onChange={setTeamTab}
              approvalsEnabled={allowSwaps && requireApproval}
            />

            <div style={{ marginTop: 16 }}>
              {teamTab === 'members' && <TeamMembers />}

              {teamTab === 'requirements' && <TeamRequirements />}

              {teamTab === 'schedule' && <TeamSchedule />}

              {teamTab === 'approvals' && allowSwaps && requireApproval && <TeamApprovals />}

              {teamTab === 'settings' && (
                <TeamSettings
                  onPolicyChange={(p: { allowSwaps: boolean; requireApproval: boolean }) => {
                    setAllowSwaps(!!p.allowSwaps);
                    setRequireApproval(!!p.requireApproval);
                  }}
                />
              )}
            </div>
          </section>
        )}

        {view === 'unavailability' && (
          <section>
            <h1>Unavailability</h1>
            <p>Personal unavailability editor (to be built, similar to mobile).</p>
          </section>
        )}

        {view === 'roster' && (
          <section>
            <h1>My Roster</h1>
            <p>Your upcoming assignments list/calendar (to be built).</p>
          </section>
        )}

        {view === 'settings' && (
          <section>
            <h1>Settings</h1>
            <p>Profile and preferences (to be built).</p>
          </section>
        )}
      </main>
    </div>
  );
}

/* ------------ subcomponents ------------ */

function NavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...navItem,
        background: active ? '#eef2ff' : 'transparent',
        borderColor: active ? '#e5e7eb' : 'transparent',
        fontWeight: active ? 700 : 600,
      }}
    >
      {label}
    </button>
  );
}

function TeamTabs({
  value,
  onChange,
  approvalsEnabled,
}: {
  value: TeamTab;
  onChange: any;
  approvalsEnabled: boolean;
}) {
  const tabs: { key: TeamTab; label: string; show?: boolean }[] = [
    { key: 'members', label: 'Members', show: true },
    { key: 'requirements', label: 'Requirements', show: true },
    { key: 'schedule', label: 'Schedule', show: true },
    { key: 'approvals', label: 'Approvals', show: approvalsEnabled },
    { key: 'settings', label: 'Settings', show: true },
  ];

  return (
    <div style={tabsWrap}>
      {tabs
        .filter((t) => t.show)
        .map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              ...tabBtn,
              ...(value === t.key ? tabBtnActive : {}),
            }}
          >
            {t.label}
          </button>
        ))}
    </div>
  );
}

/* ------------ styles ------------ */

const fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

const side: React.CSSProperties = {
  width: 220,
  padding: 16,
  borderRight: '1px solid #e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const main: React.CSSProperties = {
  flex: 1,
  padding: 20,
};

const navItem: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid transparent',
  cursor: 'pointer',
  fontWeight: 600,
};

const wrap: React.CSSProperties = {
  padding: 24,
  fontFamily,
  maxWidth: 960,
  margin: '0 auto',
};

const centerWrap: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '100vh',
  fontFamily,
};

const card: React.CSSProperties = {
  width: 360,
  padding: 20,
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};

const input: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  fontSize: 14,
  boxSizing: 'border-box',
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

const btnSecondary: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111',
  fontWeight: 700,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111',
  cursor: 'pointer',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 12,
  marginTop: 8,
};

const tile = (active: boolean): React.CSSProperties => ({
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: active ? '#f8fafc' : '#fff',
});

const tabsWrap: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  borderBottom: '1px solid #e5e7eb',
};

const tabBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '10px 10px 0 0',
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: 700,
};

const tabBtnActive: React.CSSProperties = {
  background: '#fff',
  borderColor: '#e5e7eb',
  borderBottomColor: '#fff',
};
