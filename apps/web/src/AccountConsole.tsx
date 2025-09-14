// apps/web/src/AccountConsole.tsx
import React, { useMemo, useState } from 'react';
import { getBrowserSupabaseClient, getContext } from '@servota/shared';
import AccountMembers from './AccountMembers';

/**
 * Manage Account console:
 * - Members: list account members, invite by email
 * - Teams: list teams, create/delete
 * - Settings: placeholder for future (plan, limits, suspension, etc.)
 */

type Tab = 'members' | 'teams' | 'settings';

export default function AccountConsole() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
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
      {tab === 'teams' && <AccountTeams accountId={accountId} supabase={supabase} />}
      {tab === 'settings' && <AccountSettings />}
    </section>
  );
}

/* ---------------- Tabs ---------------- */

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
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

/* ---------------- Teams ---------------- */

function AccountTeams({ accountId, supabase }: { accountId: string; supabase: any }) {
  // simplified placeholder
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10 }}>
      <strong>Teams</strong>
      <p style={{ marginTop: 8, opacity: 0.7 }}>
        Team management goes here (create, list, delete).
      </p>
    </div>
  );
}

/* ---------------- Settings ---------------- */

function AccountSettings() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10 }}>
      <strong>Settings</strong>
      <p style={{ marginTop: 8, opacity: 0.7 }}>
        Coming soon: plan, limits, suspension, billing links, etc.
      </p>
    </div>
  );
}
