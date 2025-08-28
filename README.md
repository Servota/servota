# Servota

Simple, team-based rostering with requirements-based matching, swaps, and painless replacements.

## Audience & Promise

For volunteer groups and shift-based teams—churches, clubs, workplaces, and families—**Servota** gives you a clear roster in minutes and makes coverage simple.

Define flexible **Requirements** (e.g., Communion Leader, WWCC), create **Event Templates** (weekly/fortnightly/monthly), generate dated **Events**, and assign only people who **meet the Event’s Requirements**, are **available**, and **don’t overlap**. Members get a clean **My Roster** and can mark **Unavailability**; schedulers work in a fast team console with built-in guardrails.

- **Fast setup, zero fuss:** Requirements → Event Templates → Events → Assign.
- **Requirements-based matching:** Only users who meet an Event’s Requirements appear as candidates.
- **Painless replacements:** Tap **“Can’t make it”**; eligible team members are notified and the **first to accept** is auto-assigned.
- **Peer-to-peer swaps:** Propose a swap with someone on the **same future Event**; optional approval by a scheduler.
- **No double-bookings:** Account-wide overlap guard, capacity checks, and unavailability enforcement.
- **Auto-scheduling (V1.1):** Team-scoped **Preview → Apply → Undo** with fairness rules and caps.

## Docs

- [Details (architecture, data model, UX)](./details.md)
- [Step-by-Step Plan](./plan.md)
- [Feature Reference](./features.md)
- [Privacy & Data Retention](./docs/privacy.md)

## Monorepo (pnpm workspaces)

/apps/web # React PWA (Vite)
/apps/mobile # Expo (Phase 5)
/packages/ui # shared UI
/packages/shared# shared types/utils
/supabase # migrations, seeds, policies, functions

## Dev Quick Start

```bash
pnpm install
pnpm dev:web

Open the printed local URL. Pre-commit hooks handle lint/format; GitHub Actions runs lint + typecheck on every push/PR.
```
