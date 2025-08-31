# Servota DB — Quick Guide (Dev)

This is the fast orientation for future collaborators (and future GPTs). It summarises the schema, key constraints, and the critical RPCs + how to test them.

---

## Enums

- `notification_channel`: `('push','email')`
- `notification_status`: `('queued','sending','sent','failed','cancelled')`
- `push_token_status`: `('active','revoked')`

---

## Key tables (new in Phase 3)

- **push_tokens**  
  `id, user_id, token, platform, device_info, status, last_seen, created_at, updated_at`  
  RLS: users can CRUD their own tokens.

- **notifications**  
  `id, account_id?, team_id?, user_id, type, title, body, data, channel, status, attempts, scheduled_at, sent_at, last_error, created_by, created_at, updated_at`  
  RLS: users can read **their own** notifications.  
  View: `v_notifications_pending` (queued & due).

- **swap_requests** _(existing from schema)_  
  Lifecycle for `status`: `pending → accepted|declined|expired → applied`

---

## Important constraint

- **assignments** has a **unique (event_id, user_id)** that is **DEFERRABLE INITIALLY DEFERRED** so two-row **swaps** can update atomically.

---

## RPCs / Functions (public schema)

### Notifications

- `register_push_token(token text, platform text?, device_info text?) → push_tokens`  
  Upserts a device token for the **current user** (RLS enforced).

- `enqueue_notification(user_id uuid, channel notification_channel, type text, title text, body text, data jsonb?, account_id uuid?, team_id uuid?, scheduled_at timestamptz?) → notifications`  
  For Edge Functions / service-role only. Queues a notification.

### Replacement flow

- `fn_claim_replacement(replacement_request_id uuid, claimant_user_id uuid?) → assignments`  
  Advisory lock on request; validates **requirements / unavailability / overlaps / capacity**; unassigns requester; inserts claimant (`source='replacement'`); closes request; **enqueues notifications** to claimant + requester.

### Swap flow

- `propose_swap(from_assignment_id uuid, to_assignment_id uuid, message text?) → swap_requests`  
  Same event; requester must be the **from_user**; team allows swaps; future event; dedupes pending pair; **enqueues `swap_requested`** to recipient.

- `respond_swap(swap_request_id uuid, action 'accept'|'decline') → swap_requests`  
  Recipient-only; future event; team allows swaps; handles expiry; **enqueues `swap_accepted` / `swap_declined`**.

- `apply_swap(swap_request_id uuid) → swap_requests`  
  Allowed roles: **from_user**, **to_user**, **team scheduler**, or **account owner/admin**.  
  Advisory lock; revalidates requirements & unavailability; **atomically exchanges** `assignments.user_id` on both rows (single UPDATE; constraint deferrable); marks applied; **enqueues `swap_applied`** to both.

---

## Edge Functions

- **billing_webhook** (Stripe)  
  Verifies signatures (`constructEventAsync`), maps events → `accounts.status`:
  - `checkout.session.completed`, `invoice.paid` → `active`
  - `invoice.payment_failed`, `customer.subscription.deleted` → `suspended`
  - `customer.subscription.updated` → active/suspended based on subscription status

- **notif_dispatcher**  
  Uses service role; pulls `v_notifications_pending`, (simulates) sends push/email, marks **sent/failed**.  
  **Scheduled every minute** via `pg_cron` + `pg_net` HTTP POST to the function URL.

---

## Test snippets (SQL)

**Impersonate a user (RLS):**

```sql
select set_config(
  'request.jwt.claims',
  json_build_object('sub','<USER_ID>','role','authenticated')::text,
  true
);

Register a push token for current user:

select public.register_push_token('ExponentPushToken[dev-123]','ios','device:sim');


Enqueue a notification:

select public.enqueue_notification('<USER_ID>','push','test','Hello','Body', jsonb_build_object('k','v'));


Replacement claim (example):

select * from public.fn_claim_replacement('<REPLACEMENT_REQUEST_ID>'::uuid, '<CLAIMANT_USER_ID>'::uuid);


Swap (example flow):

-- propose
select * from public.propose_swap('<FROM_ASSIGNMENT_ID>'::uuid, '<TO_ASSIGNMENT_ID>'::uuid, 'pls swap');
-- respond (recipient)
select * from public.respond_swap('<SWAP_REQUEST_ID>'::uuid, 'accept');
-- apply (recipient / scheduler / owner|admin)
select * from public.apply_swap('<SWAP_REQUEST_ID>'::uuid);

## What to share with future GPTs/devs
- `/supabase/migrations/` (all) — source of truth
- `docs/schema-from-migrations.sql` — concatenated migrations (readable snapshot)
- `packages/shared/src/types/supabase.ts` — generated TS types for clients
- `docs/db-readme.md` — orientation & cheat-sheet
```
