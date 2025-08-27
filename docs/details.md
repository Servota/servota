# Scheduling & Rostering App (Details) — Servota

_Last updated: 27 Aug 2025_

## What it is

A simple, flexible scheduling tool for any group that needs a roster—churches, workplaces, clubs, families. Keep setup quick, rostering clear, and swaps painless. **Post-MVP (V1.1)** adds optional auto-scheduling with rules and availability using a **preview → apply → undo** flow.

## Who it’s for

- **Churches:** services, youth, music, hospitality
- **Workplaces & clubs:** shift rosters, duties, on-call coverage
- **Families:** recurring chores and tasks

## Core objects (with Teams)

- **Account** — an organisation/tenant
- **Team** — a group inside an Account (e.g., Main Roster, Youth, Music)
- **User** — a person with a Supabase Auth identity
- **Account Membership** — links User ↔ Account with role: `owner`, `admin` (global admin)
- **Team Membership** — links User ↔ Team with role: `scheduler`, `member`
- **Role** — what needs doing; **team-scoped** (e.g., “Devotion Leader” in Youth)
- **Schedule Template** — recurrence for a Role (once-off/weekly/monthly); **team-scoped**
- **Shift** — dated instance from a Schedule Template; has capacity; **team-scoped**
- **Eligibility** — who is allowed/willing/qualified for a Role; **team-scoped**
- **Assignment** — User ↔ Shift link when rostered; **team-scoped**
- **Unavailability** — user blackout dates/times; **account-scoped** (blocks clashes across all Teams in the Account)
- **Replacement Request** — a rostered user can’t attend; opens a claimable slot; **team-scoped**
- **(V1.1) Scheduling Rules** — JSON policy default at Account, with per-Team overrides
- **(V1.1) Recurring Availability (optional)** — weekly “OK to serve” windows (account-scoped)
- **(V1.1) User Limits** — per-user caps (max/week, max/month, min gap) (account-scoped)
- **(V1.1) Auto-schedule Run/Result** — **team-scoped** log of proposals, applied picks, and reasons

---

## MVP scope (v1)

### Accounts, teams & access

- Users sign up/log in (Supabase Auth)
- **Account Memberships:** `owner`, `admin` (global admin across all Teams)
- **Team Memberships:** `scheduler`, `member` (per Team)

### Roles & schedules (per Team)

- Create **Teams** inside an Account
- Within a Team: create **Roles** and **Schedule Templates** → system generates **Shifts**

### Eligibility & assigning (per Team)

- Mark **Eligibility** (User ↔ Role) within a Team
- Only eligible, available Users can be **Assigned** to Shifts
- **Scheduler console:** team-scoped grid/calendar with filters
- **My calendar:** see Assignments across all Teams/Accounts you belong to, with filters (All, by Account, by Team)

### Unavailability & clashes

- Users record **Unavailability** at the Account level; system blocks conflicting assignments **across all Teams** in that Account and prevents overlaps

### Smart replacement flow (per Team)

- Rostered user taps **“Can’t make it”**
- Notify Team Scheduler(s)
- Broadcast to **eligible, available Team members** not already rostered at that time
- First-come, first-served acceptance auto-assigns and confirms

### Notifications (initial)

- **Triggers:** assignment created/changed, upcoming reminders (e.g., 24–48h), replacement offers/claims
- **Channels:** push/email in v1 (SMS optional later)

---

## Auto-scheduling (V1.1, per Team)

**What:** One-click **Preview → Apply → Undo** that assigns shifts over a date range for a **Team**, using rules (fairness, caps, min gap) and availability.  
**Why:** Save scheduler hours while staying fair and avoiding conflicts.  
**How (quick rules):**

- Candidates per shift = **eligible ∩ not unavailable ∩ no overlap ∩ respects min_gap** (team context; overlap checked account-wide)
- **Scoring:** favour people with fewer recent assignments for that role/team; reject if weekly/monthly caps exceeded; prefer even rotation
- **Apply:** transactional inserts to `assignments`, capacity-safe; **Undo:** remove only what this run added
- **Audit:** store proposals, picks, and “why” in run/results tables

UI: in the **team roster console**, pick date range + roles + rule set → **Preview** (accept/skip per row) → **Apply** → optional **Undo last run**.

---

## Architecture

- **Mobile:** Expo (iOS/Android)
- **Web/Desktop:** **React PWA (Vite)**, installable; **packaged for Microsoft Store (Windows)** via PWABuilder → MSIX  
  Auto-updates from web deploys; offline shell for core views; supports Windows notifications via Web Push
- **Backend/Data:** Supabase (Postgres) with Row Level Security (RLS)
- **Server logic:** Supabase Edge Functions for webhooks, notifications, RRULE expansions, race-safe replacement claims, and **(V1.1) auto-scheduler** (team-scoped)
- **Subscriptions:** Stripe/Paddle → webhook → update `accounts.status`

### Monorepo (high level)

/apps/mobile — Expo app  
/apps/web — React PWA (Microsoft Store-listed)  
/packages/ui — shared UI  
/packages/shared — shared types/utils/Supabase client  
/packages/config — tsconfig/eslint/prettier (optional)  
/supabase — migrations, seeds, policies, functions

---

## Data model (Accounts with Teams; users can belong to many Accounts and Teams)

**MVP tables**

