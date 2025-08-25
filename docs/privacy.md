# Privacy & Data Retention — Servota

**Last updated:** 24 August 2025  
**Contact:** support@servota.app

## What Servota is
Servota helps groups (churches, clubs, workplaces, families) create rosters, assign eligible people, manage unavailability, and handle replacements with notifications.

## What we collect
- **Account & member info:** account name, your name, email, role, membership status.
- **Roster data:** roles, schedule templates, shifts, assignments, unavailability, replacement requests.
- **Notifications:** device push tokens and email addresses to send reminders and offers.
- **Payments (if you subscribe):** processed by Stripe; we receive subscription status and identifiers (not card details).
- **Support & diagnostics:** messages you send us (email), basic event/error logs to keep the app reliable.

## How we use your data
- Run core features (rosters, eligibility, replacements, reminders).
- Prevent clashes (e.g., overlapping assignments or unavailability).
- Send important notifications and service emails.
- Improve reliability and provide support.
- Manage billing and account status.

## Where your data lives
We use reputable service providers acting as processors on our behalf:
- **Database & auth:** Supabase (Postgres, JWT auth)
- **Push notifications:** Expo
- **Payments:** Stripe
- **Email:** Microsoft 365

Data is encrypted in transit (HTTPS). Our providers encrypt data at rest. Access within Servota is restricted by role and tenant (Row Level Security).

## What we don’t do
- We do **not** sell personal data.
- We do **not** run third-party advertising.

## Data retention

| Data category | Retention |
| --- | --- |
| Account & roster data (roles, shifts, assignments, unavailability, replacement requests) | Kept while your account is active. If the account owner requests deletion, we delete active data within **30 days**. If a subscription lapses, we suspend access and retain data for **90 days**; after that, we delete it. Backups can persist up to **30 additional days**. |
| Audit & activity logs | Up to **12 months** to investigate issues and security events. |
| Push tokens | Deleted when you disable notifications or after **12 months** of inactivity. |
| Support emails | Up to **24 months** to maintain support history. |
| Billing records | Kept as required by tax law (typically **7 years**). |

## Your choices & rights
- You can access and update your profile.
- Account owners can export or delete their organisation’s data by emailing **support@servota.app**.
- We respond to access or deletion requests within **30 days** (sooner where possible). Rights may vary by region.

## Children
Servota isn’t designed for children to sign up directly. If you use Servota for family rosters, a parent/guardian should manage the account. Please avoid entering unnecessary personal information about minors. If you believe a child’s data was provided without consent, contact us and we’ll remove it.

## Security
- Encryption in transit and at rest (via our providers).
- Tenant isolation using database Row Level Security.
- Least-privilege access and 2FA on admin accounts.

No system is perfectly secure, but we work to protect your data and will notify account owners of any material incidents.

## Changes to this notice
If we make material changes, we’ll update this page and notify account owners in-app or by email.
