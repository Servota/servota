// apps/web/src/member/MyUnavailability.tsx
import React from 'react';

/**
 * Member-facing Unavailability page (web)
 * Goal: align with mobile’s MyUnavailability but in a web-friendly layout.
 * NOTE: placeholder only — we’ll hook Supabase data later.
 */
export default function MyUnavailability() {
  return (
    <section className="max-w-4xl mx-auto mt-6 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Unavailability</h2>
        <div className="text-sm opacity-80">Block out times you can’t serve</div>
      </header>

      <div className="rounded-2xl border border-border shadow-soft bg-surface-card p-4">
        <p className="opacity-80">
          This page will let you add, edit, and delete blackout dates/times.
        </p>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="text-sm opacity-70">No unavailability set yet.</div>
        </div>
      </div>
    </section>
  );
}