- accounts(id, name, status, plan, stripe_customer_id, created_at)
- profiles(user_id PK → auth.users.id, full_name, default_account_id)
- **account_memberships**(id, account_id, user_id, role ENUM('owner','admin'), status ENUM('active','invited','suspended'))
- **teams**(id, account_id, name, active, UNIQUE(account_id, name))
- **team_memberships**(id, account_id, team_id, user_id, role ENUM('scheduler','member'), status)
- **roles**(id, account_id, team_id, name, notes, active, UNIQUE(account_id, team_id, name))
- **eligibility**(id, account_id, team_id, user_id, role_id)
- **schedule_templates**(id, account_id, team_id, role_id, start_date, time, duration, rrule, capacity)
- **shifts**(id, account_id, team_id, role_id, starts_at, ends_at, capacity, status)
- **assignments**(id, account_id, team_id, shift_id, user_id, status, assigned_at, source)
- **unavailability**(id, account_id, user_id, starts_at, ends_at, reason) — account-scoped
- **replacement_requests**(id, account_id, team_id, shift_id, requester_user_id, opened_at, closed_at, status)
- **audit_log**(id, account_id, team_id NULLABLE, table_name, action, row_id, user_id, at, diff)

**V1.1 auto-scheduling tables**

- **scheduling_rules**(id, account_id, team_id NULLABLE, name, params JSONB, active) — account default; team overrides
- **scheduling_role_overrides**(id, account_id, team_id, role_id, params JSONB) — per-team/per-role tweaks
- **recurring_availability**(id, account_id, user_id, weekday, start_local, end_local, timezone) — optional weekly OK windows
- **user_limits**(id, account_id, user_id, max_per_week, max_per_month, min_gap_hours) — per-user caps
- **autoschedule_runs**(id, account_id, team_id, started_by, range_from, range_to, params JSONB, status, stats JSONB)
- **autoschedule_results**(id, run_id, shift_id, user_id, reason, status)

**Keys/Indexes:** UUID PKs; `created_at/updated_at` everywhere; indexes on `(account_id, fk)` and `(account_id, team_id, fk)`; uniques on `(account_id, team name)` and `(account_id, team_id, role name)`.

---

## Security & data handling

- **RLS everywhere.** Each row carries `account_id` (and most roster rows carry `team_id`). Policies gate reads/writes by the user’s **account_membership** and, for team-scoped writes, by **team_membership**.
- **Write roles.** Only `owner`/`admin` (account) or `scheduler` (team) can create/update roster data in that scope.
- **No service key in clients.** Client apps use user JWTs only.
- **Audit trail.** Triggers write to `audit_log` for inserts/updates/deletes.
- **(V1.1)** Auto-schedule runs/results are readable by members; **apply/undo** limited to account `owner/admin` or team `scheduler`.

**Account suspension (subscriptions):**  
On failed payment, set `accounts.status='suspended'`. RLS denies all access so data appears gone but is preserved. Offer a retention window (e.g., 90 days), then hard-delete with `ON DELETE CASCADE` or a scheduled function.

---

## Concurrency & fairness (baseline + V1.1)

- **Overlap guard:** exclusion constraint prevents overlapping **confirmed** assignments per user **within an Account** (across all Teams)
- **Capacity guard:** replacement claim/apply steps run capacity-safe transactions
- **Eligibility enforced** at read and write
- **(V1.1) Auto-scheduler:** candidates filtered by eligibility, unavailability, overlap, and **min_gap_hours**; scoring prefers even rotation and respects **max_per_week/month**. **Apply** uses a transaction + **advisory lock per `(account_id, team_id)`**; **Undo** removes only assignments created by that run.

---

## UX snapshot

- **Switchers:** Account switcher → Team switcher (within the Account)
- **Scheduler console (Team):** Create Roles → add Schedule Templates → generate Shifts → assign → open replacements  
  **(V1.1)** Choose date range/roles → **Auto-schedule Preview** → accept/skip → **Apply** → **Undo**
- **Member:** My Roster, mark Unavailability, request replacements, accept offers. Filter by All, Account, or specific Team(s)

---

## Non-functional notes

- Time zones per user; all dates stored as UTC (RRULE expansion uses a chosen local zone then converts to UTC)
- Separate Supabase projects for dev/staging/prod
- Push tokens stored per user (Expo); notifications sent from Edge Functions
- **PWA:** installable on Windows, macOS, and supported browsers; offline shell for read views; Microsoft Store distribution via MSIX; auto-updates on deploy
- **Autoschedule apply:** use Postgres advisory locks per Team

---

## Bottom line

Accepted plan: multi-tenant Supabase with **Accounts containing Teams**, strict RLS, **Expo mobile + React PWA (Store-listed)**, Edge Functions for server tasks. Start simple: Teams → Roles → Templates → Shifts → Assignments → Unavailability → Replacement flow, then add **Auto-scheduling (V1.1)** per Team for fast, fair assignment.

---

## Subscription tier idea (subject to change)

| Tier             | Who it’s for               | Monthly | Active members (hard) | Teams (hard) | Roles (soft) | Notes                                                 |
| ---------------- | -------------------------- | ------: | --------------------: | -----------: | -----------: | ----------------------------------------------------- |
| **Family**       | Households, small groups   |      $9 |                    10 |            2 |           20 | Schedulers not capped; assign within team caps        |
| **Community**    | Typical churches/clubs     |     $49 |                   100 |           10 |          100 | Fits “50 volunteers” with multiple Teams              |
| **Organisation** | Larger churches/businesses |     $99 |                   250 |           25 |          200 | Priority support later; exports/integrations unlocked |
