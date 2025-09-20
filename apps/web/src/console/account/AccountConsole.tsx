// apps/web/src/AccountConsole.tsx
import React, { useState } from 'react';
import { getContext } from '@servota/shared';
import AccountMembers from './AccountMembers';

/**
 * Manage Account console:
 * - Members tab lives in ./AccountMembers (invite = Viewer; owner-only role edits)
 * - Teams tab (placeholder)
 * - Settings tab (placeholder)
 */

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
      {tab === 'teams' && <AccountTeams />}
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
  onChange: any; // keep lint happy (some configs flag unused param names in function types)
}) {
  const btn = (k: Tab, label: string) => (
    <button
      key={k}
      onClick={() => onChange(k)}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: value === k ? '#f3f4f6' : '#fff',
        fontWeight: 700,
        cursor: 'pointer',
        marginRight: 6,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ marginBottom: 10 }}>
      {btn('members', 'Members')}
      {btn('teams', 'Teams')}
      {btn('settings', 'Settings')}
    </div>
  );
}

/* ---------------- Teams (placeholder, no unused props) ---------------- */

function AccountTeams() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
        <strong>Teams</strong>
      </div>
      <div style={{ padding: 10 }}>
        <p style={{ opacity: 0.8 }}>Team management UI to be built here (create/delete teams).</p>
      </div>
    </div>
  );
}

/* ---------------- Settings (placeholder) ---------------- */

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
