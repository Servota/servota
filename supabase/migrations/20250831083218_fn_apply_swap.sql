-- Swap flow (part 3): apply_swap
-- Atomically exchange the users on the two assignments, with guardrails.
-- Permissions:
--   - Caller must be the from_user, to_user, a team scheduler, or an account owner/admin.
-- Preconditions:
--   - swap_requests.status = 'accepted'
--   - team.allow_swaps = true
--   - event is in the future
--   - assignments still exist and still point to the expected users
--   - BOTH users still satisfy event requirements and are not unavailable
-- Concurrency:
--   - pg_advisory_xact_lock on swap_requests.id
-- Effect:
--   - assignments[from].user_id <- to_user_id
--   - assignments[to].user_id   <- from_user_id
--   - swap_requests.status='applied', applied_at=now()
-- Notifications:
--   - best-effort 'swap_applied' to both users

create extension if not exists pgcrypto;

drop function if exists public.apply_swap(uuid);

create or replace function public.apply_swap(
  p_swap_request_id uuid
)
returns public.swap_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();

  sr   public.swap_requests%rowtype;
  ev   public.events%rowtype;
  a_from public.assignments%rowtype;
  a_to   public.assignments%rowtype;
  allow boolean;
  allowed boolean := false;
  req_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- single-request lock
  perform pg_advisory_xact_lock(hashtextextended(p_swap_request_id::text, 0));

  -- lock the swap request
  select * into sr
  from public.swap_requests
  where id = p_swap_request_id
  for update;

  if not found then
    raise exception 'Swap request not found' using errcode = 'P0001';
  end if;

  if sr.status <> 'accepted' then
    raise exception 'Swap request must be accepted before apply' using errcode = 'P0001';
  end if;

  -- caller permission: from_user, to_user, team scheduler, or account owner/admin
  if v_uid = sr.from_user_id or v_uid = sr.to_user_id then
    allowed := true;
  end if;

  if not allowed and exists (
    select 1 from public.team_memberships tm
    where tm.account_id = sr.account_id
      and tm.team_id    = sr.team_id
      and tm.user_id    = v_uid
      and tm.role       = 'scheduler'
      and (tm.status is null or tm.status = 'active')
  ) then
    allowed := true;
  end if;

  if not allowed and exists (
    select 1 from public.account_memberships am
    where am.account_id = sr.account_id
      and am.user_id    = v_uid
      and am.role in ('owner','admin')
      and (am.status is null or am.status = 'active')
  ) then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'You are not allowed to apply this swap' using errcode = 'P0001';
  end if;

  -- lock assignments
  select * into a_from from public.assignments where id = sr.from_assignment_id for update;
  if not found then
    raise exception 'From assignment not found' using errcode = 'P0001';
  end if;

  select * into a_to from public.assignments where id = sr.to_assignment_id for update;
  if not found then
    raise exception 'To assignment not found' using errcode = 'P0001';
  end if;

  -- sanity: both assignments same event/account/team
  if a_from.event_id is distinct from a_to.event_id
     or a_from.event_id is distinct from sr.event_id
     or a_from.account_id is distinct from a_to.account_id
     or a_from.team_id is distinct from a_to.team_id then
    raise exception 'Assignments no longer match expected event/team' using errcode = 'P0001';
  end if;

  -- ensure assignments still point to expected users
  if a_from.user_id is distinct from sr.from_user_id then
    raise exception 'From assignment has changed' using errcode = 'P0001';
  end if;
  if a_to.user_id is distinct from sr.to_user_id then
    raise exception 'To assignment has changed' using errcode = 'P0001';
  end if;

  -- fetch event and team policy
  select * into ev from public.events e where e.id = sr.event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  if ev.starts_at <= v_now then
    raise exception 'Cannot apply swaps for past/in-progress events' using errcode = 'P0001';
  end if;

  select t.allow_swaps into allow
  from public.teams t
  where t.id = sr.team_id and t.account_id = sr.account_id;

  if coalesce(allow,false) = false then
    raise exception 'Swaps are disabled for this team' using errcode = 'P0001';
  end if;

  -- revalidate requirements for BOTH users against this event
  select count(*) into req_count
  from public.event_requirements er
  where er.account_id = sr.account_id
    and er.team_id    = sr.team_id
    and er.event_id   = sr.event_id;

  if req_count > 0 then
    if ev.requirement_mode = 'ALL_OF' then
      -- both users must hold ALL
      if exists (
        select 1
        from public.event_requirements er
        left join public.user_requirements ur
          on ur.account_id = er.account_id
         and ur.team_id    = er.team_id
         and ur.requirement_id = er.requirement_id
         and ur.user_id    = sr.from_user_id
        where er.event_id = sr.event_id
          and ur.id is null
      ) then
        raise exception 'From user no longer satisfies requirements (ALL_OF)' using errcode = 'P0001';
      end if;
      if exists (
        select 1
        from public.event_requirements er
        left join public.user_requirements ur
          on ur.account_id = er.account_id
         and ur.team_id    = er.team_id
         and ur.requirement_id = er.requirement_id
         and ur.user_id    = sr.to_user_id
        where er.event_id = sr.event_id
          and ur.id is null
      ) then
        raise exception 'To user no longer satisfies requirements (ALL_OF)' using errcode = 'P0001';
      end if;
    else
      -- ANY_OF: both users must hold at least one
      if not exists (
        select 1
        from public.event_requirements er
        join public.user_requirements ur
          on ur.account_id = er.account_id
         and ur.team_id    = er.team_id
         and ur.requirement_id = er.requirement_id
         and ur.user_id    = sr.from_user_id
        where er.event_id = sr.event_id
      ) then
        raise exception 'From user no longer satisfies requirements (ANY_OF)' using errcode = 'P0001';
      end if;
      if not exists (
        select 1
        from public.event_requirements er
        join public.user_requirements ur
          on ur.account_id = er.account_id
         and ur.team_id    = er.team_id
         and ur.requirement_id = er.requirement_id
         and ur.user_id    = sr.to_user_id
        where er.event_id = sr.event_id
      ) then
        raise exception 'To user no longer satisfies requirements (ANY_OF)' using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- unavailability re-checks (defensive)
  if exists (
    select 1 from public.unavailability u
    where u.account_id = sr.account_id
      and u.user_id    = sr.from_user_id
      and tstzrange(u.starts_at, u.ends_at, '[)') && tstzrange(ev.starts_at, ev.ends_at, '[)')
  ) then
    raise exception 'From user is now unavailable for this event' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.unavailability u
    where u.account_id = sr.account_id
      and u.user_id    = sr.to_user_id
      and tstzrange(u.starts_at, u.ends_at, '[)') && tstzrange(ev.starts_at, ev.ends_at, '[)')
  ) then
    raise exception 'To user is now unavailable for this event' using errcode = 'P0001';
  end if;

  -- Perform the swap: exchange user_ids on the two assignment rows
  update public.assignments
     set user_id = sr.to_user_id, source = 'swap', assigned_at = v_now
   where id = a_from.id;

  update public.assignments
     set user_id = sr.from_user_id, source = 'swap', assigned_at = v_now
   where id = a_to.id;

  -- mark applied
  update public.swap_requests
     set status = 'applied',
         applied_at = v_now
   where id = sr.id
   returning * into sr;

  -- notify both users (best-effort)
  begin
    perform public.enqueue_notification(
      sr.from_user_id,
      'push',
      'swap_applied',
      coalesce(ev.label, 'Swap applied'),
      'Your swap has been applied.',
      jsonb_build_object('swap_request_id', sr.id, 'event_id', ev.id, 'account_id', sr.account_id, 'team_id', sr.team_id),
      sr.account_id,
      sr.team_id
    );
  exception when others then end;

  begin
    perform public.enqueue_notification(
      sr.to_user_id,
      'push',
      'swap_applied',
      coalesce(ev.label, 'Swap applied'),
      'Your swap has been applied.',
      jsonb_build_object('swap_request_id', sr.id, 'event_id', ev.id, 'account_id', sr.account_id, 'team_id', sr.team_id),
      sr.account_id,
      sr.team_id
    );
  exception when others then end;

  return sr;
end;
$$;

grant execute on function public.apply_swap(uuid) to authenticated;

comment on function public.apply_swap(uuid) is
  'Atomically exchanges users on two assignments for an accepted swap request; validates policy and guardrails; enqueues swap_applied notifications.';
