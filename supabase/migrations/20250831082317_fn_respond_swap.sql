-- Swap flow (part 2): respond_swap
-- Recipient (to_user) accepts or declines a pending swap.
-- Notes:
-- - Only the recipient may respond.
-- - Event must still be in the future; team must still allow swaps.
-- - If expired, mark as 'expired' and error.
-- - On accept -> status = 'accepted' (apply happens in a later step).
-- - On decline -> status = 'declined'.
-- - Best-effort notifications to requester.

create extension if not exists pgcrypto;

drop function if exists public.respond_swap(uuid, text);

create or replace function public.respond_swap(
  p_swap_request_id uuid,
  p_action text  -- 'accept' | 'decline'
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
  allow boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_action not in ('accept','decline') then
    raise exception 'Invalid action: % (use accept|decline)', p_action using errcode = 'P0001';
  end if;

  -- serialize by request id to prevent double-responses
  perform pg_advisory_xact_lock(hashtextextended(p_swap_request_id::text, 0));

  -- lock the swap request
  select * into sr
  from public.swap_requests
  where id = p_swap_request_id
  for update;

  if not found then
    raise exception 'Swap request not found' using errcode = 'P0001';
  end if;

  if sr.status <> 'pending' then
    raise exception 'Swap request is not pending' using errcode = 'P0001';
  end if;

  -- only the recipient can respond
  if sr.to_user_id is distinct from v_uid then
    raise exception 'Only the recipient can respond to this swap' using errcode = 'P0001';
  end if;

  -- fetch event & team policy; ensure still valid
  select * into ev from public.events e where e.id = sr.event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  if ev.starts_at <= v_now then
    raise exception 'Cannot respond to swaps for past/in-progress events' using errcode = 'P0001';
  end if;

  select t.allow_swaps into allow
  from public.teams t
  where t.id = sr.team_id and t.account_id = sr.account_id;

  if coalesce(allow, false) = false then
    raise exception 'Swaps are disabled for this team' using errcode = 'P0001';
  end if;

  -- expiry check
  if sr.expires_at is not null and sr.expires_at <= v_now then
    update public.swap_requests
       set status = 'expired',
           responded_at = v_now
     where id = sr.id;
    raise exception 'Swap request has expired' using errcode = 'P0001';
  end if;

  if p_action = 'accept' then
    update public.swap_requests
       set status = 'accepted',
           responded_at = v_now
     where id = sr.id
     returning * into sr;

    -- notify requester (best-effort)
    begin
      perform public.enqueue_notification(
        sr.from_user_id,
        'push',
        'swap_accepted',
        coalesce(ev.label, 'Swap accepted'),
        'Your swap request was accepted.',
        jsonb_build_object('swap_request_id', sr.id, 'event_id', ev.id, 'account_id', sr.account_id, 'team_id', sr.team_id),
        sr.account_id,
        sr.team_id
      );
    exception when others then
      -- ignore
    end;

  else
    -- decline
    update public.swap_requests
       set status = 'declined',
           responded_at = v_now
     where id = sr.id
     returning * into sr;

    -- notify requester (best-effort)
    begin
      perform public.enqueue_notification(
        sr.from_user_id,
        'push',
        'swap_declined',
        coalesce(ev.label, 'Swap declined'),
        'Your swap request was declined.',
        jsonb_build_object('swap_request_id', sr.id, 'event_id', ev.id, 'account_id', sr.account_id, 'team_id', sr.team_id),
        sr.account_id,
        sr.team_id
      );
    exception when others then
      -- ignore
    end;
  end if;

  return sr;
end;
$$;

grant execute on function public.respond_swap(uuid, text) to authenticated;

comment on function public.respond_swap(uuid, text) is
  'Recipient responds to a pending swap: accept -> status=accepted; decline -> status=declined; enqueues notifications. Apply happens in a later step.';
