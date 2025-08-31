-- Swap flow (part 1): propose_swap
-- Creates a pending swap request between two assignments on the SAME event.
-- Guardrails:
-- - Auth user must be the from-assignment's user
-- - Event is in the future
-- - Team.allow_swaps = true
-- - Both assignments exist and belong to the same event/account/team
-- - No duplicate pending swap between the same pair (either direction)
-- Notes:
-- - Accept / Apply come in later steps
-- - Best-effort enqueue of a 'swap_requested' notification to the recipient

create extension if not exists pgcrypto;

-- helpful indexes
create index if not exists idx_swap_requests_event_status on public.swap_requests (event_id, status);
create index if not exists idx_swap_requests_users_status on public.swap_requests (from_user_id, to_user_id, status);

drop function if exists public.propose_swap(uuid, uuid, text);

create or replace function public.propose_swap(
  p_from_assignment_id uuid,
  p_to_assignment_id uuid,
  p_message text default null
)
returns public.swap_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  a_from public.assignments%rowtype;
  a_to   public.assignments%rowtype;
  ev     public.events%rowtype;
  allow  boolean;
  v_now  timestamptz := now();
  v_row  public.swap_requests%rowtype;
begin
  if v_requester is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- lock assignments
  select * into a_from from public.assignments where id = p_from_assignment_id for update;
  if not found then
    raise exception 'from_assignment not found' using errcode = 'P0001';
  end if;

  select * into a_to from public.assignments where id = p_to_assignment_id for update;
  if not found then
    raise exception 'to_assignment not found' using errcode = 'P0001';
  end if;

  -- same event & tenant
  if a_from.event_id is distinct from a_to.event_id then
    raise exception 'Assignments must be on the same event' using errcode = 'P0001';
  end if;
  if a_from.account_id is distinct from a_to.account_id
     or a_from.team_id is distinct from a_to.team_id then
    raise exception 'Assignments must belong to the same account/team' using errcode = 'P0001';
  end if;

  -- requester must be the from user
  if a_from.user_id is distinct from v_requester then
    raise exception 'Only the assigned user may propose this swap' using errcode = 'P0001';
  end if;

  -- cannot request swap with self
  if a_from.user_id = a_to.user_id then
    raise exception 'Cannot swap with yourself' using errcode = 'P0001';
  end if;

  -- team must allow swaps
  select t.allow_swaps into allow from public.teams t
  where t.id = a_from.team_id and t.account_id = a_from.account_id;
  if coalesce(allow, false) = false then
    raise exception 'Swaps are disabled for this team' using errcode = 'P0001';
  end if;

  -- event must be in the future
  select * into ev from public.events e where e.id = a_from.event_id for update;
  if ev.starts_at <= v_now then
    raise exception 'Cannot swap past or in-progress events' using errcode = 'P0001';
  end if;

  -- prevent duplicate pending swap between this pair (either direction)
  if exists (
    select 1 from public.swap_requests sr
    where sr.event_id = ev.id
      and sr.status   = 'pending'
      and (
        (sr.from_assignment_id = a_from.id and sr.to_assignment_id = a_to.id) or
        (sr.from_assignment_id = a_to.id   and sr.to_assignment_id = a_from.id)
      )
  ) then
    raise exception 'A pending swap already exists between these assignments' using errcode = 'P0001';
  end if;

  -- create the pending request (48h default expiry)
  insert into public.swap_requests (
    id, account_id, team_id, event_id,
    from_assignment_id, to_assignment_id,
    from_user_id, to_user_id,
    status, message, expires_at, created_at
  ) values (
    gen_random_uuid(), a_from.account_id, a_from.team_id, a_from.event_id,
    a_from.id, a_to.id,
    a_from.user_id, a_to.user_id,
    'pending', p_message, v_now + interval '48 hours', v_now
  )
  returning * into v_row;

  -- best-effort notify recipient
  begin
    perform public.enqueue_notification(
      v_row.to_user_id,
      'push',
      'swap_requested',
      coalesce(ev.label, 'Swap requested'),
      'A teammate has requested a swap on this event.',
      jsonb_build_object('swap_request_id', v_row.id, 'event_id', ev.id, 'account_id', a_from.account_id, 'team_id', a_from.team_id),
      a_from.account_id,
      a_from.team_id
    );
  exception when others then
    -- ignore, do not fail proposal on notification error
  end;

  return v_row;
end;
$$;

grant execute on function public.propose_swap(uuid, uuid, text) to authenticated;
