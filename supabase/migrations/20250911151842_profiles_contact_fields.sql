-- Profile contact fields (idempotent)

alter table public.profiles
  add column if not exists display_name text;

alter table public.profiles
  add column if not exists phone text;

-- Optional: only if you want email available in profiles
alter table public.profiles
  add column if not exists email text;

-- Backfill display_name from full_name so we have a friendly label now
update public.profiles
set display_name = coalesce(display_name, full_name)
where display_name is null;

-- Refresh PostgREST cache so columns are visible immediately
select pg_notify('pgrst', 'reload schema');
