# Scheduling & Rostering App (Details) — Servota
_Last updated: 26 Aug 2025_

## What it is
A simple, flexible scheduling tool for any group that needs a roster—churches, workplaces, clubs, families. Keep setup quick, rostering clear, and swaps painless. **Post-MVP (V1.1)** optionally auto-schedules shifts based on rules and availability with a preview → apply → undo flow.

## Who it’s for
- **Churches:** worship leaders, coffee team, cleaners, communion, etc.
- **Workplaces & clubs:** shift rosters, duties, on-call coverage.
- **Families:** recurring chores and tasks.

## Core objects (neutral naming)
- **Account** — an organisation/tenant.  
- **User** — a person with a Supabase Auth identity.  
- **Membership** — links a User to one or more Accounts with a role (owner, scheduler, member).  
- **Role** — what needs doing (e.g., “Coffee Maker”).  
- **Schedule Template** — recurrence rules for a Role (once-off, weekly, monthly).  
- **Shift** — a dated instance created from a Schedule Template; has capacity (e.g., “need 2 people”).  
- **Eligibility** — which Users are allowed/willing/qualified for each Role.  
- **Assignment** — User ↔ Shift link when rostered.  
- **Unavailability** — User blackout dates/times.  
- **Replacement Request** — a rostered user can’t attend; opens a claimable slot.  
- **(V1.1) Scheduling Rules** — JSON policy per account (and per-role overrides).  
- **(V1.1) Recurring Availability (optional)** — weekly “OK to serve” windows.  
- **(V1.1) User Limits** — per-user caps (max/week, max/month, min gap).  
- **(V1.1) Auto-schedule Run/Result** — log of proposals, applied picks, and reasons.

---

## MVP scope (v1)

### Accounts & access
- Users sign up/log in (Supabase Auth).
- Memberships grant per-Account roles: owner/scheduler/member.

### Roles & schedules
- Create Roles.
- Create Schedule Templates (once-off/weekly/monthly) → system generates Shifts into a task pool.

### Eligibility & assigning
- Mark User ↔ Role Eligibility.
- Only eligible, available Users can be Assigned to Shifts.
- **Scheduler view:** full roster grid/calendar with filters.
- **My calendar:** each User sees only their Assignments.

### Unavailability & clashes
- Users record Unavailability; system blocks conflicting assignments and prevents overlaps.

### Smart replacement flow
- Rostered user taps **“Can’t make it”**.
- Notify Scheduler.
- Broadcast to eligible, available Users not already rostered at that time.
- First-come, first-served acceptance auto-assigns and confirms.

### Notifications (initial)
- **Triggers:** assignment created/changed, upcoming reminders (e.g., 24–48h), replacement offers/claims.  
- **Channels:** push/email in v1 (SMS optional later).

---

## Auto-scheduling (V1.1)

**What:** One-click **Preview → Apply → Undo** that assigns shifts over a date range using rules (fairness, caps, min gap) and availability.  
**Why:** Save scheduler hours while staying fair and avoiding conflicts.  
**How (quick rules):**
- Candidates per shift = **eligible ∩ not unavailable ∩ no overlap ∩ respects min_gap**.  
- **Scoring:** favour people with fewer recent assignments for that role; reject if weekly/monthly caps exceeded; prefer even rotation.  
- **Apply:** transactional inserts to `assignments`, capacity-safe; **Undo:** remove only what this run added.  
- **Audit:** store proposals, picks, and “why” in run/results tables.

UI: in the roster console, pick date range + roles + rule set → **Preview** (accept/skip per row) → **Apply** → optional **Undo last run**.

---

## Architecture

- **Mobile:** Expo (iOS/Android).
- **Web/Desktop:** **React PWA (Vite)**, installable on desktop; **packaged for Microsoft Store (Windows)** via PWABuilder → MSIX.  
  Auto-updates from web deploys; offline shell for core views; supports Windows notifications via Web Push.
- **Backend/Data:** Supabase (Postgres) with Row Level Security (RLS).
- **Server logic:** Supabase Edge Functions for webhooks, notifications, RRULE expansions, race-safe replacement claims, and **(V1.1) auto-scheduler**.
- **Subscriptions:** Stripe/Paddle → webhook → update `accounts.status`.

### Monorepo (high level)
/apps/mobile # Expo app  
/apps/web # React PWA (Microsoft Store-listed)  
/packages/ui # shared UI  
/packages/shared # shared types/utils/Supabase client  
/packages/config # tsconfig/eslint/prettier (optional)  
/supabase # migrations, seeds, policies, functions

---

## Data model (tenant-scoped; users can belong to many accounts)

