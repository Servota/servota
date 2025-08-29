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
