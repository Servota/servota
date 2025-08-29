-- Seed data for Servota DEV
-- Creates: 1 account, 2 teams, requirements, user requirements,
-- 2 upcoming events with requirements, 1 assignment, and a replacement request.

-- Emails created in Auth > Users:
--  - demo.scheduler@servota.test
--  - demo.member@servota.test

with
a as (
  insert into public.accounts (name) values ('Demo Church')
  returning id
),
t_main as (
  insert into public.teams (account_id, name) select id, 'Main Roster' from a
  returning id, account_id
),
t_youth as (
  insert into public.teams (account_id, name) select id, 'Youth' from a
  returning id, account_id
),
s_id as (
  select id as user_id from auth.users where email = 'demo.scheduler@servota.test'
),
m_id as (
  select id as user_id from auth.users where email = 'demo.member@servota.test'
),
am as (
  insert into public.account_memberships (account_id, user_id, role)
  select a.id, s_id.user_id, 'owner'::account_role from a, s_id
  union all
  select a.id, m_id.user_id, 'admin'::account_role from a, m_id
  returning account_id
),
tm as (
  insert into public.team_memberships (account_id, team_id, user_id, role)
  select a.id, t_main.id, s_id.user_id, 'scheduler'::team_role from a, t_main, s_id
  union all
  select a.id, t_main.id, m_id.user_id, 'member'::team_role from a, t_main, m_id
  union all
  select a.id, t_youth.id, s_id.user_id, 'scheduler'::team_role from a, t_youth, s_id
  union all
  select a.id, t_youth.id, m_id.user_id, 'member'::team_role from a, t_youth, m_id
  returning 1
),
req as (
  insert into public.requirements (account_id, team_id, name)
  select a.id, t_main.id, unnest(array['Communion Leader','WWCC']) from a join t_main on true
  union all
  select a.id, t_youth.id, unnest(array['WWCC','First Aid']) from a join t_youth on true
  returning id, team_id, name, account_id
),
ur as (
  insert into public.user_requirements (account_id, team_id, user_id, requirement_id)
  select r.account_id, r.team_id, s_id.user_id, r.id
  from req r, s_id
  where r.team_id = (select id from t_main) and r.name in ('Communion Leader','WWCC')
  union all
  select r.account_id, r.team_id, m_id.user_id, r.id
  from req r, m_id
  where r.team_id = (select id from t_youth) and r.name in ('WWCC')
  returning 1
),
e_main as (
  insert into public.events (account_id, team_id, label, description, starts_at, ends_at, capacity, requirement_mode)
  select a.id, t_main.id, 'Sunday Service', 'Main service', 
         date_trunc('day', now() + interval '3 days') + time '09:00',
         date_trunc('day', now() + interval '3 days') + time '11:00',
         3, 'ALL_OF'::requirement_mode
  from a, t_main
  returning id, account_id, team_id
),
e_youth as (
  insert into public.events (account_id, team_id, label, description, starts_at, ends_at, capacity, requirement_mode)
  select a.id, t_youth.id, 'Friday Youth', 'Youth group night',
         date_trunc('day', now() + interval '5 days') + time '18:00',
         date_trunc('day', now() + interval '5 days') + time '20:00',
         4, 'ANY_OF'::requirement_mode
  from a, t_youth
  returning id, account_id, team_id
),
er as (
  insert into public.event_requirements (account_id, team_id, event_id, requirement_id)
  select a.id, t_main.id, e_main.id, r.id
  from a, t_main, e_main, req r
  where r.team_id = t_main.id and r.name in ('Communion Leader','WWCC')
  union all
  select a.id, t_youth.id, e_youth.id, r.id
  from a, t_youth, e_youth, req r
  where r.team_id = t_youth.id and r.name = 'WWCC'
  returning 1
),
asg as (
  insert into public.assignments (account_id, team_id, event_id, user_id, source)
  select a.id, t_main.id, e_main.id, s_id.user_id, 'manual'::assignment_source
  from a, t_main, e_main, s_id
  returning id, account_id, team_id, event_id, user_id
)
insert into public.replacement_requests (account_id, team_id, event_id, requester_user_id)
select a.id, t_main.id, e_main.id, s_id.user_id from a, t_main, e_main, s_id;
