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
  read_at?: string | null;
};

export default function NotificationsPanel({ onClose }: { onClose?: () => void }) {
  const supabase = useMemo(() => getBrowserSupabaseClient() as unknown as any, []);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null); // for Accept/Decline
  const [showRead, setShowRead] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('list_my_notifications', {
      p_limit: 50,
      p_since: null,
    });
    if (error) setError(String(error.message || error));
    else setItems((data as NotificationRow[]) || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    setMarking(id);
    const { data, error } = await supabase.rpc('mark_notification_read', { p_id: id });
    if (!error && data === true) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                status: 'read',
                updated_at: new Date().toISOString(),
                read_at: new Date().toISOString(),
              }
            : n
        )
      );
    } else if (error) {
      console.warn('mark_notification_read failed', error);
    }
    setMarking(null);
  }

  // ---------- helpers aligned with mobile ----------
  const isSwapRequest = (n: NotificationRow) => {
    const d = (n.data || {}) as any;
    const hasReq = d?.request_id || d?.swap_request_id || d?.p_request_id;
    return /^swap_requested$/i.test(n.type) && !!hasReq;
  };
  const getSwapRequestId = (n: NotificationRow): string | null => {
    const d = (n.data || {}) as any;
    return d?.request_id || d?.swap_request_id || d?.p_request_id || null;
  };
  const isSwapOutcome = (n: NotificationRow) =>
    /^swap_accepted$/i.test(n.type) || /^swap_declined$/i.test(n.type);

  const isReplacementRequest = (n: NotificationRow) => {
    const d = (n.data || {}) as any;
    const hasId = d?.replacement_request_id || d?.request_id || d?.p_replacement_request_id;
    return /replacement/i.test(n.type || '') && !!hasId && !/claimed|filled/i.test(n.type);
  };
  const isReplacementOutcome = (n: NotificationRow) =>
    /^replacement_(claimed|filled)$/i.test(n.type);

  // chips on read original request only
  const swapOutcomeChip = (n: NotificationRow) => {
    const isRead = n.status === 'read' || !!n.read_at;
    if (!isRead || !isSwapRequest(n)) return null;
    const outcome = ((n.data || {}) as any)?.outcome;
    if (outcome === 'accept') return 'Accepted';
    if (outcome === 'decline') return 'Declined';
    return null;
  };
  const replacementOutcomeChip = (n: NotificationRow) => {
    const isRead = n.status === 'read' || !!n.read_at;
    if (!isRead || !isReplacementRequest(n)) return null;
    const outcome = ((n.data || {}) as any)?.outcome;
    if (outcome === 'claim') return 'Claimed';
    if (outcome === 'ignore') return 'Ignored';
    return null;
  };

  const outcomeText = (n: NotificationRow) => {
    const data = (n.data || {}) as any;
    const actor = data?.actor_name || 'member';
    if (isSwapOutcome(n)) {
      if (n.type === 'swap_accepted') return `Your swap request has been accepted by ${actor}.`;
      if (n.type === 'swap_declined') return `Your swap request has been declined by ${actor}.`;
    }
    if (isReplacementOutcome(n)) {
      if (n.type === 'replacement_claimed') return `${actor} has claimed your replacement request.`;
      if (n.type === 'replacement_filled') return `Your replacement request has been filled.`;
    }
    return null;
  };

  const headerTitle = (n: NotificationRow) => {
    if (isSwapRequest(n)) return 'Swap Request';
    if (isSwapOutcome(n)) return n.type === 'swap_accepted' ? 'Swap Accepted' : 'Swap Declined';
    if (isReplacementRequest(n)) return 'Replacement Request';
    if (isReplacementOutcome(n))
      return n.type === 'replacement_claimed' ? 'Replacement Claimed' : 'Replacement Filled';
    return n.title;
  };

  // ---------- actions (Accept / Decline) ----------
  async function acceptSwap(n: NotificationRow) {
    const reqId = getSwapRequestId(n);
    if (!reqId) return;
    try {
      setWorkingId(n.id);
      const { error } = await supabase.rpc('accept_and_apply_swap', { p_swap_request_id: reqId });
      if (error) throw error;

      // Persist outcome chip and mark read
      await supabase.rpc('mark_notification_outcome', { p_id: n.id, p_outcome: 'accept' });
      setItems((prev) =>
        prev.map((m) =>
          m.id === n.id
            ? {
                ...m,
                status: 'read',
                read_at: new Date().toISOString(),
                data: { ...(m.data || {}), outcome: 'accept' },
              }
            : m
        )
      );
    } catch (e: any) {
      alert(`Failed: ${String(e?.message ?? e)}`);
    } finally {
      setWorkingId(null);
    }
  }

  async function declineSwap(n: NotificationRow) {
    const reqId = getSwapRequestId(n);
    if (!reqId) return;
    try {
      setWorkingId(n.id);
      const { error } = await supabase.rpc('respond_cross_date_swap', {
        p_swap_request_id: reqId,
        p_action: 'decline',
      });
      if (error) throw error;

      // Persist outcome chip and mark read
      await supabase.rpc('mark_notification_outcome', { p_id: n.id, p_outcome: 'decline' });
      setItems((prev) =>
        prev.map((m) =>
          m.id === n.id
            ? {
                ...m,
                status: 'read',
                read_at: new Date().toISOString(),
                data: { ...(m.data || {}), outcome: 'decline' },
              }
            : m
        )
      );
    } catch (e: any) {
      alert(`Failed: ${String(e?.message ?? e)}`);
    } finally {
      setWorkingId(null);
    }
  }

  // hide read by default
  const visibleItems = showRead
    ? items
    : items.filter((n) => !(n.status === 'read' || !!n.read_at));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/10">
      <div className="w-[420px] max-w-[92vw] bg-white border border-[#e5e7eb] rounded-[12px] shadow-md">
        <div className="flex items-center justify-between p-3 border-b border-[#e5e7eb]">
          <div className="font-bold">Notifications</div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showRead}
                onChange={(e) => setShowRead(e.target.checked)}
              />
              Show read
            </label>

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

          {!loading && !error && visibleItems.length === 0 && (
            <div className="sv-meta">
              {showRead ? 'No notifications.' : 'No unread notifications.'}
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {visibleItems.map((n) => {
              const isRead = n.status === 'read' || !!n.read_at;
              const chip = swapOutcomeChip(n) || replacementOutcomeChip(n);
              const text = outcomeText(n);

              return (
                <li key={n.id} className={`sv-card p-3 ${isRead ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isRead ? 'bg-gray-300' : 'bg-sky-500'
                          }`}
                          aria-hidden
                        />
                        <div className="font-semibold truncate">{headerTitle(n)}</div>
                      </div>

                      <div className="sv-meta mt-1 whitespace-pre-wrap break-words">
                        {text || n.body}
                      </div>

                      <div className="sv-meta mt-2">
                        <strong>Created:</strong> {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {/* badge for read original request */}
                      {chip && (
                        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-bold">
                          {chip}
                        </span>
                      )}

                      {/* actions: swap request only, unread (mobile-style buttons) */}
                      {!isRead && isSwapRequest(n) && (
                        <div className="flex flex-col gap-2 items-stretch">
                          <button
                            onClick={() => acceptSwap(n)}
                            disabled={workingId === n.id}
                            aria-label="Accept swap request"
                            title="Accept"
                            className={[
                              'min-w-[96px] px-3 py-2 rounded-[10px] text-sm font-bold transition-colors',
                              'text-white bg-emerald-600 hover:bg-emerald-700',
                              workingId === n.id
                                ? 'opacity-60 cursor-not-allowed hover:bg-emerald-600'
                                : '',
                            ].join(' ')}
                          >
                            {workingId === n.id ? 'Working…' : 'Accept'}
                          </button>

                          <button
                            onClick={() => declineSwap(n)}
                            disabled={workingId === n.id}
                            aria-label="Decline swap request"
                            title="Decline"
                            className={[
                              'min-w-[96px] px-3 py-2 rounded-[10px] text-sm font-bold transition-colors',
                              'text-white bg-red-600 hover:bg-red-700',
                              workingId === n.id
                                ? 'opacity-60 cursor-not-allowed hover:bg-red-600'
                                : '',
                            ].join(' ')}
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {/* fallback mark read */}
                      {!isRead && !isSwapRequest(n) && (
                        <button
                          className="sv-btn"
                          onClick={() => markRead(n.id)}
                          disabled={marking === n.id}
                        >
                          {marking === n.id ? 'Marking…' : 'Mark read'}
                        </button>
                      )}

                      {isRead && <span className="sv-meta">Read</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
