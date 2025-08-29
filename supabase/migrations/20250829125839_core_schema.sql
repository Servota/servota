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
