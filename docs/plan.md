# Roster App — Step-by-Step Plan (Servota)

_Last updated: 26 Aug 2025_

## Status

### Phase 0 — Foundations

- [x] [0.1 Pick a working name & domain](#01-pick-a-working-name--domain)
- [x] [0.2 Write audience & promise (1 paragraph + 3 bullets)](#02-write-audience--promise-1-paragraph--3-bullets)
- [x] [0.3 Write privacy & data-retention basics (1 page) + support email](#03-write-privacy--data-retention-basics-1-page--support-email)
- [x] [0.4 Developer accounts (NOW: GitHub Org; LATER: app stores)](#04-developer-accounts-now-github-org-later-app-stores)

> Note: Apple/Google/Microsoft store accounts are deferred to avoid fees until builds are ready.

### Phase 1 — Repo, tooling, and CI

- [x] [1.1 Create a monorepo with workspaces](#11-create-a-monorepo-with-workspaces)
- [x] [1.2 Add TypeScript, ESLint, Prettier, and pre-commit hooks](#12-add-typescript-eslint-prettier-and-pre-commit-hooks)
- [ ] [1.3 Set up environment files](#13-set-up-environment-files)
- [ ] [1.4 Add CI (GitHub Actions) for install/lint/typecheck](#14-add-ci-github-actions-for-installlinttypecheck)

### Phase 2 — Supabase projects & database

- [ ] [2.1 Create Supabase projects: dev, staging, prod](#21-create-supabase-projects-dev-staging-prod)
- [ ] [2.2 Install Supabase CLI and link “dev”](#22-install-supabase-cli-and-link-dev)
- [ ] [2.3 Write v1 database schema (tables)](#23-write-v1-database-schema-tables)
- [ ] [2.3a Add auto-scheduling tables (V1.1)](#23a-add-auto-scheduling-tables-v11)
- [ ] [2.4 Add seed data](#24-add-seed-data)
- [ ] [2.5 Turn on Row Level Security (RLS) and add policies](#25-turn-on-row-level-security-rls-and-add-policies)
- [ ] [2.6 Test RLS with simple automated checks](#26-test-rls-with-simple-automated-checks)

### Phase 3 — Server functions

- [ ] [3.1 Replacement claim function (first-come-first-served)](#31-replacement-claim-function-first-come-first-served)
- [ ] [3.2 Subscription webhook (Stripe or Paddle)](#32-subscription-webhook-stripe-or-paddle)
- [ ] [3.3 Notification sender (push/email queue)](#33-notification-sender-pushemail-queue)
- [ ] [3.4 Auto-scheduler Edge Function (preview/apply/undo)](#34-auto-scheduler-edge-function-previewapplyundo)

### Phase 4 — Shared client core

- [ ] [4.1 Generate TypeScript types from the database](#41-generate-typescript-types-from-the-database)
- [ ] [4.2 Build a shared Supabase client wrapper](#42-build-a-shared-supabase-client-wrapper)
- [ ] [4.3 Add date/time helpers (UTC storage, user-timezone display)](#43-add-datetime-helpers-utc-storage-user-timezone-display)

### Phase 5 — Mobile app (Expo)

- [ ] [5.1 Create the Expo project and run it](#51-create-the-expo-project-and-run-it)
- [ ] [5.2 Add sign-in/out with Supabase Auth](#52-add-sign-inout-with-supabase-auth)
- [ ] [5.3 Add account switcher and membership display](#53-add-account-switcher-and-membership-display)
- [ ] [5.4 Build “My Roster” (list and/or month view)](#54-build-my-roster-list-andor-month-view)
- [ ] [5.5 Add Unavailability (create/edit/delete)](#55-add-unavailability-createeditdelete)
- [ ] [5.6 Add replacement request & claim](#56-add-replacement-request--claim)
- [ ] [5.7 Enable push notifications (Expo)](#57-enable-push-notifications-expo)

### Phase 6 — Web/Desktop app (React PWA + Microsoft Store)

- [ ] [6.1 Create React + Vite PWA and run it](#61-create-react--vite-pwa-and-run-it)
- [ ] [6.2 Add sign-in & account switcher (reuse shared client)](#62-add-sign-in--account-switcher-reuse-shared-client)
- [ ] [6.3 Build the roster console](#63-build-the-roster-console)
- [ ] [6.4 Package for Microsoft Store (PWABuilder → MSIX) & test install](#64-package-for-microsoft-store-pwabuilder--msix--test-install)
- [ ] [6.5 Auto-schedule UI (preview → apply → undo)](#65-auto-schedule-ui-preview--apply--undo)

### Phase 7 — Guardrails (prevent mistakes)

- [ ] [7.1 Prevent double-booking a person](#71-prevent-double-booking-a-person)
- [ ] [7.2 Enforce shift capacity](#72-enforce-shift-capacity)
- [ ] [7.3 Enforce eligibility everywhere](#73-enforce-eligibility-everywhere)

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

- **What:** Workflow that installs deps and runs typecheck + lint on PRs.
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

### 2.3 Write v1 database schema (tables)

- **What:** Tables for `accounts, profiles, memberships, roles, schedule_templates, shifts, assignments, eligibility, unavailability, replacement_requests, audit_log`.
- **Why:** These are the building blocks of rostering.
- **Done when:** Migration runs; tables are visible in Studio.

### 2.3a Add auto-scheduling tables (V1.1)

- **What:** Add flexible rule storage, optional recurring availability, per-user limits, and run logs (preview/apply/undo).
- **Why:** Inputs + auditable history are required for auto-schedule and safe rollback.
- **Done when:** Tables exist with RLS; seed creates a default policy.

### 2.4 Add seed data

- **What:** Script/migration to insert example accounts, users, roles, and sample shifts.
- **Why:** See real screens immediately for faster UI work.
- **Done when:** One command populates believable demo data.

### 2.5 Turn on Row Level Security (RLS) and add policies

- **What:** Policies so users can only see/edit rows for accounts they belong to; writes limited to owner/scheduler.
- **Why:** Tenant safety; prevents data leaks.
- **Done when:** A user from Account A cannot read/edit Account B.

### 2.6 Test RLS with simple automated checks

- **What:** Tests that attempt forbidden reads/writes and allowed ones.
- **Why:** Catch security mistakes early.
- **Done when:** Tests fail when they should and pass when allowed.

---

## Phase 3 — Server functions (things that must be safe and transactional)

### 3.1 Replacement claim function (first-come-first-served)

- **What:** Atomic function/RPC that assigns an open shift to the first eligible claimant.
- **Why:** Prevents two people claiming the same spot.
- **Done when:** Simultaneous taps never exceed shift capacity.

### 3.2 Subscription webhook (Stripe or Paddle)

- **What:** Webhook that flips `accounts.status` active/suspended from billing events.
- **Why:** Automates access control based on payment.
- **Done when:** Test events change status; access gates immediately via RLS.

### 3.3 Notification sender (push/email queue)

- **What:** Create and deliver notifications (assignment, reminders, replacement offers/claims).
- **Why:** Keeps people informed without manual texts.
- **Done when:** Trigger → queued → delivered to device/inbox with basic logging.

### 3.4 Auto-scheduler Edge Function (preview/apply/undo)

- **What:** Given a date range (and optional roles), propose assignments (preview), apply them transactionally, and support undo via run logs.
- **Why:** Deterministic, auditable, race-safe automation that respects guardrails.
- **Done when:** Preview returns valid proposals; apply writes assignments without violations; undo removes exactly what the run added.

---

## Phase 4 — Shared client core (one source of truth for both apps)

### 4.1 Generate TypeScript types from the database

- **What:** Codegen DB types for strong typing in clients.
- **Why:** Fewer bugs when reading/writing data.
- **Done when:** Both apps import and use the generated types.

### 4.2 Build a shared Supabase client wrapper

- **What:** Helper that sets up auth, selects current account, and handles retries.
- **Why:** Avoid duplicated setup and auth edge cases.
- **Done when:** Both apps use the same client wrapper successfully.

### 4.3 Add date/time helpers (UTC storage, user-timezone display)

- **What:** Utilities to store UTC and render in the user’s timezone.
- **Why:** Prevents “my roster shows the wrong time” issues.
- **Done when:** The same shift shows correct local times on every device.

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

### 5.3 Add account switcher and membership display

- **What:** UI to switch which organisation you’re viewing; show your role(s).
- **Why:** Users can belong to multiple teams/churches.
- **Done when:** Switching accounts changes all visible data.

### 5.4 Build “My Roster” (list and/or month view)

- **What:** Calendar/list showing only the user’s assignments.
- **Why:** Core value for volunteers and staff.
- **Done when:** Upcoming shifts render with key details.

### 5.5 Add Unavailability (create/edit/delete)

- **What:** Let users mark times they can’t serve.
- **Why:** Prevent double-booking by schedulers.
- **Done when:** Assignments over blackout times are blocked.

### 5.6 Add replacement request & claim

- **What:** “Can’t make it” → opens a claimable slot; eligible peers can accept.
- **Why:** Swaps happen without phone tag.
- **Done when:** End-to-end flow updates assignment correctly.

### 5.7 Enable push notifications (Expo)

- **What:** Save device tokens; deliver assignment/reminder/offer alerts.
- **Why:** Users get timely updates.
- **Done when:** Devices receive test and real notifications.

---

## Phase 6 — Web/Desktop app (scheduler console as PWA)

### 6.1 Create React + Vite PWA and run it

- **What:** Scaffold PWA with `manifest.webmanifest` and service worker (offline shell).
- **Why:** Installable desktop experience from one codebase.
- **Done when:** App runs locally and is installable (“Add to apps”).

### 6.2 Add sign-in & account switcher (reuse shared client)

- **What:** Same auth flow and account switcher as mobile.
- **Why:** Consistency; less code.
- **Done when:** You can log in and switch context.

### 6.3 Build the roster console

- **What:** Grid/calendar to create roles, add schedule templates, generate shifts, and assign eligible people (drag/click).
- **Why:** This is where schedulers live daily.
- **Done when:** You can generate shifts and assign smoothly with conflict checks.

### 6.4 Package for Microsoft Store (PWABuilder → MSIX) & test install

- **What:** Use PWABuilder to create MSIX; submit via Microsoft Partner Center.
- **Why:** Discoverability and easy install/updates on Windows.
- **Done when:** Store package installs and updates flow from web deploys.

### 6.5 Auto-schedule UI (preview → apply → undo)

- **What:** Panel to choose date range/roles/rules, show proposed assignments, accept/skip, apply, and undo last run.
- **Why:** Gives schedulers fast, safe automation with control.
- **Done when:** Preview, apply, and undo work end-to-end; a badge shows “X auto-scheduled”.

---

## Phase 7 — Rules that prevent mistakes (polish the guardrails)

### 7.1 Prevent double-booking a person

- **What:** DB exclusion constraint on overlapping **confirmed** assignments per user.
- **Why:** Eliminates human error.
- **Done when:** Overlaps are rejected with a clear message.

### 7.2 Enforce shift capacity

- **What:** UI and server checks; replacement claim function enforces capacity atomically.
- **Why:** Keeps rosters tidy and accurate.
- **Done when:** System refuses over-capacity assignments.

### 7.3 Enforce eligibility everywhere

- **What:** Only eligible users for a role can be assigned; validate in UI and DB.
- **Why:** Safety and quality.
- **Done when:** Ineligible assignments are impossible.

---

## Phase 8 — Subscriptions & account lifecycle

### 8.1 Add plan & feature flags to accounts

- **What:** Store and read plan (Family/Community/Organisation) and feature gates.
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

- **What:** Automated flows for sign-in, assign, replace, notifications.
- **Why:** Prevent regressions before release.
- **Done when:** Tests run locally and in CI with consistent pass.

### 9.2 Error tracking (Sentry or similar)

- **What:** Capture exceptions with account/user context.
- **Why:** Fix issues fast with real diagnostics.
- **Done when:** Errors appear in the dashboard with useful metadata.

### 9.3 Product analytics (minimal)

- **What:** Track key events (sign-in, create role, create template, assignment, replacement claim).
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

- **What:** Guided flow: create account → invite people → set eligibility → create role → template → generate shifts → assign.
- **Why:** Time-to-value in minutes.
- **Done when:** A new user completes onboarding without help.

### 10.4 Minimal marketing site

- **What:** Landing page with promise, features, pricing, privacy, support.
- **Why:** Validation and sales air cover.
- **Done when:** Site is live and can collect emails.

---

## Phase 11 — Nice-to-haves (after MVP)

### 11.1 Fairness/quotas

- **What:** Caps per person (e.g., max assignments per month).
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

- **What:** CSV upload for members and eligibility.
- **Why:** Fast onboarding of large groups.
- **Done when:** Valid CSVs import with clear error handling.

### 11.5 Starter templates

- **What:** Presets for Churches / Workplaces / Families.
- **Why:** Faster setup and better defaults.
- **Done when:** Users can start from a template in onboarding.
