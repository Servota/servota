/* apps/web/src/App.tsx */
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, setContext, clearContext } from '@servota/shared';

import TeamRequirements from './console/team/TeamRequirements';
import TeamSchedule from './console/team/TeamSchedule';
import TeamSettings from './console/team/TeamSettings';
import TeamApprovals from './console/team/TeamApprovals';
import TeamMembers from './console/team/TeamMembers';
import AccountConsole from './console/account/AccountConsole';

import MyRoster from './member/MyRoster';
import MyUnavailability from './member/MyUnavailability';

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
      <div className="p-6 font-sans max-w-[960px] mx-auto">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="grid place-items-center min-h-screen font-sans">
        <div className="w-[360px] p-5 border border-[#e5e7eb] rounded-[12px] shadow">
          <h1 className="mt-0 text-[#111] font-bold text-[20px]">Servota Web</h1>
          <p className="opacity-80">Sign in to continue.</p>
          <div className="grid gap-2">
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="p-2.5 rounded-[10px] border border-[#ddd] text-[14px]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="p-2.5 rounded-[10px] border border-[#ddd] text-[14px]"
            />
            <button onClick={signIn} className="py-2 px-3 rounded-[10px] bg-[#2563eb] border border-[#2563eb] text-white font-bold">
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const me = session.user.email ?? session.user.id;

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
<header className="sv-header">
  <div className="sv-header-inner">
    {/* Left: Logo + brand */}
    <div className="flex items-center gap-3">
  <img src="/servota-logo.png" alt="Servota" className="sv-logo"
       onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
</div>

    {/* Right: quick actions */}
    <div className="flex items-center gap-2">
      <button className="sv-icon-btn" title="Notifications" aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>
      <button className="sv-icon-btn-ghost" title="Profile" aria-label="Profile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21a8 8 0 0 0-16 0"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </button>
    </div>
  </div>
</header>


      {/* Body: sidebar + main */}
      <div className="flex min-h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <aside className="sv-side">
          <div className="sv-side-title">Servota</div>

          <NavItem label="Home" active={view === 'home'} onClick={() => setView('home')} />
          <NavItem label="Memberships" active={view === 'memberships'} onClick={() => setView('memberships')} />
          <NavItem label="Unavailability" active={view === 'unavailability'} onClick={() => setView('unavailability')} />
          <NavItem label="My Roster" active={view === 'roster'} onClick={() => setView('roster')} />
          <NavItem label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />

          <div className="flex-1" />
          <div className="text-[12px] opacity-70 mt-3">{me}</div>
          <button className="sv-btn-ghost" onClick={signOut}>Sign out</button>
        </aside>

        {/* Main */}
        <main className="sv-main">
          {view === 'home' && (
            <section className="sv-page">
              <div className="sv-card p-4">
                <h1 className="sv-h1">Home</h1>
                <p className="sv-meta">This will become a “My Roster” summary.</p>
              </div>
            </section>
          )}

          {view === 'memberships' && (
            <section className="sv-page">
              <div className="sv-card p-4">
                <h1 className="sv-h1">Memberships</h1>
                <p className="sv-meta">
                  Pick an account to work in. Admins see “Manage Account”. Schedulers see “Manage Team”.
                </p>
              </div>

              <h2 className="sv-section mt-5">Accounts</h2>
              {accounts.length === 0 ? (
                <p className="sv-meta">No accounts found.</p>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {accounts.map((a) => {
                    const isAdmin = a.role === 'owner' || a.role === 'admin';
                    const active = a.account_id === accountId;
                    return (
                      <div key={a.account_id} className="sv-card p-3" style={{ background: active ? '#f8fafc' : '#fff' }}>
                        <div className="font-bold">{a.accounts?.name ?? a.account_id}</div>
                        <div className="text-[12px] opacity-70">
                          Role: {a.role ?? 'member'} | Status: {a.status ?? 'active'}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button className="py-2 px-3 rounded-[10px] bg-[#2563eb] border border-[#2563eb] text-white font-bold" onClick={() => openAccount(a.account_id)}>
                            Open
                          </button>
                          {isAdmin && (
                            <button className="py-2 px-3 rounded-[10px] bg-white border border-[#e5e7eb] font-bold" onClick={() => manageAccount(a.account_id)}>
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
                  <h2 className="sv-section mt-5">
                    Teams in <span className="font-bold">{accountLabel || accountId}</span>
                  </h2>
                  {teams.length === 0 ? (
                    <p className="sv-meta">No teams yet.</p>
                  ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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
                          <div key={t.id} className="sv-card p-3" style={{ background: active ? '#f8fafc' : '#fff' }}>
                            <div className="font-bold">{t.name ?? t.id}</div>
                            <div className="text-[12px] opacity-70">
                              {role ? `Your role: ${role}` : 'Member'}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button className="py-2 px-3 rounded-[10px] bg-[#2563eb] border border-[#2563eb] text-white font-bold" onClick={() => openTeam(t.id)}>
                                Open Team
                              </button>
                              {isScheduler && (
                                <button className="py-2 px-3 rounded-[10px] bg-white border border-[#e5e7eb] font-bold" onClick={() => manageTeam(t.id)}>
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
            <section className="sv-page">
              <div className="sv-card p-4">
                <h1 className="sv-h1">Account Console</h1>
                <p className="sv-meta">
                  Managing account: <strong>{accountLabel || accountId || '(none selected)'}</strong>
                </p>
              </div>
              <div className="mt-4">
                <AccountConsole />
              </div>
            </section>
          )}

          {view === 'team-manage' && (
            <section className="sv-page">
              <div className="sv-card p-4">
                <h1 className="sv-h1">Team Console</h1>
                <p className="sv-meta">
                  Team: <strong>{teamLabel || teamId || '(none selected)'}</strong> in{' '}
                  <em>{accountLabel || accountId || '(no account)'}</em>
                </p>
              </div>

              <div className="sv-section-bar mt-4"><div className="sv-section-bar-text">Team Tabs</div></div>
              <TeamTabs value={teamTab} onChange={setTeamTab} approvalsEnabled={allowSwaps && requireApproval} />

              <div className="mt-4">
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
            <section className="sv-page">
              <MyUnavailability />
            </section>
          )}

          {view === 'roster' && (
            <section className="sv-page">
              <h1 className="sv-h1">My Roster</h1>
              <MyRoster />
            </section>
          )}

          {view === 'settings' && (
            <section className="sv-page">
              <div className="sv-card p-4">
                <h1 className="sv-h1">Settings</h1>
                <p className="sv-meta">Profile and preferences (to be built).</p>
              </div>
            </section>
          )}
        </main>
      </div>
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
      className={`sv-nav-item ${active ? 'sv-nav-item-active' : 'sv-nav-item-hover'}`}
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
    <div className="flex gap-1 border-b border-[#e5e7eb]">
      {tabs
        .filter((t) => t.show)
        .map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`py-2 px-3 rounded-t-[10px] border border-transparent font-bold ${
              value === t.key ? 'bg-white border-[#e5e7eb] border-b-white' : ''
            }`}
          >
            {t.label}
          </button>
        ))}
    </div>
  );
}
