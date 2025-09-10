-- =========================================================
-- Swap policy & approvals
-- - teams.swap_requires_approval boolean default false
-- - ensure teams.allow_swaps boolean default true
-- - respond_swap: if team requires approval, set status 'needs_approval'
--                 else auto-apply
-- - index for approvals queue
-- =========================================================

begin;

-- 1) Columns on teams
alter table public.teams
  add column if not exists allow_swaps boolean default true;

alter table public.teams
  add column if not exists swap_requires_approval boolean default false;

-- (optional) make them not null if you prefer hard guarantees:
-- alter table public.teams alter column allow_swaps set not null;
-- alter table public.teams alter column swap_requires_approval set not null;

comment on column public.teams.allow_swaps is 'When true, members can propose swaps.';
comment on column public.teams.swap_requires_approval is 'When true, accepted swaps require scheduler/admin approval (status=needs_approval) before apply.';

-- 2) Fast path for approvals queue
create index if not exists swap_requests_team_status_created_idx
  on public.swap_requests (team_id, status, created_at);

-- 3) respond_swap: accept/decline behavior with approvals
--    NOTE: Your original function signature appears as:
--      respond_swap(swap_request_id uuid, action text)
--    Keep the same signature & grants; rewrite body to add policy.
drop function if exists public.respond_swap(uuid, text);

create or replace function public.respond_swap(
  p_swap_request_id uuid,
  p_action text
)
returns public.swap_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req   public.swap_requests%rowtype;
  v_team  public.teams%rowtype;
  v_now   timestamptz := now();
begin
  if p_action not in ('accept','decline') then
    raise exception 'Invalid action (use accept|decline)';
  end if;

  -- Lock request row
  select * into v_req
  from public.swap_requests
  where id = p_swap_request_id
  for update;

  if not found then
    raise exception 'Swap request not found';
  end if;

  -- Only recipient can respond; RLS should also enforce, but double-check
  if auth.uid() is distinct from v_req.to_user_id then
    raise exception 'Only the recipient may respond to this swap';
  end if;

  -- Fetch team policy
  select * into v_team
  from public.teams
  where id = v_req.team_id
  for update;

  if not found then
    raise exception 'Team not found for swap request';
  end if;

  if coalesce(v_team.allow_swaps, true) is not true then
    raise exception 'Swaps are disabled for this team';
  end if;

  if p_action = 'decline' then
    update public.swap_requests
       set status = 'declined',
           responded_at = v_now
     where id = v_req.id;
    -- (optional) notify requester: swap_declined
    return (select * from public.swap_requests where id = v_req.id);
  end if;

  -- action = 'accept'
  -- If team requires approval, mark as needs_approval and stop here
  if coalesce(v_team.swap_requires_approval, false) then
    update public.swap_requests
       set status = 'needs_approval',
           responded_at = v_now
     where id = v_req.id;
    -- (optional) notify schedulers: swap_needs_approval
    return (select * from public.swap_requests where id = v_req.id);
  end if;

  -- Otherwise, auto-apply immediately
  -- Use your existing apply_swap to perform validation + atomic exchange
  perform public.apply_swap(v_req.id);

  return (select * from public.swap_requests where id = v_req.id);
end;
$$;

grant execute on function public.respond_swap(uuid, text) to authenticated;

comment on function public.respond_swap(uuid, text) is
'Recipient responds to a swap. If team.swap_requires_approval = true, accepted swaps go to status=needs_approval; otherwise auto-apply.';

commit;
