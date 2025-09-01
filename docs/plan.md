# Roster App — Step-by-Step Plan (Servota)

_Last updated: 28 Aug 2025_

## Status

### Phase 0 — Foundations

- [x] [0.1 Pick a working name & domain](#01-pick-a-working-name--domain)
- [x] [0.2 Write audience & promise (1 paragraph + 3 bullets)](#02-write-audience--promise-1-paragraph--3-bullets)
- [x] [0.3 Write privacy & data-retention basics (1 page) + support email](#03-write-privacy--data-retention-basics-1-page--support-email)
- [x] [0.4 Developer accounts (NOW: GitHub Org; LATER: app stores)](#04-developer-accounts-now-github-org-later-app-stores)

> Note: Apple/Google/Microsoft store accounts are deferred until builds are ready.

### Phase 1 — Repo, tooling, and CI

- [x] [1.1 Create a monorepo with workspaces](#11-create-a-monorepo-with-workspaces)
- [x] [1.2 Add TypeScript, ESLint, Prettier, and pre-commit hooks](#12-add-typescript-eslint-prettier-and-pre-commit-hooks)
- [x] [1.3 Set up environment files](#13-set-up-environment-files)
- [x] [1.4 Add CI (GitHub Actions) for install/lint/typecheck](#14-add-ci-github-actions-for-installlinttypecheck)

### Phase 2 — Supabase projects & database

- [x] [2.1 Create Supabase projects: dev, staging, prod](#21-create-supabase-projects-dev-staging-prod)

> Note: Only created Dev and Prod, Will add staging later to lower costs at early stage of project.

- [x] [2.2 Install Supabase CLI and link “dev”](#22-install-supabase-cli-and-link-dev)
- [x] [2.3 Write v1 database schema (Teams, Events & Requirements, Swaps)](#23-write-v1-database-schema-teams-events--requirements-swaps)
- [ ] [2.3a Add auto-scheduling tables (V1.1)](#23a-add-auto-scheduling-tables-v11)

> Note: Will skip 2.3a for now and come back to it later.

- [x] [2.4 Add seed data](#24-add-seed-data)
- [x] [2.5 Turn on Row Level Security (RLS) and add policies](#25-turn-on-row-level-security-rls-and-add-policies)
- [x] [2.6 Test RLS with simple automated checks](#26-test-rls-with-simple-automated-checks)

### Phase 3 — Server functions

- [x] [3.1 Replacement claim function (first-come-first-served)](#31-replacement-claim-function-first-come-first-served)
- [x] [3.2 Subscription webhook (Stripe or Paddle)](#32-subscription-webhook-stripe-or-paddle)
- [x] [3.3 Notification sender (push/email queue)](#33-notification-sender-pushemail-queue)
- [ ] [3.4 Auto-scheduler Edge Function (preview/apply/undo)](#34-auto-scheduler-edge-function-previewapplyundo)

> Note: Will skip 3.4 until 2.3a is complete

- [x] [3.5 Swap assignments flow (request/accept/approve/apply/cancel/expire)](#35-swap-assignments-flow-requestacceptapproveapplycancelexpire)

### Phase 4 — Shared client core

- [x] [4.1 Generate TypeScript types from the database](#41-generate-typescript-types-from-the-database)
- [x] [4.2 Build a shared Supabase client wrapper](#42-build-a-shared-supabase-client-wrapper)
- [x] [4.3 Add date/time helpers (UTC storage, user-timezone display)](#43-add-datetime-helpers-utc-storage-user-timezone-display)

### Phase 5 — Mobile app (Expo)

- [x] [5.1 Create the Expo project and run it](#51-create-the-expo-project-and-run-it)
- [x] [5.2 Add sign-in/out with Supabase Auth](#52-add-sign-inout-with-supabase-auth)
- [x] [5.3 Add account & team switchers and membership display](#53-add-account--team-switchers-and-membership-display)
- [ ] [5.4 Build “My Roster” (list and/or month view)](#54-build-my-roster-list-andor-month-view)
- [ ] [5.5 Add Unavailability (create/edit/delete)](#55-add-unavailability-createeditdelete)
- [ ] [5.6 Add replacement request & claim](#56-add-replacement-request--claim)
- [ ] [5.7 Add peer-to-peer swaps (propose/accept; optional approval)](#57-add-peer-to-peer-swaps-proposeaccept-optional-approval)
- [ ] [5.8 Enable push notifications (Expo)](#58-enable-push-notifications-expo)

### Phase 6 — Web/Desktop app (React PWA + Microsoft Store)

- [ ] [6.1 Create React + Vite PWA and run it](#61-create-react--vite-pwa-and-run-it)
- [ ] [6.2 Add sign-in & account switcher (reuse shared client)](#62-add-sign-in--account-switcher-reuse-shared-client)
- [ ] [6.3 Build the team roster console (Requirements-aware)](#63-build-the-team-roster-console-requirements-aware)
- [ ] [6.4 Team settings: allow_swaps, roster_visibility](#64-team-settings-allow_swaps-roster_visibility)
- [ ] [6.5 Swap approvals queue (if policy requires)](#65-swap-approvals-queue-if-policy-requires)
- [ ] [6.6 Package for Microsoft Store (PWABuilder → MSIX) & test install](#66-package-for-microsoft-store-pwabuilder--msix--test-install)
- [ ] [6.7 Auto-schedule UI (preview → apply → undo)](#67-auto-schedule-ui-preview--apply--undo)

### Phase 7 — Guardrails (prevent mistakes)

- [ ] [7.1 Prevent double-booking a person](#71-prevent-double-booking-a-person)
- [ ] [7.2 Enforce event capacity](#72-enforce-event-capacity)
- [ ] [7.3 Enforce Requirements everywhere](#73-enforce-requirements-everywhere)
- [ ] [7.4 Enforce swap policy & audit](#74-enforce-swap-policy--audit)

### Phase 8 — Subscriptions & account lifecycle

- [ ] [8.1 Add plan & feature flags to accounts](#81-add-plan--feature-flags-to-accounts)
- [ ] [8.2 Connect checkout & customer portal](#82-connect-checkout--customer-portal)
- [ ] [8.3 Handle suspension gracefully](#83-handle-suspension-gracefully)
- [ ] [8.4 Add data-retention job (final deletion)](#84-add-data-retention-job-final-deletion)

### Phase 9 — Quality, security, and insight

- [ ] [9.1 End-to-end tests for critical flows](#91-end-to-end-tests-for-critical-flows)
- [ ] [9.2 Error tracking (Sentry or similar)](#92-error-tracking-sentry-or-similar)
- [ ] [9.3 Product analytics (minimal)](#93-product-analytics-minimal)
- [ ] [9.4 Security checklist pass](#94-security-checklist-pass)

### Phase 10 — Release readiness

- [ ] [10.1 App names, icons, splash screens, and copy](#101-app-names-icons-splash-screens-and-copy)
- [ ] [10.2 Build release packages](#102-build-release-packages)
- [ ] [10.3 First-run onboarding](#103-first-run-onboarding)
- [ ] [10.4 Minimal marketing site](#104-minimal-marketing-site)

### Phase 11 — Nice-to-haves (after MVP)

- [ ] [11.1 Fairness/quotas](#111-fairnessquotas)
- [ ] [11.2 Calendar integrations](#112-calendar-integrations)
- [ ] [11.3 SMS notifications](#113-sms-notifications)
- [ ] [11.4 Bulk import](#114-bulk-import)
- [ ] [11.5 Starter templates](#115-starter-templates)

---

## Phase 0 — Foundations (make sure we’re building the right thing)

### 0.1 Pick a working name & domain

- **What:** Choose a product name and register a domain (primary: `servota.app`).
- **Why:** Keeps repos, builds, and store entries consistent; avoids rename debt later.
- **Done when:** Domain purchased; repo name decided.

### 0.2 Write audience & promise (1 paragraph + 3 bullets)

- **What:** A short statement of who this is for and the outcome they get.
- **Why:** Guides product decisions and copy everywhere.
- **Done when:** Copy is paste-ready for README and landing page.

### 0.3 Write privacy & data-retention basics (1 page) + support email

- **What:** Plain-language privacy/retention one-pager; create **support@servota.app** (or shared mailbox).
- **Why:** Professional, reduces risk, and required by app stores.
- **Done when:** `docs/privacy.md` exists and **support@** can send/receive.

### 0.4 Developer accounts (NOW: GitHub Org; LATER: app stores)

- **What:** Create the GitHub Organization/repo now; defer Apple/Google/Microsoft store accounts.
- **Why:** Avoid upfront fees while unblocking repo/CI and collaboration.
- **Done when:** GitHub Org exists with 2FA enforced, repo created & protected. Store accounts listed as deferred.

---

## Phase 1 — Repo, tooling, and CI (so everything compiles the same way every time)

### 1.1 Create a monorepo with workspaces

- **What:** One repo with folders for mobile, **web (PWA)**, and shared code.
- **Why:** Reuse code and keep versions in sync.
- **Done when:** Running a single command installs/builds all packages.
- `/apps/mobile` — Expo app (iOS/Android)
- `/apps/web` — React PWA (Microsoft Store-listed)
- `/packages/ui` — shared UI components
- `/packages/shared` — shared types/utils/Supabase client
- `/packages/config` — tsconfig/eslint/prettier configs (optional)
- `/supabase` — migrations, seeds, RLS policies, functions

### 1.2 Add TypeScript, ESLint, Prettier, and pre-commit hooks

- **What:** Static typing + linting + formatting + Husky/lefthook pre-commit.
- **Why:** Fewer bugs; consistent codebase; catches issues before CI.
- **Done when:** `typecheck` and `lint` pass locally; hooks run on commit.

### 1.3 Set up environment files

- **What:** `.env.local` per app and `.env.example` template; no secrets in Git.
- **Why:** Safe config and repeatable setup for any dev machine.
- **Done when:** Apps read config from `.env.local`; repo has `.env.example`.

### 1.4 Add CI (GitHub Actions) for install/lint/typecheck

- **What:** Workflow that installs deps, **builds shared packages**, and runs typecheck + lint on PRs.
- **Why:** Prevents broken code from merging.
- **Done when:** CI runs automatically and shows green on `main`.

---

## Phase 2 — Supabase projects & database (multi-tenant + secure)

### 2.1 Create Supabase projects: dev, staging, prod

- **What:** Three separate environments in Supabase.
- **Why:** Test safely without touching real users.
- **Done when:** All three projects appear in Supabase Studio.

### 2.2 Install Supabase CLI and link “dev”

- **What:** Use CLI to manage migrations and local development.
- **Why:** Version-controlled database changes and consistent pushes.
- **Done when:** `supabase db push` works locally against “dev”.

### 2.3 Write v1 database schema (Teams, Events & Requirements, Swaps)

- **What:** Tables for **accounts with teams**, **Events**, flexible **Requirements**, and swaps:  
  `accounts, profiles, account_memberships, teams(allow_swaps, roster_visibility), team_memberships, requirements, user_requirements, event_templates, events, event_requirements, assignments, unavailability, replacement_requests, swap_requests, audit_log`.
- **Why:** Team-scoped rostering with assignment gated by Requirements; cross-team safety via account-scoped rules; built-in peer swaps.
- **Done when:** Migration runs; tables are visible in Studio.

### 2.3a Add auto-scheduling tables (V1.1)

- **What:** Team-scoped runs with account defaults and team overrides:  
  `scheduling_rules, recurring_availability, user_limits, autoschedule_runs(team_id), autoschedule_results`.
- **Why:** Inputs + auditable history for preview/apply/undo.
- **Done when:** Tables exist with RLS; seed creates a default policy per account and team.

### 2.4 Add seed data

- **What:** Insert example accounts, teams, **requirements**, users with **user_requirements**, event templates, generated events, assignments; include one pending `swap_request` and one `replacement_request`.
- **Why:** See real screens immediately for faster UI work.
- **Done when:** One command populates believable demo data.

### 2.5 Turn on Row Level Security (RLS) and add policies

- **What:** Users can only see/edit rows for **accounts they belong to**, and write within **teams** where they are `scheduler` (or account `owner/admin`). Unavailability is editable by the user and visible to account admins/schedulers. Swaps readable by involved users and schedulers/admins; applying swaps via secure RPC only.
- **Why:** Tenant safety; prevents data leaks.
- **Done when:** A user from Account A cannot read/edit Account B; a scheduler can only write within their Team(s).

### 2.6 Test RLS with simple automated checks

- **What:** Tests for forbidden/allowed reads & writes — including **requirement-gated assignment**, **cross-team overlap blocking**, **swap visibility**, and **team-scoped writes**.
- **Why:** Catch security mistakes early.
- **Done when:** Tests fail when they should and pass when allowed.

---

## Phase 3 — Server functions (things that must be safe and transactional)

### 3.1 Replacement claim function (first-come-first-served)

- **What:** Atomic RPC that fills an open Event spot **within a team** for the first eligible claimant (must satisfy Event Requirements, availability, overlap, capacity).
- **Why:** Prevents two people claiming the same spot.
- **Done when:** Simultaneous taps never exceed event capacity.

### 3.2 Subscription webhook (Stripe or Paddle)

- **What:** Webhook that flips `accounts.status` active/suspended from billing events.
- **Why:** Automates access control based on payment.
- **Done when:** Test events change status; access gates immediately via RLS.

### 3.3 Notification sender (push/email queue)

- **What:** Create and deliver notifications (assignment, reminders, replacement offers/claims, **swap events**) with **team context**.
- **Why:** Keeps people informed without manual texts.
- **Done when:** Trigger → queued → delivered to device/inbox with basic logging.

### 3.4 Auto-scheduler Edge Function (preview/apply/undo)

- **What:** Given a **team**, date range (and optional filters), propose assignments (preview), apply them transactionally with an **advisory lock per `(account_id, team_id)`**, and support undo via run logs.
- **Why:** Deterministic, auditable, race-safe automation that respects guardrails.
- **Done when:** Preview returns valid proposals; apply writes assignments without violations; undo removes exactly what the run added.

### 3.5 Swap assignments flow (request/accept/approve/apply/cancel/expire)

- **What:** RPC/Edge Function set for **peer swaps**: create request (same Event), accept/decline, optional scheduler approval (per team policy), **atomic exchange of `assignments.user_id`**, cancel/expire handling.
- **Why:** Lets teams self-manage swaps safely without breaking guardrails.
- **Done when:** Valid swaps apply; invalid ones are rejected with clear errors; audit and notifications recorded.

---

## Phase 4 — Shared client core (one source of truth for both apps)

### 4.1 Generate TypeScript types from the database

- **What:** Codegen DB types for strong typing in clients (including Events, Requirements).
- **Why:** Fewer bugs when reading/writing data.
- **Done when:** Both apps import and use the generated types.

### 4.2 Build a shared Supabase client wrapper

- **What:** Helper that sets up auth and **current context (account + optional team)**, and handles retries.
- **Why:** Avoid duplicated setup and auth edge cases.
- **Done when:** Both apps use the same client wrapper successfully.

### 4.3 Add date/time helpers (UTC storage, user-timezone display)

- **What:** Utilities to store UTC and render in the user’s timezone.
- **Why:** Prevents “my roster shows the wrong time” issues.
- **Done when:** The same event shows correct local times on every device.

---

## Phase 5 — Mobile app (member experience first)

### 5.1 Create the Expo project and run it

- **What:** Scaffold a new Expo app and run on iOS/Android.
- **Why:** Confirms toolchain works end-to-end.
- **Done when:** The app loads on a simulator/phone.

### 5.2 Add sign-in/out with Supabase Auth

- **What:** Email/password or magic link; handle deep links.
- **Why:** Users must log in to see their roster.
- **Done when:** You can sign in/out and stay signed in.

### 5.3 Add account & team switchers and membership display

- **What:** UI to switch **Account** and then **Team** within that Account; show account role(s) and team role(s).
- **Why:** Users can belong to multiple accounts and teams.
- **Done when:** Switching account/team changes all visible data.

### 5.4 Build “My Roster” (list and/or month view)

- **What:** Calendar/list showing the user’s assignments with filters (All, by Account, by Team).
- **Why:** Core value for volunteers and staff.
- **Done when:** Upcoming events render with key details and filters work.

### 5.5 Add Unavailability (create/edit/delete)

- **What:** Let users mark times they can’t serve (**account-scoped**).
- **Why:** Prevent double-booking by schedulers across all teams.
- **Done when:** Assignments over blackout times are blocked.

### 5.6 Add replacement request & claim

- **What:** “Can’t make it” → opens a claimable spot; eligible peers in the **same team** can accept (must satisfy Event Requirements).
- **Why:** Coverage without phone tag.
- **Done when:** End-to-end flow updates assignment correctly.

### 5.7 Add peer-to-peer swaps (propose/accept; optional approval)

- **What:** From team roster, tap an assigned peer on the **same future Event** → **Propose Swap**; recipient Accept/Decline; if team requires approval, scheduler approves before apply.
- **Why:** Real-world church/team workflow.
- **Done when:** Valid swaps apply; invalid attempts are prevented with clear messages.

### 5.8 Enable push notifications (Expo)

- **What:** Save device tokens; deliver assignment/reminder/offer alerts (team-aware) and **swap** notifications.
- **Why:** Users get timely updates.
- **Done when:** Devices receive test and real notifications.

---

## Phase 6 — Web/Desktop app (scheduler console as PWA)

### 6.1 Create React + Vite PWA and run it

- **What:** Scaffold PWA with `manifest.webmanifest` and service worker (offline shell).
- **Why:** Installable desktop experience from one codebase.
- **Done when:** App runs locally and is installable (“Add to apps”).

### 6.2 Add sign-in & account switcher (reuse shared client)

- **What:** Same auth flow and **account switcher** as mobile; shows current account context.
- **Why:** Consistency; less code.
- **Done when:** You can log in and switch account context.

### 6.3 Build the team roster console (Requirements-aware)

- **What:** **Team-scoped** grid/calendar to manage **Requirements**, **Event Templates**, generated **Events**, Assignments; “Assign” candidates filtered by **Event Requirements**; quick actions for Replacement/Swap.
- **Why:** This is where schedulers live daily.
- **Done when:** You can manage requirements, generate events, and assign smoothly with conflict checks.

### 6.4 Team settings: allow_swaps, roster_visibility

- **What:** UI to toggle **Allow swaps** and set **Roster visibility** (`team`, `account`, `private`) per team.
- **Why:** Churches vs workplaces need different policies.
- **Done when:** Settings persist and affect UI/permissions immediately.

### 6.5 Swap approvals queue (if policy requires)

- **What:** A list in the console for schedulers to approve/decline pending swaps when **approval required** is on.
- **Why:** Control without blocking teams that don’t need it.
- **Done when:** Approvals apply swaps atomically; audit and notifications are written.

### 6.6 Package for Microsoft Store (PWABuilder → MSIX) & test install

- **What:** Use PWABuilder to create MSIX; submit via Microsoft Partner Center.
- **Why:** Discoverability and easy install/updates on Windows.
- **Done when:** Store package installs and updates flow from web deploys.

### 6.7 Auto-schedule UI (preview → apply → undo)

- **What:** Panel (within a **Team**) to choose date range/filters/rules, show proposed assignments, accept/skip, apply, and undo last run.
- **Why:** Gives schedulers fast, safe automation with control.
- **Done when:** Preview, apply, and undo work end-to-end; a badge shows “X auto-scheduled”.

---

## Phase 7 — Rules that prevent mistakes (polish the guardrails)

### 7.1 Prevent double-booking a person

- **What:** DB exclusion constraint on overlapping **confirmed** assignments per user **within an account** (across all teams).
- **Why:** Eliminates human error.
- **Done when:** Overlaps are rejected with a clear message.

### 7.2 Enforce event capacity

- **What:** UI and server checks; replacement claim function enforces capacity atomically.
- **Why:** Keeps rosters tidy and accurate.
- **Done when:** System refuses over-capacity assignments.

### 7.3 Enforce Requirements everywhere

- **What:** Require `(User Requirements) ⊇ (Event Requirements)` (or ANY_OF) for manual assign, replacement, swaps, and auto-schedule.
- **Why:** Safety and fit-for-role.
- **Done when:** Non-matching users never appear in candidates and cannot be assigned.

### 7.4 Enforce swap policy & audit

- **What:** Respect **allow_swaps** and **roster_visibility**; swaps only for the same Event; write to `audit_log`.
- **Why:** Governance and traceability.
- **Done when:** Violations are blocked; audits show who did what and when.

---

## Phase 8 — Subscriptions & account lifecycle

### 8.1 Add plan & feature flags to accounts

- **What:** Store and read plan (Family/Community/Organisation) and feature gates including **team caps** per account.
- **Why:** Unlock pricing tiers and limits later.
- **Done when:** App branches features/limits based on plan.

### 8.2 Connect checkout & customer portal

- **What:** Stripe/Paddle checkout and portal links; save customer/subscription IDs.
- **Why:** Monetisation and self-serve management.
- **Done when:** Test payment changes account status via webhook.

### 8.3 Handle suspension gracefully

- **What:** On failed payment set `accounts.status='suspended'`; show “reactivate” screen; keep data.
- **Why:** Professional and reversible.
- **Done when:** Switching to suspended instantly locks access tenant-wide.

### 8.4 Add data-retention job (final deletion)

- **What:** After grace period (e.g., 90 days), permanently delete suspended accounts; backups age out.
- **Why:** Privacy and cost control.
- **Done when:** A scheduled job removes test data end-to-end.

---

## Phase 9 — Quality, security, and insight

### 9.1 End-to-end tests for critical flows

- **What:** Automated flows for sign-in, assign, replacement, **swap**, notifications (including team context).
- **Why:** Prevent regressions before release.
- **Done when:** Tests run locally and in CI with consistent pass.

### 9.2 Error tracking (Sentry or similar)

- **What:** Capture exceptions with account/team/user context.
- **Why:** Fix issues fast with real diagnostics.
- **Done when:** Errors appear in the dashboard with useful metadata.

### 9.3 Product analytics (minimal)

- **What:** Track key events (sign_in, create_team, create_requirement, grant_user_requirement, create_event_template, generate_events, assignment_created, replacement_opened/claimed/filled, swap_requested/accepted/applied, autoschedule_preview/applied/undo).
- **Why:** Understand adoption and friction points.
- **Done when:** Events stream into analytics with basic dashboards.

### 9.4 Security checklist pass

- **What:** Review RLS, keys, backups, PII handling, 2FA, least privilege.
- **Why:** Protect users and reputation.
- **Done when:** All items checked; backups tested and restorable.

---

## Phase 10 — Release readiness

### 10.1 App names, icons, splash screens, and copy

- **What:** Branding assets for mobile and PWA (maskable icons).
- **Why:** Professional presentation and store compliance.
- **Done when:** Assets render correctly on all targets.

### 10.2 Build release packages

- **What:** iOS/Android builds via EAS and Microsoft Store MSIX via PWABuilder.
- **Why:** Required for distribution and updates.
- **Done when:** Mobile builds install; PWA MSIX installs from Store.

### 10.3 First-run onboarding

- **What:** Guided flow: create account → create team(s) → define requirements → invite people → grant user requirements → create event template → generate events → assign → (optional) explain swaps.
- **Why:** Time-to-value in minutes.
- **Done when:** A new user completes onboarding without help.

### 10.4 Minimal marketing site

- **What:** Landing page with promise, features, pricing (user & team caps), privacy, support.
- **Why:** Validation and sales air cover.
- **Done when:** Site is live and can collect emails.

---

## Phase 11 — Nice-to-haves (after MVP)

### 11.1 Fairness/quotas

- **What:** Caps per person (e.g., max assignments per month) and per-team reporting.
- **Why:** Balance load and avoid burnout.
- **Done when:** Quotas enforce and report cleanly.

### 11.2 Calendar integrations

- **What:** iCal feeds; optional Google/Microsoft sync.
- **Why:** Meet users where they already live.
- **Done when:** Subscribed calendars reflect assignments.

### 11.3 SMS notifications

- **What:** Twilio/etc. fallback for teams who rely on texts.
- **Why:** Increase reach and timeliness.
- **Done when:** Users can opt-in and receive SMS for key events.

### 11.4 Bulk import

- **What:** CSV upload for members and requirements.
- **Why:** Fast onboarding of large groups.
- **Done when:** Valid CSVs import with clear error handling.

### 11.5 Starter templates

- **What:** Presets for Churches / Workplaces / Families (with **Team** examples like Youth, Music, Hospitality).
- **Why:** Faster setup and better defaults.
- **Done when:** Users can start from a template in onboarding.
