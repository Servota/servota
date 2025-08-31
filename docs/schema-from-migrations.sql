-- Core schema for Servota (Teams → Events with Requirements; swaps & replacements)
-- Safe to run on an empty project. RLS/policies come later.

-- Extensions we’ll use now (and soon for constraints)
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =========================
-- Enums
-- =========================
do $$ begin
  create type account_role as enum ('owner','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type team_role as enum ('scheduler','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type roster_visibility as enum ('team','account','private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type requirement_mode as enum ('ALL_OF','ANY_OF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_source as enum ('manual','replacement','swap','auto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type replacement_status as enum ('open','filled','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type swap_status as enum ('pending','accepted','declined','cancelled','expired','needs_approval','applied');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_status as enum ('scheduled','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status as enum ('active','invited','suspended');
exception when duplicate_object then null; end $$;

-- =========================
-- Tables
-- =========================

-- Accounts
create table if not exists public.accounts (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  status              text not null default 'active',
  plan                text,
  stripe_customer_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Profiles (one per auth user)
create table if not exists public.profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  default_account_id  uuid references public.accounts(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Account memberships
create table if not exists public.account_memberships (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        account_role not null,
  status      membership_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (account_id, user_id)
);

-- Teams
create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.accounts(id) on delete cascade,
  name              text not null,
  active            boolean not null default true,
  allow_swaps       boolean not null default true,
  roster_visibility roster_visibility not null default 'team',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (account_id, name)
);

-- Team memberships
create table if not exists public.team_memberships (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        team_role not null,
  status      membership_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (team_id, user_id)
);

-- Requirements (team-scoped tags that gate assignment)
create table if not exists public.requirements (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (account_id, team_id, name)
);

-- User ↔ Requirement
create table if not exists public.user_requirements (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  requirement_id  uuid not null references public.requirements(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (team_id, user_id, requirement_id)
);

-- Event templates (recurrence → generates events)
create table if not exists public.event_templates (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.accounts(id) on delete cascade,
  team_id           uuid not null references public.teams(id) on delete cascade,
  label             text not null,
  description       text,
  start_time        time not null,
  duration          interval not null,
  rrule             text, -- e.g., 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SU'
  capacity          integer not null default 1 check (capacity >= 0),
  requirement_mode  requirement_mode not null default 'ALL_OF',
  created_at        timestamptz not null default now()
);

-- Events (dated instances)
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references public.accounts(id) on delete cascade,
  team_id           uuid not null references public.teams(id) on delete cascade,
  template_id       uuid references public.event_templates(id) on delete set null,
  label             text not null,
  description       text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  capacity          integer not null default 1 check (capacity >= 0),
  requirement_mode  requirement_mode not null default 'ALL_OF',
  status            event_status not null default 'scheduled',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists events_team_starts_idx on public.events (team_id, starts_at);

-- Event ↔ Requirements
create table if not exists public.event_requirements (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  requirement_id  uuid not null references public.requirements(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (event_id, requirement_id)
);

-- Assignments (who is rostered)
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'confirmed',
  assigned_at   timestamptz not null default now(),
  source        assignment_source not null default 'manual',
  unique (event_id, user_id)
);
create index if not exists assignments_user_idx on public.assignments (user_id, event_id);

-- Unavailability (account-scoped)
create table if not exists public.unavailability (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists unavailability_user_idx on public.unavailability (account_id, user_id, starts_at);

-- Replacement requests (“Can’t make it”)
create table if not exists public.replacement_requests (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.accounts(id) on delete cascade,
  team_id             uuid not null references public.teams(id) on delete cascade,
  event_id            uuid not null references public.events(id) on delete cascade,
  requester_user_id   uuid not null references auth.users(id) on delete cascade,
  status              replacement_status not null default 'open',
  opened_at           timestamptz not null default now(),
  closed_at           timestamptz
);

-- Swap requests (peer-to-peer, same event)
create table if not exists public.swap_requests (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.accounts(id) on delete cascade,
  team_id             uuid not null references public.teams(id) on delete cascade,
  event_id            uuid not null references public.events(id) on delete cascade,
  from_assignment_id  uuid not null references public.assignments(id) on delete cascade,
  to_assignment_id    uuid not null references public.assignments(id) on delete cascade,
  from_user_id        uuid not null references auth.users(id) on delete cascade,
  to_user_id          uuid not null references auth.users(id) on delete cascade,
  status              swap_status not null default 'pending',
  message             text,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  responded_at        timestamptz,
  applied_at          timestamptz
);

-- Audit log
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  table_name  text not null,
  action      text not null,
  row_id      uuid,
  user_id     uuid references auth.users(id) on delete set null,
  at          timestamptz not null default now(),
  diff        jsonb
);

-- Helpful indexes
create index if not exists teams_account_idx on public.teams (account_id);
create index if not exists requirements_team_idx on public.requirements (team_id);
create index if not exists user_requirements_user_idx on public.user_requirements (team_id, user_id);
create index if not exists event_requirements_event_idx on public.event_requirements (event_id);
create index if not exists assignments_event_idx on public.assignments (event_id);
-- RLS helpers & policies for Servota (Accounts → Teams → Events + Requirements)
-- Keep policies simple; business rules (capacity/overlap/etc.) are enforced by UI/Functions.

-- ===========
-- Helper funcs
-- ===========
create or replace function public.is_account_member(aid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.account_memberships am
    where am.account_id = aid
      and am.user_id = auth.uid()
      and am.status = 'active'
  );
$$;

create or replace function public.is_account_admin(aid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.account_memberships am
    where am.account_id = aid
      and am.user_id = auth.uid()
      and am.role in ('owner','admin')
      and am.status = 'active'
  );
$$;

create or replace function public.is_team_scheduler(aid uuid, tid uuid)
returns boolean language sql stable as $$
  select public.is_account_admin(aid)
      or exists (
        select 1
        from public.team_memberships tm
        where tm.account_id = aid
          and tm.team_id = tid
          and tm.user_id = auth.uid()
          and tm.role = 'scheduler'
          and tm.status = 'active'
      );
$$;

create or replace function public.is_any_team_scheduler(aid uuid)
returns boolean language sql stable as $$
  select public.is_account_admin(aid)
      or exists (
        select 1
        from public.team_memberships tm
        where tm.account_id = aid
          and tm.user_id = auth.uid()
          and tm.role = 'scheduler'
          and tm.status = 'active'
      );
$$;

-- ===========
-- Enable RLS
-- ===========
alter table public.accounts               enable row level security;
alter table public.profiles               enable row level security;
alter table public.account_memberships    enable row level security;
alter table public.teams                  enable row level security;
alter table public.team_memberships       enable row level security;
alter table public.requirements           enable row level security;
alter table public.user_requirements      enable row level security;
alter table public.event_templates        enable row level security;
alter table public.events                 enable row level security;
alter table public.event_requirements     enable row level security;
alter table public.assignments            enable row level security;
alter table public.unavailability         enable row level security;
alter table public.replacement_requests   enable row level security;
alter table public.swap_requests          enable row level security;
alter table public.audit_log              enable row level security;

-- ===========
-- Policies
-- ===========

-- Accounts
create policy acc_sel on public.accounts
for select using (public.is_account_member(id));

-- Profiles (users read/update their own; admins can read)
create policy profiles_sel_self_or_admin on public.profiles
for select using (user_id = auth.uid() or public.is_account_admin(default_account_id));

create policy profiles_upd_self on public.profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Account memberships (user can see their row; admins see all; only admins modify)
create policy am_sel on public.account_memberships
for select using (user_id = auth.uid() or public.is_account_admin(account_id));

create policy am_all_admin on public.account_memberships
for all using (public.is_account_admin(account_id)) with check (public.is_account_admin(account_id));

-- Teams
create policy teams_sel on public.teams
for select using (public.is_account_member(account_id));

create policy teams_all_admin on public.teams
for all using (public.is_account_admin(account_id)) with check (public.is_account_admin(account_id));

-- Team memberships
create policy tm_sel on public.team_memberships
for select using (public.is_account_member(account_id));

create policy tm_all_sched_or_admin on public.team_memberships
for all using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- Requirements
create policy req_sel on public.requirements
for select using (public.is_account_member(account_id));

create policy req_all_sched_or_admin on public.requirements
for all using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- User requirements
create policy ur_sel on public.user_requirements
for select using (public.is_account_member(account_id));

create policy ur_ins_del_sched_or_admin on public.user_requirements
for insert with check (public.is_team_scheduler(account_id, team_id));
create policy ur_upd_sched_or_admin on public.user_requirements
for update using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));
create policy ur_del_sched_or_admin on public.user_requirements
for delete using (public.is_team_scheduler(account_id, team_id));

-- Event templates
create policy et_sel on public.event_templates
for select using (public.is_account_member(account_id));

create policy et_all_sched_or_admin on public.event_templates
for all using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- Events
create policy ev_sel on public.events
for select using (public.is_account_member(account_id));

create policy ev_all_sched_or_admin on public.events
for all using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- Event requirements
create policy er_sel on public.event_requirements
for select using (public.is_account_member(account_id));

create policy er_all_sched_or_admin on public.event_requirements
for all using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- Assignments
create policy asg_sel on public.assignments
for select using (public.is_account_member(account_id));

create policy asg_all_sched_or_admin on public.assignments
for all using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- Unavailability (account-scoped): user sees/edits own; schedulers/admins can read all
create policy una_sel_self_or_mgr on public.unavailability
for select using (user_id = auth.uid() or public.is_any_team_scheduler(account_id));

create policy una_ins_self on public.unavailability
for insert with check (user_id = auth.uid());

create policy una_upd_self on public.unavailability
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy una_del_self on public.unavailability
for delete using (user_id = auth.uid());

-- Replacement requests
create policy rr_sel on public.replacement_requests
for select using (public.is_account_member(account_id));

-- Only the assigned user can open a replacement request for their event
create policy rr_ins_assigned_user on public.replacement_requests
for insert with check (
  requester_user_id = auth.uid()
  and exists (
    select 1 from public.assignments a
    where a.account_id = replacement_requests.account_id
      and a.team_id    = replacement_requests.team_id
      and a.event_id   = replacement_requests.event_id
      and a.user_id    = auth.uid()
  )
);

-- Schedulers/admins can update/close/cancel
create policy rr_upd_mgr on public.replacement_requests
for update using (public.is_team_scheduler(account_id, team_id))
with check (public.is_team_scheduler(account_id, team_id));

-- Swap requests
-- Readable by involved users or schedulers/admins
create policy sw_sel_involved_or_mgr on public.swap_requests
for select using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.is_team_scheduler(account_id, team_id)
);

-- Only proposer may create
create policy sw_ins_from_user on public.swap_requests
for insert with check (from_user_id = auth.uid());

-- Updates by involved users or schedulers/admins (exact state checks handled in RPC)
create policy sw_upd_involved_or_mgr on public.swap_requests
for update using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.is_team_scheduler(account_id, team_id)
)
with check (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.is_team_scheduler(account_id, team_id)
);

-- Delete by involved users or schedulers/admins
create policy sw_del_involved_or_mgr on public.swap_requests
for delete using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or public.is_team_scheduler(account_id, team_id)
);

-- Audit log (admins only)
create policy audit_sel_admin on public.audit_log
for select using (public.is_account_admin(account_id));
-- Fix recursion: make SELECT on account_memberships not depend on is_account_admin

drop policy if exists am_sel on public.account_memberships;
drop policy if exists am_all_admin on public.account_memberships;

-- Allow users to SELECT only their own membership rows
create policy am_sel_self on public.account_memberships
for select
using (user_id = auth.uid());

-- Admin-only writes (these do NOT affect SELECT recursion)
create policy am_ins_admin on public.account_memberships
for insert
with check (public.is_account_admin(account_id));

create policy am_upd_admin on public.account_memberships
for update
using (public.is_account_admin(account_id))
with check (public.is_account_admin(account_id));

create policy am_del_admin on public.account_memberships
for delete
using (public.is_account_admin(account_id));
-- Add a read-only account role (separate migration so we don't use it in same TX)
do $$
begin
  alter type account_role add value if not exists 'viewer';
exception
  when duplicate_object then null;
end$$;
-- Demote demo.member@servota.test from admin/owner -> viewer (dev convenience)
update public.account_memberships am
set role = 'viewer'
where am.user_id = (select id from auth.users where email = 'demo.member@servota.test')
  and am.role in ('admin','owner');
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
-- PATCH: use single-arg advisory lock on replacement_request_id
create or replace function public.fn_claim_replacement(
  p_replacement_request_id uuid,
  p_claimant_user_id uuid default null
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
  perform pg_advisory_xact_lock(hashtextextended(p_replacement_request_id::text, 0));

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

  -- Must be an account + team member
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

grant execute on function public.fn_claim_replacement(uuid, uuid) to authenticated;
-- Notifications queue + push tokens (skeleton)
-- - Tables: push_tokens, notifications
-- - Enums: notification_channel, notification_status, push_token_status
-- - RLS: users can manage their own push tokens; users can read their own notifications
-- - RPCs: register_push_token(), enqueue_notification()
-- - View: v_notifications_pending
-- Delivery is handled by an Edge Function (service role), not by DB triggers.

create extension if not exists pgcrypto;

-- Enums (create only if missing)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum ('push','email');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type public.notification_status as enum ('queued','sending','sent','failed','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'push_token_status') then
    create type public.push_token_status as enum ('active','revoked');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- PUSH TOKENS (Expo etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,                -- e.g. ExponentPushToken[...]
  platform text,                      -- 'ios' | 'android' | 'web' | null
  device_info text,                   -- optional device string
  status public.push_token_status not null default 'active',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(token)
);

create index if not exists idx_push_tokens_user   on public.push_tokens(user_id);
create index if not exists idx_push_tokens_status on public.push_tokens(status);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can view own push tokens" on public.push_tokens;
create policy "Users can view own push tokens"
  on public.push_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can register push tokens" on public.push_tokens;
create policy "Users can register push tokens"
  on public.push_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
  on public.push_tokens
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
  on public.push_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Register/refresh a push token for the current user (idempotent by token)
drop function if exists public.register_push_token(text, text, text);
create or replace function public.register_push_token(
  p_token text,
  p_platform text default null,
  p_device_info text default null
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.push_tokens%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.push_tokens (token, user_id, platform, device_info, status, last_seen, updated_at)
  values (p_token, v_user, p_platform, p_device_info, 'active', now(), now())
  on conflict (token) do update
    set user_id     = excluded.user_id,
        platform    = coalesce(excluded.platform, public.push_tokens.platform),
        device_info = coalesce(excluded.device_info, public.push_tokens.device_info),
        status      = 'active',
        last_seen   = now(),
        updated_at  = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS QUEUE
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid null references public.accounts(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,                                 -- e.g. assignment_created, replacement_opened
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,            -- extra payload for clients
  channel public.notification_channel not null default 'push',
  status public.notification_status not null default 'queued',
  attempts int not null default 0,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz null,
  last_error text null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_status_sched on public.notifications (status, scheduled_at);
create index if not exists idx_notifications_user        on public.notifications (user_id, status);
create index if not exists idx_notifications_account     on public.notifications (account_id, team_id);

alter table public.notifications enable row level security;

-- Users can read their own notifications (queue is otherwise write-only via service role)
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

-- RPC to enqueue a notification (intended for service role / Edge Functions)
drop function if exists public.enqueue_notification(uuid, public.notification_channel, text, text, text, jsonb, uuid, uuid, timestamptz);
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_channel public.notification_channel,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_account_id uuid default null,
  p_team_id uuid default null,
  p_scheduled_at timestamptz default now()
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid := auth.uid();
  v_row public.notifications%rowtype;
begin
  if p_user_id is null then
    raise exception 'p_user_id required';
  end if;

  insert into public.notifications (
    account_id, team_id, user_id,
    type, title, body, data,
    channel, status, attempts, scheduled_at, created_by, created_at, updated_at
  ) values (
    p_account_id, p_team_id, p_user_id,
    p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb),
    p_channel, 'queued', 0, coalesce(p_scheduled_at, now()), v_creator, now(), now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- View for dispatchers (service role reads)
drop view if exists public.v_notifications_pending;
create view public.v_notifications_pending as
  select *
  from public.notifications
  where status = 'queued'
    and scheduled_at <= now();

comment on table public.notifications is 'Notification queue for push/email. Service role writes; users can read their own records.';
comment on table public.push_tokens  is 'Expo (and future) push tokens per user/device.';
-- Patch: fn_claim_replacement now enqueues notifications to claimant & requester
drop function if exists public.fn_claim_replacement(uuid, uuid);

create or replace function public.fn_claim_replacement(
  p_replacement_request_id uuid,
  p_claimant_user_id uuid default null
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
  perform pg_advisory_xact_lock(hashtextextended(p_replacement_request_id::text, 0));

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

  -- Must be an account + team member
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

  -- ------------------------------------------------------------------
  -- Notifications (best-effort; do not fail the claim if these error)
  -- ------------------------------------------------------------------
  begin
    perform public.enqueue_notification(
      v_claimant,
      'push',
      'replacement_claimed',
      coalesce(v_event.label, 'Replacement confirmed'),
      'You have been assigned via replacement.',
      jsonb_build_object('event_id', v_event.id, 'account_id', v_account, 'team_id', v_team),
      v_account,
      v_team
    );
  exception when others then
    -- ignore
  end;

  begin
    perform public.enqueue_notification(
      v_req.requester_user_id,
      'push',
      'replacement_filled',
      coalesce(v_event.label, 'Replacement filled'),
      'Your spot has been filled.',
      jsonb_build_object('event_id', v_event.id, 'account_id', v_account, 'team_id', v_team),
      v_account,
      v_team
    );
  exception when others then
    -- ignore
  end;

  return v_inserted;
end;
$$;

grant execute on function public.fn_claim_replacement(uuid, uuid) to authenticated;

comment on function public.fn_claim_replacement(uuid, uuid) is
  'Atomically claims an open replacement request; now also enqueues notifications for claimant and requester.';
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
-- Fix: apply_swap updates both assignment rows in a single statement to avoid unique (event_id, user_id) clashes
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

  -- sanity: both assignments same event/account/team and still point to expected users
  if a_from.event_id is distinct from a_to.event_id
     or a_from.event_id is distinct from sr.event_id
     or a_from.account_id is distinct from a_to.account_id
     or a_from.team_id is distinct from a_to.team_id then
    raise exception 'Assignments no longer match expected event/team' using errcode = 'P0001';
  end if;

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

  -- revalidate requirements (if any) for BOTH users
  select count(*) into req_count
  from public.event_requirements er
  where er.account_id = sr.account_id
    and er.team_id    = sr.team_id
    and er.event_id   = sr.event_id;

  if req_count > 0 then
    if ev.requirement_mode = 'ALL_OF' then
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

  -- Atomic swap: update both rows in a single statement (avoids unique (event_id,user_id) clashes)
  update public.assignments a
     set user_id    = case when a.id = sr.from_assignment_id then sr.to_user_id
                           when a.id = sr.to_assignment_id   then sr.from_user_id
                      end,
         source     = 'swap',
         assigned_at= v_now
   where a.id in (sr.from_assignment_id, sr.to_assignment_id);

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
-- Make assignments (event_id, user_id) uniqueness DEFERRABLE to allow atomic swaps
alter table public.assignments
  drop constraint if exists assignments_event_id_user_id_key;

alter table public.assignments
  add constraint assignments_event_id_user_id_key
  unique (event_id, user_id)
  deferrable initially deferred;
