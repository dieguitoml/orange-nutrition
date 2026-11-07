import type { LocalDate } from '../types/domain';

/**
 * Local-calendar date helpers. All functions operate on calendar components (Y/M/D), never on
 * UTC instants, which avoids the classic "toISOString() shifts the day" bug and DST issues.
 */

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** Formats a Date as the LOCAL calendar date `YYYY-MM-DD`. */
export function toLocalDate(date: Date = new Date()): LocalDate {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid Date');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local date. */
export function today(): LocalDate {
  return toLocalDate(new Date());
}

/** True if `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function assertLocalDate(value: unknown): asserts value is LocalDate {
  if (!isValidLocalDate(value)) throw new RangeError(`Invalid local date: ${String(value)} (expected YYYY-MM-DD)`);
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function parts(date: LocalDate): [number, number, number] {
  assertLocalDate(date);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

/** Local midnight Date for a LocalDate (useful for display with Intl). */
export function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Calendar arithmetic (DST-safe, done in UTC components). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole calendar days from `a` to `b` (b - a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Day of week, 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: LocalDate): number {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Inclusive list of dates from start to end. Empty if end < start. */
export function dateRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const n = daysBetween(start, end);
  const out: LocalDate[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

/** The 7-day week containing `date`. */
export function weekRange(date: LocalDate, weekStartsOn: 0 | 1 = 1): { start: LocalDate; end: LocalDate } {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  const start = addDays(date, -offset);
  return { start, end: addDays(start, 6) };
}

/** LocalDate comparison usable with Array#sort. Lexicographic order equals chronological order. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Current timestamp as ISO string (UTC instant; for audit fields only). */
export function nowIso(): string {
  return new Date().toISOString();
}
