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
