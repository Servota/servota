/* apps/web/src/member/NotificationsPanel.tsx */
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  channel: string;
  status: string; // 'queued' | 'sent' | 'error' | 'read'
  attempts: number;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function NotificationsPanel({ onClose }: { onClose?: () => void }) {
  // Cast to any so we can call newly-added RPCs before codegen/types are updated.
  const supabase = useMemo(() => getBrowserSupabaseClient() as unknown as any, []);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('list_my_notifications', {
      p_limit: 50,
      p_since: null,
    });
    if (error) {
      setError(String(error.message || error));
    } else {
      setItems((data as NotificationRow[]) || []);
    }
    setLoading(false);
  }

  async function markRead(id: string) {
    setMarking(id);
    const { data, error } = await supabase.rpc('mark_notification_read', { p_id: id });
    if (error) {
      console.warn('mark_notification_read failed', error);
    } else if (data === true) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: 'read', updated_at: new Date().toISOString() } : n
        )
      );
    }
    setMarking(null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/10">
      <div className="w-[420px] max-w-[92vw] bg-white border border-[#e5e7eb] rounded-[12px] shadow-md">
        <div className="flex items-center justify-between p-3 border-b border-[#e5e7eb]">
          <div className="font-bold">Notifications</div>
          <div className="flex items-center gap-2">
            <button
              className="sv-icon-btn-ghost"
              title="Refresh"
              onClick={load}
              aria-label="Refresh notifications"
            >
              ⟳
            </button>
            <button
              className="sv-icon-btn"
              onClick={onClose}
              aria-label="Close notifications"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-3">
          {loading && <div className="sv-meta">Loading...</div>}
          {error && (
            <div className="sv-card p-3 bg-red-50 border-red-200 text-red-800">
              Failed to load: {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="sv-meta">You have no notifications yet.</div>
          )}

          <ul className="flex flex-col gap-2">
            {items.map((n) => (
              <li key={n.id} className={`sv-card p-3 ${n.status === 'read' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          n.status === 'read' ? 'bg-gray-300' : 'bg-sky-500'
                        }`}
                        aria-hidden
                      />
                      <div className="font-semibold truncate">{n.title}</div>
                    </div>
                    <div className="sv-meta mt-1 whitespace-pre-wrap break-words">{n.body}</div>
                    <div className="sv-meta mt-2">
                      <strong>Type:</strong> {n.type} · <strong>Channel:</strong> {n.channel}
                    </div>
                    <div className="sv-meta">
                      <strong>Created:</strong> {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {n.status !== 'read' ? (
                      <button
                        className="sv-btn"
                        onClick={() => markRead(n.id)}
                        disabled={marking === n.id}
                      >
                        {marking === n.id ? 'Marking…' : 'Mark read'}
                      </button>
                    ) : (
                      <span className="sv-meta">Read</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
