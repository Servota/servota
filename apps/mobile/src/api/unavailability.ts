// apps/mobile/src/api/unavailability.ts
import { supabase } from '../lib/supabase';

export type Unavailability = {
  id: string;
  account_id: string;
  user_id: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  reason: string | null;
};

export async function listMyFutureUnavailability(accountId: string): Promise<Unavailability[]> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('unavailability')
    .select('id, account_id, user_id, starts_at, ends_at, reason')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Unavailability[];
}

export async function addUnavailabilityQuick(accountId: string, hours: number, reason?: string) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  const starts = new Date();
  const ends = new Date(starts.getTime() + hours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('unavailability')
    .insert({
      account_id: accountId,
      user_id: userId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      reason: reason ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Unavailability;
}

/** Add an unavailability for an explicit start & end Date. */
export async function addUnavailabilityRange(
  accountId: string,
  starts: Date,
  ends: Date,
  reason?: string
) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userRes.user?.id;
  if (!userId) throw new Error('Not signed in');

  if (!(starts instanceof Date) || !(ends instanceof Date)) throw new Error('Invalid dates');
  if (ends <= starts) throw new Error('End must be after start');

  const { data, error } = await supabase
    .from('unavailability')
    .insert({
      account_id: accountId,
      user_id: userId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      reason: reason ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Unavailability;
}

export async function removeUnavailability(id: string) {
  const { error } = await supabase.from('unavailability').delete().eq('id', id);
  if (error) throw error;
}
