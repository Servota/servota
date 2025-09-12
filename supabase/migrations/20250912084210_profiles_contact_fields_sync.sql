-- ================================================
-- Profiles contact fields + backfill + sync RPC
-- Idempotent and safe to re-run
-- ================================================

-- 1) Columns
alter table public.profiles
  add column if not exists display_name text;

alter table public.profiles
  add column if not exists phone text;

-- Optional: keep a copy of email in profiles so clients can show it safely
alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.display_name is 'Preferred display name (shown in UI)';
comment on column public.profiles.phone        is 'Contact phone (mirrored from auth.users.phone)';
comment on column public.profiles.email        is 'Email (mirrored from auth.users.email for safe client display)';

-- 2) Backfill from auth.users (only when empty)
-- display_name fallback order: profiles.display_name -> profiles.full_name -> auth.users.raw_user_meta_data full_name/name -> auth.users.email
update public.profiles p
set display_name = coalesce(p.display_name, p.full_name, au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email)
from auth.users au
where au.id = p.user_id
  and (p.display_name is null or p.display_name = '');

-- phone (only when empty)
update public.profiles p
set phone = coalesce(p.phone, nullif(au.phone, ''))
from auth.users au
where au.id = p.user_id
  and (p.phone is null or p.phone = '');

-- email (only when empty)
update public.profiles p
set email = coalesce(p.email, au.email)
from auth.users au
where au.id = p.user_id
  and (p.email is null or p.email = '');

-- 3) RPC for clients: re-sync the current user’s profile from auth.users on sign-in
drop function if exists public.refresh_profile_from_auth();

create or replace function public.refresh_profile_from_auth()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles p
  set display_name = coalesce(p.display_name, p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
      phone        = coalesce(p.phone, nullif(u.phone,'')),
      email        = coalesce(p.email, u.email)
  from auth.users u
  where u.id = auth.uid()
    and p.user_id = u.id;
end;
$$;

grant execute on function public.refresh_profile_from_auth() to authenticated;

-- 4) Reload PostgREST schema cache so these columns are visible immediately
select pg_notify('pgrst', 'reload schema');
