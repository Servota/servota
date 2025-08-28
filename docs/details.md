# Scheduling & Rostering App (Details) — Servota

_Last updated: 28 Aug 2025_

## What it is

A simple, flexible scheduling tool for any group that needs a roster—churches, workplaces, clubs, families. Keep setup quick, rostering clear, and swaps painless. **Post-MVP (V1.1)** adds optional auto-scheduling with rules and availability using a **preview → apply → undo** flow.

## Who it’s for

- **Churches:** services, youth, music, hospitality
- **Workplaces & clubs:** shift rosters, duties, on-call coverage
- **Families:** recurring chores and tasks

## Core objects (Teams + Events + Requirements)

- **Account** — an organisation/tenant
- **Team** — a group inside an Account (e.g., Main Roster, Youth, Music)
- **User** — a person with a Supabase Auth identity
- **Account Membership** — links User ↔ Account with role: `owner`, `admin` (global admin)
- **Team Membership** — links User ↔ Team with role: `scheduler`, `member`
- **Requirement** — team-scoped tag used to gate assignment (e.g., “Communion Leader”, “WWCC”, “First Aid”)
- **Event Template** — recurrence config that generates dated **Events**
- **Event** — a scheduled thing to be staffed; has label, description, start/end, capacity; team-scoped
- **Event Requirements** — Requirements an Event needs (0, 1, or many) with a mode (`ALL_OF`/`ANY_OF`)
- **User Requirements** — Requirements a User holds in the Team
- **Assignment** — User ↔ Event link when rostered
- **Unavailability** — user blackout dates/times; account-scoped (blocks clashes across all Teams)
- **Replacement Request** — “I can’t make it” → opens a claimable spot in the Event
- **Swap Request** — propose exchanging assignments with another user on the **same Event**
- **(V1.1) Scheduling Rules** — JSON policy defaults at Account, with Team overrides
- **(V1.1) Recurring Availability (optional)** — weekly “OK to serve” windows (account-scoped)
- **(V1.1) User Limits** — per-user caps (max/week, max/month, min gap) (account-scoped)
- **(V1.1) Auto-schedule Run/Result** — team-scoped log of proposals, applied picks, and reasons

---

## MVP scope (v1)

### Accounts, teams & access

- Users sign up/log in (Supabase Auth)
- **Account Memberships:** `owner`, `admin` (global admin across all Teams)
- **Team Memberships:** `scheduler`, `member` (per Team)

### Events & recurrence (per Team)

- Create **Event Templates** (once-off / daily / weekly / fortnightly / monthly) with label, description, start/end, capacity
- Generate **Events** from templates; edit single Events as needed

### Requirements & assigning

- Define **Requirements** per Team (flexible: roles, skills, checks)
- Assign **Requirements to Users** (User Requirements)
- Add **Requirements to Events** (Event Requirements) with a mode:
  - `ALL_OF` (default) — user must have **all** listed requirements
  - `ANY_OF` — user must have **at least one**
- **Assignment rule:** a user can be assigned iff Event Requirements are satisfied **and** user is not unavailable, has no overlap, and capacity allows
- **Scheduler console:** team-scoped grid/calendar; **Assign** only lists matching users

### Unavailability & clashes

- Users record **Unavailability** (account-scoped); system blocks conflicting assignments across all Teams in the Account and prevents overlaps

### Replacement flow (per Team)

- Rostered user taps **“Can’t make it”**
- Notify Team Scheduler(s)
- Broadcast to **eligible & available Team members** (who satisfy Event Requirements and aren’t overlapping)
- First-come, first-served claim auto-assigns and confirms

### Peer-to-peer swaps (per Team)

- From team roster, a user selects another **assigned** person on the **same future Event** and **proposes a swap**
- Recipient Accept/Decline; optional Team policy may require scheduler approval before apply
- Applied swaps **atomically exchange `assignments.user_id`** on the two rows

### Notifications (initial)

- **Triggers:** assignment created/changed, upcoming reminders (e.g., 24–48h), replacement offers/claims, swap requested/accepted/declined/cancelled/expired/approved/applied
- **Channels:** push/email in v1 (SMS optional later)

---

## Auto-scheduling (V1.1, per Team)

