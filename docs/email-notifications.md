Email Notifications And Templates

concise “how it’s built” brief

Create/overwrite this file exactly:

docs/notification-build-plan.md

# Notifications (V1) — Implementation Brief

**Status:** Complete (V1).  
**Scope:** Info-only emails via Resend + in-app notifications. No interactive email CTAs in V1.

---

## 1) What Happens End-to-End

1. **Producers** (DB triggers/RPCs/app code) call the **`notify` Edge Function** with one or more “items”.
2. `notify` **inserts** rows into `public.notifications` with `status='queued'` and a concrete `scheduled_at`.
3. `notify` immediately **renders and sends** an **info-only** email per row using **file-based HTML templates**, then:
   - updates that row to `status='sent'`, sets `sent_at`, and bumps `attempts`, or
   - updates to `status='error'` and writes `last_error`.
4. **In-app UIs** read from `public.notifications` for the user’s list, actions, and read/outcome chips.

> Result: A single, branded info email + an actionable in-app notification. No duplicate emails.

---

## 2) Components

- **Edge Function: `notify`**  
  Path: `supabase/functions/notify/index.ts`  
  Responsibilities:
  - Accept JSON payload `{ items: [...] }`
  - Insert rows into `public.notifications`
  - Load an HTML template from disk (file-based)
  - Send via **Resend**
  - Mark the row `sent`/`error` _(prevents dispatcher from re-sending)_

- **Email Templates (file-based)**  
  Path: `supabase/functions/_shared/email/`  
  Files:
  - `swap_requested.html`
  - `swap_accepted.html`
  - `swap_declined.html`
  - `replacement_opened.html`
  - `replacement_claimed.html`
  - `invite_account.html`
  - `invite_team.html`

- **Dispatcher (kept for future)**  
  Function: `supabase/functions/notif_dispatcher/index.ts`  
  Still reads `v_notifications_pending` but **rows sent by `notify` won’t be re-sent**, because `notify` marks them `sent`.

---

## 3) Payload Contract (`notify`)

Callers post an array of `items`. Minimal shape:

```json
{
  "items": [{
    "user_id": "UUID of recipient",
    "to_email": "recipient@example.com",
    "type": "swap_requested",
    "title": "Swap Request",
    "data": {
      // Per-type keys (see below)
    },
    "account_id": "UUID (optional)",
    "team_id": "UUID (optional)",
    "scheduled_at": "ISO string (optional; defaults to now)"
  }]
}


Common types & data keys (V1):

swap_requested: to_label, from_date, to_date

swap_accepted: actor_name, event_date

swap_declined: actor_name

replacement_opened: event_title, event_date, actor_name

replacement_claimed: event_title, event_date, actor_name

invite_account: account_name

invite_team: account_name, team_name

Keep these keys consistent so templates can render without DB lookups.

4) How Templates Are Chosen & Rendered

notify/index.ts maps row.type → template file name.

Template engine is a minimal string replacer: {{placeholder}} → context value.

Subject line comes from row.title.

A hosted logo is used in a small HTML shell:

URL: https://img1.wsimg.com/isteam/ip/8e752928-d113-4594-9166-4e9d6125cbf6/servota-logo.png/:/rs=h:175,m

Height is controlled inline on the <img> tag.

Editing a template (no code changes required):

Open the file under supabase/functions/_shared/email/…html.

Edit the HTML + placeholders (e.g., {{event_title}}).

Commit & deploy the notify function (see Deployment).

Adding a new notification type:

Add a new *.html file to supabase/functions/_shared/email/.

In notify/index.ts, add a case in templateMap() returning { name, ctx, subject }.

Ensure your producers send the required keys in data.

Commit & deploy.

5) Database & Status

Table: public.notifications

Key fields used in V1:

user_id, type, title, body, data jsonb, channel, status,

scheduled_at, sent_at, attempts, last_error

Lifecycle (V1 via notify):

Insert as queued → email send → update to sent or error.

Because notify sets status to sent/error, the dispatcher (if running) won’t send duplicates.

6) Environment & Secrets (servota-dev / servota-prod)

PROJECT_URL — Supabase URL

SERVICE_ROLE_KEY — Supabase service role JWT (used by notify)

EMAIL_FROM — e.g., Servota <no-reply@yourdomain>

EMAIL_PROVIDER — resend

RESEND_API_KEY — Resend API key

(Optional) ACTIONS_BASE_URL / ACTIONS_HMAC_SECRET — kept for future interactive CTAs; not used in V1 emails.

Per-function config:

supabase/functions/notify/supabase.toml

[functions]
verify_jwt = false


We invoke with an API key header in CI or via service role for tests.

7) Deployment

Deploy only the notify function:

supabase functions deploy notify --project-ref <PROJECT_REF>

8) Testing (quick curl)

Service role invoke (dev):

set SB_SERVICE=<SERVICE_ROLE_KEY>
curl -i https://<PROJECT_REF>.functions.supabase.co/notify ^
  -H "Content-Type: application/json" ^
  -H "apikey: %SB_SERVICE%" ^
  -H "Authorization: Bearer %SB_SERVICE%" ^
  -d "{\"items\":[{\"user_id\":\"<UUID>\",\"to_email\":\"you@example.com\",\"type\":\"swap_requested\",\"title\":\"Swap Request Test\",\"data\":{\"to_label\":\"Sunday Service\",\"from_date\":\"2025-11-05T10:00:00Z\",\"to_date\":\"2025-11-12T10:00:00Z\"}}]}"


Verify:

Row appears in public.notifications with status='sent'.

Email arrives with correct template content.

9) Troubleshooting

401 Unauthorized: Pass apikey and Authorization: Bearer headers (anon/service JWT). Confirm supabase/functions/notify/supabase.toml has [functions] verify_jwt=false and redeploy.

500 / NOT NULL on scheduled_at: Ensure notify sets a default (code already defaults to now()).

Duplicate emails: Confirm notify updates the row to sent. Dispatcher will ignore non-queued rows.

Template didn’t update: Make sure you committed the HTML file and redeployed notify.
```
