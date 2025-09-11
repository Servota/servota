// apps/web/src/TeamSettings.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient, requireTeamScope } from '@servota/shared';

type TeamRow = {
  id: string;
  allow_swaps: boolean | null;
  roster_visibility: 'team' | 'account' | 'private' | null;
  swap_requires_approval?: boolean | null; // optional until types regenerate
};

export default function TeamSettings({
  // NOTE: typed as any to avoid ESLint flagging parameter names in function types.
  onPolicyChange,
}: {
  onPolicyChange?: any;
}) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const { accountId, teamId } = requireTeamScope();

  const [row, setRow] = useState<TeamRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const emitPolicy = (r: TeamRow | null) => {
    if (!onPolicyChange || !r) return;
    // Safe call; caller receives { allowSwaps, requireApproval }
    onPolicyChange({
      allowSwaps: !!r.allow_swaps,
      requireApproval: !!(r as any).swap_requires_approval,
    });
  };

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select<any>('id, allow_swaps, roster_visibility, swap_requires_approval')
        .eq('account_id', accountId)
        .eq('id', teamId)
        .maybeSingle();

      if (error) throw error;
      const next = (data ?? null) as TeamRow | null;
      setRow(next);
      emitPolicy(next);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load team settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, teamId]);

  const upd = async (patch: Partial<TeamRow>) => {
    if (!row) return;
    const optimistic: TeamRow = { ...row, ...patch };
    setRow(optimistic);
    try {
      const { error } = await supabase.from('teams').update(patch as any).eq('id', row.id);
      if (error) {
        await load();
        if (String(error.message).includes('swap_requires_approval')) {
          alert(
            "Your database is missing teams.swap_requires_approval.\n\nRun:\n  alter table public.teams add column swap_requires_approval boolean default false;"
          );
        } else {
          alert(error.message);
        }
      } else {
        emitPolicy(optimistic);
      }
    } catch (e: any) {
      await load();
      alert(e?.message ?? 'Update failed');
    }
  };

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ marginTop: 0 }}>Team Settings</h2>
      {loading ? (
        <p>Loading…</p>
      ) : err ? (
        <p style={{ color: '#b91c1c' }}>{err}</p>
      ) : !row ? (
        <p>No team found.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          <SettingRow
            label="Allow swaps"
            hint="Let members propose swaps."
            control={
              <input
                type="checkbox"
                checked={!!row.allow_swaps}
                onChange={(e) => upd({ allow_swaps: e.currentTarget.checked })}
              />
            }
          />
          <SettingRow
            label="Require approval for swaps"
            hint="Accepted swaps wait for a scheduler/admin to approve in Approvals."
            control={
              <input
                type="checkbox"
                checked={!!(row as any).swap_requires_approval}
                onChange={(e) =>
                  upd({ swap_requires_approval: e.currentTarget.checked } as any)
                }
                disabled={!row.allow_swaps}
                title={!row.allow_swaps ? 'Enable Allow swaps first' : undefined}
              />
            }
          />
          <SettingRow
            label="Roster visibility"
            hint="Who can view the team roster."
            control={
              <select
                value={row.roster_visibility ?? 'team'}
                onChange={(e) =>
                  upd({
                    roster_visibility:
                      e.currentTarget.value as TeamRow['roster_visibility'],
                  })
                }
              >
                <option value="team">Team</option>
                <option value="account">Account</option>
                <option value="private">Private</option>
              </select>
            }
          />
        </div>
      )}
    </section>
  );
}

function SettingRow({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {hint ? <div style={{ fontSize: 12, opacity: 0.8 }}>{hint}</div> : null}
      </div>
      <div>{control}</div>
    </div>
  );
}
