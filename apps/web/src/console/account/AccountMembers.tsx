// apps/web/src/account/AccountMembers.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type AccountRole = 'owner' | 'admin' | 'viewer';
type MembershipStatus = 'active' | 'invited' | 'suspended';

export type AccountMembersProps = {
  accountId: string;
};

/**
 * Account Members tab
 * - Invite by email → always Viewer
 * - Per-row role dropdown (Viewer/Admin)
 * - Only Owner can change roles
 * - Owner rows are not editable; Owner role cannot be assigned via UI
 */
export default function AccountMembers({ accountId }: AccountMembersProps) {
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

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid #ddd',
    minWidth: 220,
  };
  const selectStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #ddd',
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
      // Everyone in this account (via SECURITY DEFINER RPC)
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

      // Find my role
      const me = (await supabase.auth.getUser()).data?.user?.id ?? '';
      const mine = rows.find(
        (m: { user_id: string; role: AccountRole | null }) => m.user_id === me
      );
      setMyRole(mine?.role ?? null);
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
      // Always create as Viewer (no role argument passed)
      const { error } = await (supabase as any).rpc('invite_account_member', {
        p_account_id: accountId,
        p_email: email,
      });
      if (error) throw error;
      setInviteEmail('');
      await load();
      alert('Invitation recorded as Viewer. (Email sending to be added later.)');
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
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
        <strong>Members</strong>
      </div>

      <div style={{ padding: 10 }}>
        {/* Invite (Viewer only) */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Invite member</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              placeholder="Email (existing user)"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.currentTarget.value)}
              style={inputStyle}
            />
            <button style={btnPrimary} onClick={invite} disabled={inviting}>
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Invites are created as <strong>Viewer</strong>. Role changes can be made below (Owner
            only). Owner cannot be changed.
          </div>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : err ? (
          <div style={{ color: '#b91c1c' }}>{err}</div>
        ) : members.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No members yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={thLeft}>Name</th>
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
                    <td style={tdLeft}>{label}</td>
                    <td style={td}>
                      {isOwner ? (
                        <span>owner</span>
                      ) : (
                        <select
                          value={m.role ?? 'viewer'}
                          onChange={(e) =>
                            changeRole(m.user_id, e.currentTarget.value as AccountRole)
                          }
                          style={selectStyle}
                          disabled={!canEdit}
                          title={!canEdit ? 'Owner only' : undefined}
                        >
                          {/* No "owner" option by design */}
                          <option value="viewer">viewer</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td style={td}>{m.status ?? '—'}</td>
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
