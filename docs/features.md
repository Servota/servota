# Features — Servota

_Last updated: 28 Aug 2025_

A living reference of product features so we design, build, and test consistently. Use this to onboard new collaborators and to sanity-check scope against MVP.

---

## 0) Vocabulary (quick map)

- **Account** → Organisation/tenant
- **Team** → Group inside an Account (e.g., Main Roster, Youth, Music)
- **Account Roles** → `owner`, `admin` (global across the Account)
- **Team Roles** → `scheduler`, `member` (per Team)
- **Requirement** → Team-scoped tag that gates assignment (role/skill/check; e.g., “Communion Leader”, “WWCC”, “First Aid”)
- **Event Template** → Recurrence config that generates dated **Events**
- **Event** → Dated thing to staff (label, description, start/end, capacity)
- **Assignment** → User ↔ Event
- **Unavailability** → Account-scoped blackout window
- **Replacement** → “I can’t make it” → open spot → first-come claim
- **Swap** → Two users exchange the **same future Event** (same slot)

---

## 1) Accounts & Teams

**Goal:** Multi-group rostering inside one org.

**Scope (MVP):**

- Create/rename/archive **Teams** within an Account.
- Team settings:
  - `allow_swaps` (default **true**)
  - `roster_visibility`: `team` | `account` | `private` (default **team**) — UI-enforced at MVP.

**Data touchpoints:** `teams(id, account_id, name, active, allow_swaps, roster_visibility)`

**Acceptance:**

- New Team appears in switchers; toggling settings updates UI behaviour immediately.

---

## 2) Membership & Permissions

**Goal:** Right people can see/edit the right things.

**Scope (MVP):**

- **Account Memberships:** `owner`, `admin`.
- **Team Memberships:** `scheduler`, `member`.

**Rules:**

- Read requires account membership.
- Write requires **account `owner/admin`** or **team `scheduler`**.

**Data:** `account_memberships`, `team_memberships` (+ RLS everywhere)

**Acceptance:** Non-members see nothing; schedulers can only edit within their Team(s).

---

## 3) Requirements (the flexible gate)

**Goal:** One mechanism that covers “roles”, “skills”, or “checks”.

**Scope (MVP):**

- Create **Requirements** per Team (unique by name).
- Grant **User Requirements** to users.
- Add **Event Requirements** (0/1/many) to Templates/Events.

**Modes:**

- `ALL_OF` (default) — user must hold **all** listed requirements
- `ANY_OF` — user must hold **at least one**

**Data:**  
`requirements`, `user_requirements`, `event_requirements`, `events.requirement_mode`, `event_templates.requirement_mode`

**Acceptance:** Only matching users show as candidates for an Event.

---

## 4) Event Templates → Events (recurrence)

**Goal:** Define repeat patterns; generate dated Events.

**Scope (MVP):**

- Template fields: label (display title), description, start time, duration, capacity, requirement mode, RRULE (once/daily/weekly/fortnightly/monthly).
- Generate Events over a date range (idempotent).
- Edit single Events after generation (date/time/capacity/requirements).

**Data:** `event_templates`, `events`

**Acceptance:** Weekly template → generating 8 weeks creates 8 Events (no duplicates).

---

## 5) Events management

**Goal:** Create/modify Events cleanly.

**Scope (MVP):**

- Create one-off Events directly.
- Attach/remove **Event Requirements**, set requirement mode.
- Attach files/notes (files later; description now).
- Cancel/restore events (status).

**Acceptance:** Scheduler can create/edit Events; assign view filters candidates by requirements.

---

## 6) Requirements-based matching (assignment rule)

**Goal:** Safe staffing without manual “eligibility lists”.

**Rule (applies to manual assign, replacement, swaps, auto-schedule):**
(User Requirements) ⊇ (Event Requirements) // or ANY_OF
AND user not unavailable (account-scoped)
AND no overlapping confirmed Assignment (account-wide)
AND event capacity not exceeded

**Acceptance:** Non-matching users never appear in candidates; attempts to force an assignment are blocked with a clear reason.

---

## 7) Assignments (manual)

**Goal:** Put people on Events safely.

**Scope (MVP):**

- Assign/remove up to capacity.
- Multi-assign from a grid/list.

**Guardrails:** requirements, unavailability, overlap, capacity (see §15).

**Data:** `assignments(source: 'manual' | 'replacement' | 'swap' | 'auto')`

**Acceptance:** Violations are blocked with helpful errors (e.g., “Needs WWCC”).

---

## 8) Unavailability (account-scoped)

**Goal:** Users block out times once; applies across all Teams.

**Scope (MVP):**

- Create/edit/delete personal Unavailability.

**Acceptance:** Assignment over a blackout is rejected; candidate list excludes users who would overlap.

---

## 9) Replacement (“I can’t make it”)

**Goal:** Fast coverage without phone tag.

**Flow:**

1. Assigned user taps **“Can’t make it”** on a future Event.
2. System opens a **replacement_request**.
3. Notify **eligible & available** Team members (meet requirements, no overlap).
4. **First claimant wins**; assign atomically; original is unassigned.

**Data/Functions:** `replacement_requests`; RPC/Edge **`claim_replacement`** (atomic)

**Acceptance:** Two claimants at once → one winner, capacity preserved.

---

## 10) Peer-to-Peer Swaps

**Goal:** Let teams self-organise (church-friendly) without breaking rules.

**Flow:**

