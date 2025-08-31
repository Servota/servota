// packages/shared/src/context.ts
// Minimal, dependency-free context for current account/team.
// Used by web & mobile to pass scope into queries/RPCs without new libs.

export type ServotaContext = {
  accountId: string | null;
  teamId: string | null;
};

// module-level state (safe for both web & mobile runtimes)
const _ctx: ServotaContext = {
  accountId: null,
  teamId: null,
};

/** Shallow set for account/team IDs. Pass only the fields you want to set. */
export function setContext(partial: Partial<ServotaContext>): void {
  if (partial.accountId !== undefined) {
    _ctx.accountId = partial.accountId || null;
  }
  if (partial.teamId !== undefined) {
    _ctx.teamId = partial.teamId || null;
  }
}

/** Readonly copy of the current context (never return the live object). */
export function getContext(): Readonly<ServotaContext> {
  return { accountId: _ctx.accountId, teamId: _ctx.teamId };
}

/** Clear both account & team. */
export function clearContext(): void {
  _ctx.accountId = null;
  _ctx.teamId = null;
}

/** True if an accountId is present. */
export function hasAccountContext(): boolean {
  return !!_ctx.accountId;
}

/** Require an accountId or throw (useful in server calls). */
export function requireAccountId(): string {
  if (!_ctx.accountId) throw new Error('Servota context: accountId is not set');
  return _ctx.accountId;
}

/** Require both accountId & teamId or throw (useful in team-scoped actions). */
export function requireTeamScope(): { accountId: string; teamId: string } {
  if (!_ctx.accountId) throw new Error('Servota context: accountId is not set');
  if (!_ctx.teamId) throw new Error('Servota context: teamId is not set');
  return { accountId: _ctx.accountId, teamId: _ctx.teamId };
}
