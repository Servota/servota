# Privacy & Data Retention — Servota

**Last updated:** 28 August 2025  
**Contact:** support@servota.app

## What Servota is

Servota helps groups (churches, clubs, workplaces, families) run rosters using **Teams**, **Events** (what needs staffing), and flexible **Requirements** (skills/roles/checks). Schedulers create recurring **Event Templates**, generate dated **Events**, assign people who meet the Event’s Requirements, and manage **Unavailability**, **Replacements** (“Can’t make it”), and **Peer-to-Peer Swaps**. Members receive reminders and see a clean **My Roster**.

## What we collect

- **Account & membership info:** account name, Teams, your name, email, account role (`owner`, `admin`) and team role (`scheduler`, `member`), membership status.
- **Roster data:** requirements (team-scoped), user requirements (who holds what), event templates, events, event requirements, assignments, unavailability, replacement requests, swap requests, roster visibility settings, and swap policy (e.g., `allow_swaps`).
- **Notifications:** device push tokens and email addresses to send reminders and offers (e.g., replacements, swaps).
- **Attachments (optional):** files you upload to events (e.g., run sheets). You control what you upload.
- **Payments (if you subscribe):** processed by Stripe (or Paddle). We receive subscription status and identifiers—**never** full card details.
- **Support & diagnostics:** messages you send us (email), and basic event/error logs to keep the app reliable.
- **(V1.1) Autoscheduling:** when enabled, run configurations and results (e.g., proposals and reasons) for auditability.

## How we use your data

- Run core features: requirements-based matching, rostering, replacements, swaps, reminders.
- Enforce guardrails: prevent double-booking/overlaps and respect unavailability and capacity.
- Honour team policies: roster visibility (`team`, `account`, `private`) and swap rules.
- Improve reliability, troubleshoot issues, and provide support.
- Manage billing, account status, and plan limits.

## Where your data lives

We use reputable service providers acting as processors on our behalf:

- **Database & Auth:** Supabase (Postgres, JWT Auth)  
  Data is stored in a Supabase region we choose for the project.
- **Push notifications:** Expo
- **Payments:** Stripe (or Paddle)
- **Email:** Microsoft 365

All data is encrypted **in transit** (HTTPS). Our providers encrypt data **at rest**. Access within Servota is restricted by role and tenant using database **Row Level Security (RLS)**.

## What we don’t do

- We do **not** sell personal data.
- We do **not** run third-party advertising.

## Data retention

| Data category                                                                                                                                              | Retention                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account & roster data (requirements, event templates, events, event requirements, assignments, unavailability, replacement & swap requests, team settings) | Kept while your account is active. If the account owner requests deletion, we delete active data within **30 days**. If a subscription lapses, we suspend access and retain data for **90 days**; after that, we delete it. Backups can persist up to **30 additional days**. |
| Audit & activity logs (incl. autoschedule run metadata)                                                                                                    | Up to **12 months** to investigate issues and security events.                                                                                                                                                                                                                |
| Push tokens                                                                                                                                                | Deleted when you disable notifications or after **12 months** of inactivity.                                                                                                                                                                                                  |
| Attachments                                                                                                                                                | Deleted with their parent event/account under the timelines above.                                                                                                                                                                                                            |
| Support emails                                                                                                                                             | Up to **24 months** to maintain support history.                                                                                                                                                                                                                              |
| Billing records                                                                                                                                            | Kept as required by tax law (typically **7 years**).                                                                                                                                                                                                                          |

## Your choices & rights

- You can access and update your profile, notification preferences, and unavailability.
- Team roster visibility is controlled by your organisation’s policy (`team`, `account`, or `private`).
- Account owners can export or delete their organisation’s data by emailing **support@servota.app**.
- We respond to access or deletion requests within **30 days** (sooner where possible). Rights may vary by region.

## Children

Servota isn’t designed for children to sign up directly. If you use Servota for family or youth rosters, a parent/guardian or organisation leader should manage the account. Avoid entering unnecessary personal information about minors. If you believe a child’s data was provided without appropriate consent, contact us and we’ll remove it.

## Security

- Encryption in transit and at rest (via our providers).
- Tenant isolation with database **RLS**; least-privilege access.
- 2FA on admin accounts; regular dependency and infrastructure updates.

No system is perfectly secure, but we work to protect your data and will notify account owners of any material incidents.

## Changes to this notice

If we make material changes, we’ll update this page and notify account owners in-app or by email.