1. From the team roster, user picks another **assigned** person on the **same future Event** → **Propose Swap** (+ optional note).
2. Recipient **Accept/Decline**.
3. If team policy requires approval, scheduler **Approves**.
4. **Apply** = atomic exchange of `assignments.user_id` on two rows (re-validate requirements/availability/overlap).

**Data/Functions:**  
`swap_requests(status: pending|accepted|declined|cancelled|expired|needs_approval|applied)`  
RPC/Edge: `propose_swap`, `respond_swap`, `apply_swap`

**Acceptance:** Valid swaps apply in one transaction; invalid attempts are blocked.

---

## 11) Roster visibility (policy)

**Goal:** Transparency for churches; privacy for workplaces.

**Modes (MVP, UI-enforced):**

- `team` — visible to team members & schedulers
- `account` — visible to all account members
- `private` — visible only to assigned users + schedulers/admins

**Data:** `teams.roster_visibility`

**Acceptance:** Changing visibility updates who can view the roster grid.

---

## 12) Notifications (push/email)

**Goal:** Right info, right people, right time.

**Events (MVP):**

- Assignment created/changed
- Upcoming reminder (e.g., 24–48h)
- Replacement opened/claimed/filled
- Swap requested/accepted/declined/cancelled/expired/approved/applied

**Channels:** Push (Expo) + email (SMS later)

**Acceptance:** Single, de-duplicated notifications to the correct recipients.

---

## 13) Auto-Scheduling (V1.1 — team-scoped)

**Goal:** Save schedulers hours; stay fair and conflict-free.

**Flow:** **Preview → Apply (locked) → Undo** per Team and date range.

**Rules:**

- Candidates: requirements-match ∩ not unavailable ∩ no overlap ∩ respects `min_gap`.
- Scoring: favour fewer recent assignments; respect `max_per_week/month`.
- Apply under advisory lock `(account_id, team_id)`.

**Data:** `scheduling_rules`, `recurring_availability` (optional), `user_limits`, `autoschedule_runs`, `autoschedule_results`

**Acceptance:** Apply writes exactly the Preview; Undo removes only what that run added.

---

## 14) Team settings surface

**Goal:** Admin control without clutter.

**Scope (MVP):**

- Toggle `allow_swaps`.
- Set `roster_visibility`.

**Acceptance:** Settings persist and change behaviour immediately.

---

## 15) Guardrails & Validation (always on)

- **Requirement match** (ALL_OF/ANY_OF) for all assignment paths.
- **Overlap guard:** DB exclusion constraint on confirmed Assignments per user (account-wide).
- **Capacity guard:** never exceed capacity.
- **Atomicity:** replacements and swaps are transactional.
- **Locks:** advisory locks for apply/swap to avoid races.

**Acceptance:** All paths enforce the same checks; error messages explain why.

---

## 16) Audit & Activity

**Goal:** Traceability for sensitive changes.

**Scope (MVP):**

- Trigger-based `audit_log` for inserts/updates/deletes on key tables.
- Include run IDs (autoschedule) and swap IDs.

**Acceptance:** Each change shows who, what, when, and a concise diff.

---

## 17) Security & RLS (summary)

- Every row carries `account_id` (+ `team_id` for team-scoped tables).
- Read/write gated by account membership; team writes require team scheduler (or account owner/admin).
- No service key in clients; Edge Functions for privileged transactions.

---

## 18) UI Surfaces (minimum)

**Mobile (Expo):**

- Sign in/out
- Account → Team switchers
- **My Roster** (filters: All / by Account / by Team)
- Unavailability editor
- “Can’t make it” (replacement)
- **Swap**: propose/accept from team roster
- Push notifications

**Web (PWA):**

- Sign in & switchers
- **Team roster console**: Requirements, Event Templates, Events, Assignments
- Team settings (`allow_swaps`, `roster_visibility`)
- (If enabled) Swap approvals queue
- Auto-schedule (V1.1): preview/apply/undo

---

## 19) Analytics (minimal)

Track: `sign_in`, `create_team`, `create_requirement`, `grant_user_requirement`,  
`create_event_template`, `generate_events`, `assignment_created`,  
`replacement_opened/claimed/filled`, `swap_requested/accepted/applied`,  
`autoschedule_preview/applied/undo`.

Include: `account_id`, `team_id`, `user_id` (when applicable).

---

## 20) Plans & Limits

**Goal:** Clear packaging without surprise walls.

**Baseline limits by plan:**

- **Active Members** per Account (hard)
- **Teams** per Account (hard)
- Roles/Requirements per Team (soft guidance)
- Scheduler seats: uncapped (reasonable use) within team caps

**Acceptance:** Creating beyond caps shows an upgrade prompt and blocks.

---

## 21) Error message UX (pattern)

- Say **what failed**, **why**, and **how to fix**.  
  Examples:
- “Assignment blocked: requires **First Aid**.”
- “Overlap: already assigned **10:00–12:00** in Youth.”
- “Capacity full: **3/3** already assigned.”
- “Swap requires approval: a scheduler will review.”

---

## 22) Out-of-scope for MVP (parked)

- Calendar sync (Google/Microsoft)
- SMS notifications
- CSV bulk import
- External directory sync (Azure/Google)
- Service-key clients (serverless only via Edge Functions)

---

## 23) Open questions to track

- Do we need strict RLS for `roster_visibility='private'` at MVP, or UI-only first?
- Should swap approval be a separate toggle vs implied by `allow_swaps`?
- Do we expose an “ineligible with reasons” view to schedulers (nice to have)?

---
