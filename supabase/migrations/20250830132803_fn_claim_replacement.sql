-- fn_claim_replacement: first-come-first-served replacement claim
-- Preconditions:
-- - replacement_requests.status = 'open'
-- - Enforces: team membership, requirements (ALL_OF/ANY_OF), unavailability, overlap, already-assigned, capacity
-- Concurrency:
-- - Uses pg_advisory_xact_lock keyed by replacement_requests.id
-- Effect:
-- - Removes requester’s assignment if it still exists
-- - Inserts claimant assignment with source='replacement'
-- - Sets replacement_requests.status='filled', closed_at=now()
-- Return:
-- - The inserted assignments row

-- Safe to include; no-op if already present
create extension if not exists pgcrypto;

-- Helpful indexes (keep them light-weight)
create index if not exists idx_assignments_event_user on public.assignments (event_id, user_id);
create index if not exists idx_assignments_account_user on public.assignments (account_id, user_id);
create index if not exists idx_event_requirements_event on public.event_requirements (event_id);
create index if not exists idx_user_requirements_user on public.user_requirements (account_id, team_id, user_id, requirement_id);
create index if not exists idx_unavailability_user on public.unavailability (account_id, user_id);
create index if not exists idx_unavailability_range
  on public.unavailability
  using gist (tstzrange(starts_at, ends_at, '[)'));

drop function if exists public.fn_claim_replacement(uuid, uuid);
create or replace function public.fn_claim_replacement(
  p_replacement_request_id uuid,
  p_claimant_user_id uuid default null  -- optional; falls back to auth.uid()
)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimant uuid := coalesce(p_claimant_user_id, auth.uid());
  v_req      replacement_requests%rowtype;
  v_event    events%rowtype;
  v_account  uuid;
  v_team     uuid;
  v_req_count int;
  v_now timestamptz := now();
  v_inserted public.assignments%rowtype;
  v_assigned_count int;
begin
  if v_claimant is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Single-winner concurrency lock on this replacement request
  perform pg_advisory_xact_lock(
    hashtextextended(p_replacement_request_id::text, 0),
    hashtextextended(p_replacement_request_id::text, 1)
  );

  -- Lock and validate the replacement request
  select * into v_req
  from replacement_requests
  where id = p_replacement_request_id
  for update;

  if not found then
    raise exception 'Replacement request not found' using errcode = 'P0001';
  end if;

  if v_req.status is distinct from 'open' or v_req.closed_at is not null then
    raise exception 'Replacement request is closed' using errcode = 'P0001';
  end if;

  -- Lock the event row
  select * into v_event
  from events
  where id = v_req.event_id
  for update;

  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  v_account := v_event.account_id;
  v_team    := v_event.team_id;

  -- Must be an account + team member (active if you track status)
  if not exists (
    select 1 from account_memberships am
    where am.account_id = v_account
      and am.user_id    = v_claimant
      and (am.status is null or am.status = 'active')
  ) then
    raise exception 'You are not a member of this account' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from team_memberships tm
    where tm.account_id = v_account
      and tm.team_id    = v_team
      and tm.user_id    = v_claimant
      and (tm.status is null or tm.status = 'active')
  ) then
    raise exception 'You are not a member of this team' using errcode = 'P0001';
  end if;

  -- Requirements check (ALL_OF / ANY_OF). If no event requirements, pass.
  select count(*) into v_req_count
  from event_requirements er
  where er.account_id = v_account
    and er.team_id    = v_team
    and er.event_id   = v_event.id;

  if v_req_count > 0 then
    if v_event.requirement_mode = 'ALL_OF' then
      -- claimant must hold ALL
      if exists (
        select 1
        from event_requirements er
        left join user_requirements ur
          on ur.account_id = er.account_id
         and ur.team_id    = er.team_id
         and ur.requirement_id = er.requirement_id
         and ur.user_id    = v_claimant
        where er.event_id = v_event.id
          and ur.id is null
      ) then
        raise exception 'Requirements not satisfied (ALL_OF)' using errcode = 'P0001';
      end if;
    else
      -- ANY_OF: claimant must hold at least one
      if not exists (
        select 1
        from event_requirements er
        join user_requirements ur
          on ur.account_id = er.account_id
         and ur.team_id    = er.team_id
         and ur.requirement_id = er.requirement_id
         and ur.user_id    = v_claimant
        where er.event_id = v_event.id
      ) then
        raise exception 'Requirements not satisfied (ANY_OF)' using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Unavailability overlap (account-scoped)
  if exists (
    select 1
    from unavailability u
    where u.account_id = v_account
      and u.user_id    = v_claimant
      and tstzrange(u.starts_at, u.ends_at, '[)') && tstzrange(v_event.starts_at, v_event.ends_at, '[)')
  ) then
    raise exception 'You are unavailable during this event' using errcode = 'P0001';
  end if;

  -- Already assigned to this event
  if exists (
    select 1 from assignments a
    where a.account_id = v_account
      and a.team_id    = v_team
      and a.event_id   = v_event.id
      and a.user_id    = v_claimant
  ) then
    raise exception 'You are already assigned to this event' using errcode = 'P0001';
  end if;

  -- Overlap with another assignment (account-wide)
  if exists (
    select 1
    from assignments a
    join events e2 on e2.id = a.event_id
    where a.account_id = v_account
      and a.user_id    = v_claimant
      and tstzrange(e2.starts_at, e2.ends_at, '[)') && tstzrange(v_event.starts_at, v_event.ends_at, '[)')
  ) then
    raise exception 'This overlaps another assignment of yours' using errcode = 'P0001';
  end if;

  -- Remove requester’s assignment if it still exists (idempotent)
  delete from assignments a
   where a.account_id = v_account
     and a.team_id    = v_team
     and a.event_id   = v_event.id
     and a.user_id    = v_req.requester_user_id;

  -- Capacity check after potential removal
  select count(*) into v_assigned_count
  from assignments a
  where a.event_id = v_event.id;

  if v_assigned_count >= coalesce(v_event.capacity, 999999) then
    raise exception 'Event capacity is already full' using errcode = 'P0001';
  end if;

  -- Insert claimant assignment
  insert into assignments (id, account_id, team_id, event_id, user_id, status, assigned_at, source)
  values (gen_random_uuid(), v_account, v_team, v_event.id, v_claimant, 'confirmed', v_now, 'replacement')
  returning * into v_inserted;

  -- Close the replacement request
  update replacement_requests
     set status   = 'filled',
         closed_at = v_now
   where id = v_req.id;

  return v_inserted;
end;
$$;

-- Allow logged-in users to call the function (the function enforces its own checks)
grant execute on function public.fn_claim_replacement(uuid, uuid) to authenticated;

comment on function public.fn_claim_replacement(uuid, uuid) is
  'Atomically claims an open replacement request for the current user (or explicit user), with requirement/availability/overlap checks, capacity guard, and advisory lock.';
