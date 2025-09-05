// apps/mobile/src/api/swaps.ts
import { supabase } from '../lib/supabase';

/** Other people assigned to the same event (used to propose swaps). */
export type EventAssignment = {
  assignment_id: string;
  user_id: string;
  user_name: string | null;
  is_me: boolean;
};

export async function listEventAssignments(eventId: string): Promise<EventAssignment[]> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const me = userRes.user?.id;
  if (!me) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('assignments')
    .select(`id, user_id, profiles:user_id ( full_name )`)
    .eq('event_id', eventId)
    .order('assigned_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    assignment_id: row.id,
    user_id: row.user_id,
    user_name: row.profiles?.full_name ?? null,
    is_me: row.user_id === me,
  }));
}

/** Existing same-event swap RPCs (kept) */
export async function proposeSwap(
  fromAssignmentId: string,
  toAssignmentId: string,
  message?: string
) {
  const { data, error } = await supabase.rpc('propose_swap', {
    from_assignment_id: fromAssignmentId,
    to_assignment_id: toAssignmentId,
    message: message ?? null,
  });
  if (error) throw error;
  return data;
}
export async function respondSwap(swapRequestId: string, action: 'accept' | 'decline') {
  const { data, error } = await supabase.rpc('respond_swap', {
    swap_request_id: swapRequestId,
    action,
  });
  if (error) throw error;
  return data;
}
export async function applySwap(swapRequestId: string) {
  const { data, error } = await supabase.rpc('apply_swap', {
    swap_request_id: swapRequestId,
  });
  if (error) throw error;
  return data;
}

/** Cross-date swap — propose, respond(accept/decline) */
export async function proposeCrossDateSwap(
  fromAssignmentId: string,
  toAssignmentId: string,
  message?: string
) {
  const { data, error } = await supabase.rpc('propose_cross_date_swap', {
    p_from_assignment_id: fromAssignmentId,
    p_to_assignment_id: toAssignmentId,
    p_message: message ?? null,
  });
  if (error) throw error;
  return data;
}

export async function respondCrossDateSwap(requestId: string, action: 'accept' | 'decline') {
  const { data, error } = await supabase.rpc('respond_cross_date_swap', {
    p_swap_request_id: requestId,
    p_action: action,
  });
  if (error) throw error;
  return data;
}
