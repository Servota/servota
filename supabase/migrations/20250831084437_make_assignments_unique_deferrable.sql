-- Make assignments (event_id, user_id) uniqueness DEFERRABLE to allow atomic swaps
alter table public.assignments
  drop constraint if exists assignments_event_id_user_id_key;

alter table public.assignments
  add constraint assignments_event_id_user_id_key
  unique (event_id, user_id)
  deferrable initially deferred;
