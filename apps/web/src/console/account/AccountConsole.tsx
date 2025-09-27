// apps/web/src/console/account/AccountConsole.tsx
import React, { useState } from 'react';
import { getContext } from '@servota/shared';
import AccountMembers from './AccountMembers';
import AccountTeams from './AccountTeams';

type Tab = 'members' | 'teams' | 'settings';

export default function AccountConsole() {
  const { accountId } = getContext() as { accountId: string | null; teamId: string | null };
  const [tab, setTab] = useState<Tab>('members');

  if (!accountId) {
    return (
      <section style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Manage Account</h2>
        <p>
          Select an account in <strong>Memberships</strong> first.
        </p>
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

function Tabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: any; // keep lint happy (rule flags named params in function types)
}) {
  const colors = {
    chip: '#eef1f5',
    active: '#111',
    border: '#ececec',
    text: '#111',
  };
  const wrap: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  };
  const btn = (k: Tab, label: string) => {
    const active = value === k;
    return (
      <button
        key={k}
        onClick={() => onChange(k)}
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          border: `1px solid ${active ? colors.active : colors.border}`,
          background: active ? colors.active : colors.chip,
          color: active ? '#fff' : colors.text,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={wrap}>
      {btn('members', 'Members')}
      {btn('teams', 'Teams')}
      {btn('settings', 'Settings')}
    </div>
  );
}

function AccountSettings() {
  return (
    <div
      style={{
        border: '1px solid #ececec',
        borderRadius: 14,
        background: '#fff',
        overflow: 'hidden',
        boxShadow: '0 3px 6px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid #ececec', fontWeight: 800 }}>
        Settings
      </div>
      <div style={{ padding: 12, color: '#6b7280' }}>
        Coming soon: plan, limits, suspension, export, billing links, etc.
      </div>
    </div>
  );
}
