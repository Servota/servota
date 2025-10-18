# Servota — Universal Action Links (UAL) Build Plan

**Last updated:** 18 Oct 2025

---

## 0) Why this exists

### The problem we hit

Supabase’s stock auth emails (magic link / confirmation) are not designed for business notifications like account invites, swap requests, approvals, acknowledgements, etc.  
We need every important event to trigger:

- (a) an in-app notification, and
- (b) a branded email that lets the recipient take the action quickly on phone or desktop.

We also need per-email customisation (e.g. “You’ve been invited to join Acme”) and multiple action types — not just “log in”.

### What we’re building

A universal pattern where every notification produces a DB notification row (for the in-app feed) and a signed action link in an email.  
The link opens a tiny branded **Actions Gateway** page that verifies the request and either executes the action (accept/decline/acknowledge) or prompts the user to sign in and confirm, then executes.  
One link works on Windows desktop (packaged PWA), mobile, and browser.

---

## 1) Constraints & decisions

- **No hosted web-app requirement.**  
  Email CTAs point to a Supabase Edge Function that returns a small HTML page (the **Actions Gateway**).  
  That page verifies the link, executes or prompts sign-in + confirm, and tries to open the Windows packaged PWA via a custom protocol (`servota://a/<token>`) or the mobile app scheme (e.g. `servota-mobile://a/<token>`).  
  If that fails, it stays on the HTML page and completes there.

- **Links never “die”.**  
  The email contains a long-lived locator token. On click, the gateway mints a short-lived action token (15–30 minutes) for actual execution.  
  If the user is cold (days later), the page simply asks them to sign in and confirm first; then it mints a fresh action token and proceeds.

- **Supabase Auth is auth-only.**  
  Business notifications (invites, swaps, approvals, etc.) are sent via a transactional email provider (Postmark / Resend) so we can fully customise templates and variables.

- **Security first.**  
  Short-TTL execution tokens, single-use (`jti`) tracking, permission checks against the signed-in user, and all writes through RPC/SQL under RLS.

---

## 2) Architecture (bird’s-eye)

### Components

**Email service:** Postmark or Resend for templated, branded transactional emails.  
**Edge Functions:**

- `notify`: creates notification rows and sends emails with a signed locator token embedded in the CTA URL.
- `actions` (HTML gateway): verifies the locator token, mints a short-lived action token, authorises, executes (or asks to confirm) and renders a branded result page.

**Canonical Gateway URL:**  
All CTAs point to the Actions Edge Function URL, e.g.  
`https://<project>.functions.supabase.co/actions?t=<locator>`

**Apps:**

- Windows packaged PWA: registers a protocol handler (`servota://`) so the gateway can deep-link into the installed app; otherwise it stays on the HTML page.
- Mobile app: later, add Universal/App Links; until then the HTML page is the universal fallback.
- Notifications screen in both apps: reads the notifications table (list, open, mark read).

### Data model additions (described, not SQL)

`notifications`: id, user_id, account_id, type (invite, swap_requested, …), payload (context for rendering), status (unread/read/archived), created_at.  
`action_tokens_used`: jti, used_at — prevents replay.  
Existing domain tables remain the source of truth (e.g., `account_memberships`, `swap_requests`).  
Invite acceptance already exists as an RPC that flips `account_memberships.status` from invited → active.  
➡️ **Index** on `(user_id, status, created_at DESC)` keeps the feed fast.  
➡️ **Periodic cleanup** of `action_tokens_used` (e.g. delete >90 days old) keeps it small.

---

## 3) Tokens (what’s in the link?)

**Locator vs Action:** two-token model so email links work indefinitely, while execution stays short-lived and secure.

### Locator token (in the email URL; non-executing)

Identifies the action and intended user. HMAC-signed; contains:

- unique id (jti)
- subject (prefer `user_id`; fall back to `email` only when the user doesn’t exist yet and a “user not found” message is intended)
- type (invite_accept / invite_decline / swap_accept / swap_decline / acknowledge / open)
- account_id
- optional team_id / resource_id
- issued_at  
  Used only to look up and stage the action — never to mutate data.

### Action token (server-issued, short TTL; executes)

Minted by the **Actions Gateway** at click/sign-in time.  
Contains jti, the same action fields, and a short expiry.  
The signed-in user must match the token’s subject before any mutation occurs.  
One-time use is enforced on the server.  
➡️ **Support HMAC key rotation:** include a `kid` (key id) header; keep old keys for a short grace period.

### Graceful “expiry”

Email links never expire.  
If the session is fresh and the action is safe, we execute immediately (fast path).  
If not, we prompt sign-in and a quick confirm, then mint a new short-lived action token and execute.

---

## 4) Email behaviour

All business emails go via the transactional provider with variables like `accountName`, `requesterName`, `shiftDate` / `shiftTime`, and `ctaUrl`.

**Subject examples**

- Invite: `[Servota] You’ve been invited to join {{accountName}}`
- Swap: `[Servota] Swap request from {{requesterName}} — {{shiftDate}} {{shiftTime}}`

The CTA points to the canonical Actions Gateway URL with the locator token (`?t=<locator>`).  
The gateway returns a small branded page that verifies the link, attempts to open the packaged Windows app (`servota://a/<token>`) or the mobile app scheme, displays Accept / Decline / Acknowledge when needed, and always offers a “Continue in browser” fallback.

---

## 5) Security