**MVP tables**
- accounts(id, name, status, plan, stripe_customer_id, created_at)  
- profiles(user_id PK → auth.users.id, full_name, default_account_id)  
- memberships(id, account_id, user_id, role ENUM('owner','scheduler','member'), status ENUM('active','invited','suspended'))  
- roles(id, account_id, name, notes, active, UNIQUE(account_id, name))  
- eligibility(id, account_id, user_id, role_id)  
- schedule_templates(id, account_id, role_id, start_date, time, duration, rrule, capacity)  
- shifts(id, account_id, role_id, starts_at, ends_at, capacity, status)  
- assignments(id, account_id, shift_id, user_id, status, assigned_at, source)  
- unavailability(id, account_id, user_id, starts_at, ends_at, reason)  
- replacement_requests(id, account_id, shift_id, requester_user_id, opened_at, closed_at, status)  
- audit_log(id, account_id, table_name, action, row_id, user_id, at, diff)

**V1.1 auto-scheduling tables**
- scheduling_rules(id, account_id, name, params JSONB, active) — default policy per account.  
- scheduling_role_overrides(id, account_id, role_id, params JSONB) — per-role tweaks.  
- recurring_availability(id, account_id, user_id, weekday, start_local, end_local, timezone) — optional weekly OK windows.  
- user_limits(id, account_id, user_id, max_per_week, max_per_month, min_gap_hours) — override caps.  
- autoschedule_runs(id, account_id, started_by, range_from, range_to, params JSONB, status, stats JSONB) — one run.  
- autoschedule_results(id, run_id, shift_id, user_id, reason, status) — proposals/applied/skipped lines.

**Keys/Indexes:** UUID PKs, `created_at/updated_at` everywhere, indexes on `(account_id, fk)`; put `account_id` on every tenant table for simpler RLS and uniques.

---

## Security & data handling
- **RLS everywhere.** Policies gate reads/writes by current user’s active Membership for the row’s `account_id`.  
- **Roles for writes.** Only owner/scheduler can create/update roster data.  
- **No service key in clients.** Client apps use user JWTs only.  
- **Audit trail.** Triggers write to an `audit_log` table for inserts/updates/deletes.  
- **(V1.1)** Auto-schedule runs/results are readable by members; write/apply/undo limited to owner/scheduler.

**Account suspension (subscriptions):**  
On failed payment, set `accounts.status='suspended'`. RLS denies all access so data appears gone but is preserved. Offer a retention window (e.g., 90 days), then hard-delete with `ON DELETE CASCADE` or a scheduled function. This avoids accidental loss and supports legal retention.

---

## Concurrency & fairness (baseline + V1.1)
- **Overlap guard:** exclusion constraint prevents overlapping **confirmed** assignments per user.  
- **Capacity guard:** replacement claim and apply steps run capacity-safe transactions.  
- **Eligibility enforced** at read and write.  
- **(V1.1) Auto-scheduler:** candidates filtered by eligibility, unavailability, overlap, and **min_gap_hours**; scoring prefers even rotation and respects **max_per_week/month** (policy or user override). **Apply** uses a transaction + advisory lock per account; **Undo** removes only assignments created by that run.

---

## UX snapshot
- **Scheduler:** Create Roles → add Schedule Templates → generate Shifts → assign via grid/calendar → open replacements when needed.  
  **(V1.1)** Choose date range/roles → **Auto-schedule Preview** → accept/skip → **Apply** → **Undo** if needed.
- **Member:** My Roster, mark Unavailability, request replacements, accept offers.

---

## Non-functional notes
- Time zones per user; all dates stored as UTC (RRULE expansion uses a chosen local zone then converts to UTC).  
- Separate Supabase projects for dev/staging/prod.  
- Push tokens stored per user (Expo); notifications sent from Edge Functions.  
- **PWA:** installable on Windows, macOS, and supported browsers; offline shell for read views; Microsoft Store distribution via MSIX; auto-updates on deploy.  
- **Autoschedule apply:** use Postgres advisory locks per `account_id` to avoid concurrent runs.

---

## Bottom line
Accepted plan: multi-tenant Supabase with memberships (users not locked to a single account), strict RLS, **Expo mobile + React PWA (Store-listed)**, Edge Functions for server tasks. Start simple: Roles → Templates → Shifts → Assignments → Unavailability → Replacement flow, then add **Auto-scheduling (V1.1)** for fast, fair assignment.

---

## Subscription tier idea (subject to change)

| Tier | Who it’s for | Monthly | Active members (hard) | Roles (soft) | Schedulers | Notes |
|---|---|---:|---:|---:|---:|---|
| **Family** | Households, small groups | $9 | 10 | 20 | 1 | All core features (roster, unavailability, replacements, notifications). |
| **Community** | Typical churches/clubs | $49 | 100 | 100 | 3 | Fits the “50 volunteers” use case comfortably. |
| **Organisation** | Larger churches/businesses | $99 | 250 | 200 | 5 | Priority support later; exports/integrations unlocked. |
