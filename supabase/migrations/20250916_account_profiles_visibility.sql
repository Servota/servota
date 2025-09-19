-- supabase/migrations/20250916_account_profiles_visibility.sql
begin;

create policy "account members can read account profiles (via memberships)"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.account_memberships am_self
    join public.account_memberships am_other
      on am_other.account_id = am_self.account_id
    where am_self.user_id = auth.uid()
      and am_other.user_id = profiles.user_id
  )
);

commit;