- **Signing.** HMAC secret for both token types (verification in the gateway).
- **Single-use.** Record the jti before executing; replays are rejected cleanly.
- **Authorisation.** The signed-in user must match the token subject; all writes go through RPC/SQL under RLS.
- **RLS reminder.** RLS on `notifications` ensures only the intended user can read their items.
- **Audit.** Log who / what / when for each action (include account_id, resource_id, jti).
- **Rate limiting / abuse.** The `actions` function rate-limits by IP + user and logs denials.
- **Resilience.** Invalid / expired / used tokens show friendly error and a safe retry (sign-in → confirm).
- **Return-to behaviour.** After sign-in, the Gateway redirects or shows a result page to avoid dead ends.

---

## 6) Windows PWA & mobile deep linking

**Windows packaged PWA.**  
Register a protocol handler (`servota://`). The gateway first tries `servota://a/<token>`; if the app is present, Windows opens it with the payload.  
If not, the gateway stays on its HTML page and completes the flow there.

**Mobile.**  
Add Universal/App Links for `servota.app/a/*` later.  
Until then, the HTML gateway page is the universal fallback and works on every device.

---

## 7) Phased implementation (narrative)

**Phase 0 — Bootstrap**  
Pick the email provider; add Edge secrets (`ACTION_SECRET`, provider API key, `EMAIL_FROM`, `APP_ORIGIN`, project URL/keys).  
Capture this plan in `docs/notification-build-plan.md`.

**Phase 1 — DB & RPCs**  
Create `notifications` and `action_tokens_used` with RLS.  
Ensure the invite acceptance RPC exists (`invited → active`).  
Stub swap accept/decline RPCs to call later from the gateway.

**Phase 2 — Edge: notify**  
Accept a structured payload (type, actor, target recipients, account, resource ids, template variables).  
For each recipient, insert a notification, sign a locator token, and send a templated email with the CTA.

**Phase 3 — Edge: actions (HTML gateway)**  
Verify the locator token.  
If there’s a valid session and the action is safe, mint an action token and execute, showing a result page.  
Otherwise show a short sign-in + confirm UI, then execute.  
Enforce single-use and attempt deep-link to the packaged PWA; always provide a browser fallback.

**Phase 4 — PWA**  
Add a minimal Notifications page (list, open, mark read) and a header entry point.

**Phase 5 — Mobile**  
Add a deep-link receiver for `servota://a/<token>` and a simple Notifications list mirroring the web.

**Phase 6 — Templates**  
Create templates for Invite (Accept / Decline) and Swap (Accept / Decline) with variables and map them in the `notify` function.

**Phase 7 — QA & rollout**  
Unit test token verification, permission checks, single-use, and action idempotency.  
Run end-to-end flows (invite accept/decline, swap accept/decline, acknowledge).  
Test Windows protocol activation; add iOS/Android app links later.

---

## 8) Template / content notes

- **Tone:** action-first, clear and concise
- **Personalisation:** include `accountName` and relevant context (team, shift, requester)
- **Accessibility:** button labels mirror link purpose; include an alternate plain URL
- **Headers:** From `hello@servota.app`, Reply-To `support@servota.app`
- **Footer:** reassurance (“If you didn’t expect this, ignore it”)
- **Bounce / complaint handling:** Postmark/Resend webhooks should flag the user/email and surface a soft warning in the UI if deliveries start failing.

---

## 9) Acceptance criteria

- Email CTA on phone or desktop leads to a clear outcome (done) or a short sign-in → confirm → done flow.
- Invites flip `account_memberships.status` from invited → active only after explicit acceptance, and support explicit decline path.
- Swap emails allow Accept/Decline via email or in-app, and the app reflects the result.
- Notifications list mirrors email activity; mark-as-read works.
- Execution tokens are short-lived, single-use, and permission-checked.
- No public web hosting required; the Actions Gateway serves the HTML.
- Return-to behaviour confirmed: post-action redirects or result screen shown.

---

## 10) Risks & mitigations

- **Deliverability:** Set SPF/DKIM; monitor bounces; consider dedicated IP later.
- **Replay/forgery:** Single-use jti + HMAC + short action TTL, plus user/session checks.
- **Install gaps:** Protocol attempts first; clear “Continue in browser” fallback if the app isn’t installed.
- **Scope sprawl:** Add new notification types via a small handler map; keep flows uniform.

---

## 11) Current status (to update as we work)

Planning → Provider Selection → Schema & RLS → Notify → Actions Gateway → PWA Notifications → Mobile Deep Links → Email Templates → QA.

---

## 12) Status / Checklist (tick as you go)

### Phase 0 — Bootstrap

- [ ] Add this plan to `docs/notification-build-plan.md`
- [ ] Choose email provider (Postmark or Resend)
- [ ] Configure Edge secrets: `ACTION_SECRET`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `APP_ORIGIN`, `PROJECT_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY`

### Phase 1 — DB & RPCs

- [ ] Create `notifications` and `action_tokens_used` with RLS
- [ ] Ensure invite acceptance RPC exists (`invited → active`)
- [ ] Stub swap accept/decline RPCs

### Phase 2 — Edge: notify

- [ ] Insert notifications, sign locator tokens, send templated emails per recipient

### Phase 3 — Edge: actions (HTML gateway)

- [ ] Verify locator; mint action token; execute or prompt sign-in + confirm
- [ ] Enforce single-use; attempt deep-link; provide browser fallback

### Phase 4 — PWA

- [ ] Notifications page (list / open / mark read) + header entry

### Phase 5 — Mobile

- [ ] Deep-link receiver for `servota://a/<token>`
- [ ] Notifications list v1

### Phase 6 — Templates

- [ ] Invite (Accept / Decline) and Swap (Accept / Decline) templates created and mapped (variables + template IDs)

### Phase 7 — QA & rollout

- [ ] Token, permission, and idempotency tests
- [ ] End-to-end flows (invite, swap, acknowledge)
- [ ] Windows protocol activation test (later: iOS/Android app links)