**What:** One-click **Preview → Apply → Undo** that assigns Events over a date range for a **Team**, using rules (fairness, caps, min gap) and the **Requirements** filter.  
**Why:** Save scheduler hours while staying fair and avoiding conflicts.  
**How (quick rules):**

- Candidates per Event = users who **satisfy Event Requirements** ∩ **not unavailable** ∩ **no overlap** ∩ **respects min_gap**
- **Scoring:** favour people with fewer recent assignments; reject if weekly/monthly caps exceeded; prefer even rotation
- **Apply:** transactional inserts to `assignments`, capacity-safe; **Undo:** remove only what this run added
- **Audit:** store proposals, picks, and “why” in run/results tables

UI: in the **team roster console**, pick date range + requirement mode/rule set → **Preview** → **Apply** → optional **Undo last run**.

---

## Architecture

- **Mobile:** Expo (iOS/Android)
- **Web/Desktop:** **React PWA (Vite)**, installable; **packaged for Microsoft Store (Windows)** via PWABuilder → MSIX  
  Auto-updates from web deploys; offline shell for core views; supports Windows notifications via Web Push
- **Backend/Data:** Supabase (Postgres) with Row Level Security (RLS)
- **Server logic:** Supabase Edge Functions for webhooks, notifications, RRULE expansions, race-safe replacement/swap operations, and **(V1.1) auto-scheduler** (team-scoped)
- **Subscriptions:** Stripe/Paddle → webhook → update `accounts.status`

### Monorepo (high level)

/apps/mobile — Expo app  
/apps/web — React PWA (Microsoft Store-listed)  
/packages/ui — shared UI  
/packages/shared — shared types/utils/Supabase client  
/packages/config — tsconfig/eslint/prettier (optional)  
/supabase — migrations, seeds, policies, functions

---

## Data model (Accounts with Teams; Events + Requirements)

**MVP tables**

- accounts(id, name, status, plan, stripe_customer_id, created_at)
- profiles(user_id PK → auth.users.id, full_name, default_account_id)
- **account_memberships**(id, account_id, user_id, role ENUM('owner','admin'), status ENUM('active','invited','suspended'))
- **teams**(id, account_id, name, active, **allow_swaps boolean default true**, **roster_visibility ENUM('team','account','private') default 'team'**, UNIQUE(account_id, name))
- **team_memberships**(id, account_id, team_id, user_id, role ENUM('scheduler','member'), status)
- **requirements**(id, account_id, team_id, name, active, UNIQUE(account_id, team_id, name))
- **user_requirements**(id, account_id, team_id, user_id, requirement_id)
- **event_templates**(id, account_id, team_id, label, description, start_time, duration, rrule, capacity, requirement_mode ENUM('ALL_OF','ANY_OF') DEFAULT 'ALL_OF')
- **events**(id, account_id, team_id, template_id NULLABLE, label, description, starts_at, ends_at, capacity, requirement_mode ENUM('ALL_OF','ANY_OF') DEFAULT 'ALL_OF', status)
- **event_requirements**(id, account_id, team_id, event_id, requirement_id)
- **assignments**(id, account_id, team_id, event_id, user_id, status, assigned_at, source ENUM('manual','replacement','swap','auto'))
- **unavailability**(id, account_id, user_id, starts_at, ends_at, reason) — account-scoped
- **replacement_requests**(id, account_id, team_id, event_id, requester_user_id, opened_at, closed_at, status)
- **swap_requests**(id, account_id, team_id, event_id, from_assignment_id, to_assignment_id, from_user_id, to_user_id, status ENUM('pending','accepted','declined','cancelled','expired','needs_approval','applied'), message, expires_at, created_at, responded_at, applied_at)
- **audit_log**(id, account_id, team_id NULLABLE, table_name, action, row_id, user_id, at, diff)

**V1.1 auto-scheduling tables**

- **scheduling_rules**(id, account_id, team_id NULLABLE, name, params JSONB, active) — account default; team overrides
- **recurring_availability**(id, account_id, user_id, weekday, start_local, end_local, timezone)
- **user_limits**(id, account_id, user_id, max_per_week, max_per_month, min_gap_hours)
- **autoschedule_runs**(id, account_id, team_id, started_by, range_from, range_to, params JSONB, status, stats JSONB)
- **autoschedule_results**(id, run_id, event_id, user_id, reason, status)

