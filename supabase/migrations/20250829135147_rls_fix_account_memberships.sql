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
