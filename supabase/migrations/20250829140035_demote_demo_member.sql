-- Demote demo.member@servota.test from admin/owner -> viewer (dev convenience)
update public.account_memberships am
set role = 'viewer'
where am.user_id = (select id from auth.users where email = 'demo.member@servota.test')
  and am.role in ('admin','owner');
