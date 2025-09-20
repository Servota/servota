// apps/web/src/member/MyRoster.tsx
import React from 'react';

/**
 * Member-facing Roster page (web)
 * Goal: visually align with mobile MyRoster, but keep layout web-friendly.
 * NOTE: This is a placeholder that compiles. We'll wire real data next.
 */
export default function MyRoster() {
  return (
    <section className="max-w-4xl mx-auto mt-6 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Roster</h2>
        <div className="text-sm opacity-80">Coming soon: filters (All / Account / Team)</div>
      </header>

      <div className="rounded-2xl border border-border shadow-soft bg-surface-card p-4">
        <div className="opacity-80">
          This is your roster page on web. We’ll mirror mobile’s structure:
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Upcoming assignments (list or compact month grid)</li>
            <li>Tap an item → details screen</li>
            <li>
              Actions like “Can’t make it” (replacement) and “Propose swap” (when team allows)
            </li>
          </ul>
        </div>
        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="text-sm opacity-70">No assignments to show yet.</div>
        </div>
      </div>
    </section>
  );
}
