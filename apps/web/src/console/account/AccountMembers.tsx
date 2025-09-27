// apps/web/src/console/account/AccountMembers.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type AccountRole = 'owner' | 'admin' | 'viewer';
type MembershipStatus = 'active' | 'invited' | 'suspended';

export default function AccountMembers({ accountId }: { accountId: string }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [members, setMembers] = useState<
    {
      user_id: string;
      display_name: string | null;
      full_name: string | null;
      phone: string | null;
      role: AccountRole | null;
      status: MembershipStatus | null;
    }[]
  >([]);

  const [myRole, setMyRole] = useState<AccountRole | null>(null);

  // Invite (always Viewer)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  /* ===== Styles to mirror mobile app ===== */
  const colors = {
    bg: '#fafafa',
    cardBg: '#fff',
    border: '#ececec',
    borderSoft: '#d1d5db',
    text: '#111',
    muted: '#6b7280',
    chipBg: '#f3f4f6',
    primary: '#111', // black buttons
    secondaryBg: '#eef1f5',
  };

  const card: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    background: colors.cardBg,
    overflow: 'hidden',
    boxShadow: '0 3px 6px rgba(0,0,0,0.06)', // subtle like mobile shadows
  };
  const header: React.CSSProperties = {
    padding: 12,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const title: React.CSSProperties = { fontWeight: 800, fontSize: 16, color: colors.text };
  const sub: React.CSSProperties = { fontSize: 12, color: colors.muted };
  const body: React.CSSProperties = { padding: 12, background: colors.cardBg };

  const input: React.CSSProperties = {
    padding: '12px',
    borderRadius: 12,
    border: `1px solid ${colors.borderSoft}`,
    minWidth: 260,
    background: '#fff',
    outline: 'none',
  };
  const select: React.CSSProperties = {
    padding: '10px 12px',
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
  const badge: React.CSSProperties = {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: colors.chipBg,
    color: colors.text,
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
      const { data, error } = await (supabase as any).rpc('get_account_members', {
        p_account_id: accountId,
      });
      if (error) throw error;

      const rows =
        (data ?? []).map((r: any) => ({
          user_id: r.user_id as string,
          display_name: (r.display_name as string) ?? null,
          full_name: (r.full_name as string) ?? null,
          phone: (r.phone as string) ?? null,
          role: (r.role as AccountRole) ?? null,
          status: (r.status as MembershipStatus) ?? null,
        })) ?? [];

      setMembers(rows);

      const me = (await supabase.auth.getUser()).data?.user?.id ?? '';
      const mine = rows.find((m: { user_id: string }) => m.user_id === me);
      setMyRole((mine?.role as AccountRole | null) ?? null);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email) return alert('Enter an email.');
    setInviting(true);
    try {
      const { error } = await (supabase as any).rpc('invite_account_member', {
        p_account_id: accountId,
        p_email: email,
      });
      if (error) throw error;
      setInviteEmail('');
      await load();
      alert('Invitation recorded as Viewer. Email sending will be added later.');
    } catch (e: any) {
      alert(e?.message ?? 'Could not invite member');
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (userId: string, next: AccountRole) => {
    try {
      const { error } = await (supabase as any).rpc('change_account_member_role', {
        p_account_id: accountId,
        p_user_id: userId,
        p_new_role: next,
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Could not change role');
    }
  };

  const canEdit = myRole === 'owner';

  return (
    <div style={card}>
      <div style={header}>
        <div style={title}>Members</div>
        <div style={sub}>Owner can change roles. Owner role is fixed.</div>
      </div>

      {/* Invite */}
      <div style={{ ...body, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontWeight: 800, marginBottom: 8, color: colors.text }}>Invite member</div>
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
            placeholder="Email (existing user)"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.currentTarget.value)}
            style={input}
          />
          <button
            style={{ ...btnPrimary, opacity: inviting ? 0.6 : 1 }}
            onClick={invite}
            disabled={inviting}
          >
            {inviting ? 'Inviting…' : 'Invite'}
          </button>
        </div>
        <div style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
          Invites are created as <strong>Viewer</strong>. Role changes below (Owner only).
        </div>
      </div>

      {/* Members list */}
      <div style={body}>
        {loading ? (
          <div style={{ color: colors.muted }}>Loading…</div>
        ) : err ? (
          <div style={{ color: '#b91c1c' }}>{err}</div>
        ) : members.length === 0 ? (
          <div style={{ color: colors.muted }}>No members yet.</div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Role</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const label = m.display_name ?? m.full_name ?? m.user_id;
                  const isOwner = m.role === 'owner';
                  return (
                    <tr key={m.user_id}>
                      <td style={td}>{label}</td>
                      <td style={td}>
                        {isOwner ? (
                          <span style={badge}>owner</span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={m.role ?? 'viewer'}
                              onChange={(e) =>
                                changeRole(m.user_id, e.currentTarget.value as AccountRole)
                              }
                              style={select}
                              disabled={!canEdit}
                              title={!canEdit ? 'Owner only' : undefined}
                            >
                              <option value="viewer">viewer</option>
                              <option value="admin">admin</option>
                            </select>
                            <span style={badge}>{m.role ?? 'viewer'}</span>
                          </div>
                        )}
                      </td>
                      <td style={td}>{m.status ?? '—'}</td>
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