**Keys/Indexes:** UUID PKs; `created_at/updated_at` everywhere; indexes on `(account_id, fk)` and `(account_id, team_id, fk)`; uniques on `(account_id, team name)` and `(account_id, team_id, requirement name)`.

---

## Security & data handling

- **RLS everywhere.** Each row carries `account_id` (and most roster rows carry `team_id`). Policies gate reads/writes by the user’s **account_membership** and, for team-scoped writes, by **team_membership**.
- **Write roles.** Only `owner`/`admin` (account) or `scheduler` (team) can create/update roster data in that scope.
- **Swap permissions.** A user may create/read a `swap_request` if they are the **from_user**, **to_user**, a **team scheduler**, or **account admin**. Applying a swap is only via a secure RPC/Edge Function that validates team policy and guardrails.
- **No service key in clients.** Client apps use user JWTs only.
- **Audit trail.** Triggers write to `audit_log` for inserts/updates/deletes.
- **(V1.1)** Auto-schedule runs/results are readable by members; **apply/undo** limited to account `owner/admin` or team `scheduler`.

**Account suspension (subscriptions):**  
On failed payment, set `accounts.status='suspended'`. RLS denies all access so data appears gone but is preserved. Offer a retention window (e.g., 90 days), then hard-delete with `ON DELETE CASCADE` or a scheduled function.

---

## Concurrency & fairness (baseline + V1.1)

- **Requirement match:** Event Requirements must be satisfied by User Requirements (per mode) for every assignment path
- **Overlap guard:** exclusion constraint prevents overlapping **confirmed** assignments per user **within an Account** (across all Teams)
- **Capacity guard:** replacement/assign/apply steps run capacity-safe transactions
- **Swap safety:** swaps exchange users on two assignment rows in one transaction; re-validate requirements, availability, overlap; optionally require scheduler approval
- **(V1.1) Auto-scheduler:** filters by Requirements, unavailability, overlap, and **min_gap_hours**; scoring prefers even rotation and respects **max_per_week/month**; **Apply** uses an advisory lock per `(account_id, team_id)`; **Undo** removes only what that run added

---

## UX snapshot

- **Switchers:** Account switcher → Team switcher (within the Account)
- **Scheduler console (Team):** manage Requirements, Event Templates → generate Events → assign (filtered by Requirements) → replacements → **swap approvals** (if required)  
  **(V1.1)** Auto-schedule: Preview → Apply → Undo
- **Member:** My Roster, mark Unavailability, request replacements, propose/accept swaps; filter by All, Account, or Team

---

## Non-functional notes

- Time zones per user; all dates stored as UTC (RRULE expansion uses a chosen local zone then converts to UTC)
- Separate Supabase projects for dev/staging/prod
- Push tokens stored per user (Expo); notifications sent from Edge Functions
- **PWA:** installable on Windows, macOS, and supported browsers; offline shell for read views; Microsoft Store distribution via MSIX; auto-updates on deploy
- **Autoschedule apply:** use Postgres advisory locks per Team
- **Swap expiry:** `swap_requests.expires_at` can auto-expire pending swaps via a scheduled task (later)

---

## Bottom line

Accepted plan: multi-tenant Supabase with **Accounts → Teams → Events**, flexible **Requirements** gating assignment, strict RLS, **Expo mobile + React PWA (Store-listed)**, Edge Functions for server tasks. Start simple: define Requirements → create Event Templates → generate Events → Assign → Replacements → **Peer Swaps**. Then add **Auto-scheduling (V1.1)** per Team for fast, fair assignment.

---

## Subscription tier idea (subject to change)

| Tier             | Who it’s for               | Monthly | Active members (hard) | Teams (hard) | Notes                                                 |
| ---------------- | -------------------------- | ------: | --------------------: | -----------: | ----------------------------------------------------- |
| **Family**       | Households, small groups   |      $9 |                    10 |            2 | Schedulers not capped; assign within team caps        |
| **Community**    | Typical churches/clubs     |     $49 |                   100 |           10 | Fits “50 volunteers” with multiple Teams              |
| **Organisation** | Larger churches/businesses |     $99 |                   250 |           25 | Priority support later; exports/integrations unlocked |
