// packages/shared/src/datetime.ts
// Zero-dependency UTC/local helpers for Servota.
// Store in UTC ISO; display in user's local tz (or a supplied tz).

type DateInput = string | number | Date;

/** Parse anything reasonable into a Date. Throws if invalid. */
export function toDate(input: DateInput): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date input');
  return d;
}

/** ISO string in UTC (e.g., '2025-08-31T09:00:00.000Z'). */
export function toUtcIso(input: DateInput = new Date()): string {
  return toDate(input).toISOString();
}

/** Now, as UTC ISO. */
export function nowUtcIso(): string {
  return new Date().toISOString();
}

/** Returns a formatted local string for an ISO datetime. */
export function formatLocal(
  iso: string,
  opts: {
    timeZone?: string; // e.g., 'Australia/Perth' (default: runtime local)
    locale?: string; // e.g., 'en-AU' (default: runtime locale)
    dateStyle?: 'full' | 'long' | 'medium' | 'short';
    timeStyle?: 'full' | 'long' | 'medium' | 'short';
  } = {}
): string {
  const { timeZone, locale, dateStyle = 'medium', timeStyle = 'short' } = opts;
  const d = toDate(iso);
  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone }).format(d);
}

/** Formats a local range, using formatRange when available. Falls back gracefully. */
export function formatRangeLocal(
  startIso: string,
  endIso: string,
  opts: {
    timeZone?: string;
    locale?: string;
    dateStyle?: 'full' | 'long' | 'medium' | 'short';
    timeStyle?: 'full' | 'long' | 'medium' | 'short';
  } = {}
): string {
  const { timeZone, locale, dateStyle = 'medium', timeStyle = 'short' } = opts;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone });
  const a = toDate(startIso);
  const b = toDate(endIso);
  // @ts-ignore - formatRange not on all targets; guarded call.
  if (typeof (fmt as any).formatRange === 'function') {
    // @ts-ignore
    return fmt.formatRange(a, b);
  }
  // Fallback: format both and join
  return `${fmt.format(a)} – ${fmt.format(b)}`;
}

/** True if [aStart,aEnd) overlaps [bStart,bEnd). */
export function rangesOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string
): boolean {
  const aStart = toDate(aStartIso).getTime();
  const aEnd = toDate(aEndIso).getTime();
  const bStart = toDate(bStartIso).getTime();
  const bEnd = toDate(bEndIso).getTime();
  if (!(aStart < aEnd && bStart < bEnd)) return false; // invalid ranges don't overlap
  return aStart < bEnd && bStart < aEnd;
}
