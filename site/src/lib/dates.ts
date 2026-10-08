// Date formatting without Date objects, so a time zone can never shift a month.
// Input comes from the data as "2026-09", "2026-09-14" or "2026-09-14T00:00:00Z".

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface Parts {
  year: number;
  month: number;
  day?: number;
}

export function parseDateParts(value: string | undefined | null): Parts | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const day = m[3] ? Number(m[3]) : undefined;
  if (day !== undefined && (day < 1 || day > 31)) return null;
  return day === undefined ? { year, month } : { year, month, day };
}

/** "2026-09" gives "September 2026". Returns null when the value is missing or unreadable. */
export function formatMonthYear(value: string | undefined | null): string | null {
  const p = parseDateParts(value);
  if (!p) return null;
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

/** "2026-10-04" gives "October 4, 2026". A month only value falls back to month and year. */
export function formatDate(value: string | undefined | null): string | null {
  const p = parseDateParts(value);
  if (!p) return null;
  if (p.day === undefined) return `${MONTHS[p.month - 1]} ${p.year}`;
  return `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`;
}

/** "Last seen active: September 2026", or null when we have no sign of life date. */
export function lastSeenActive(value: string | undefined | null): string | null {
  const text = formatMonthYear(value);
  return text ? `Last seen active: ${text}` : null;
}

/** Months from `value` to `now`, rounded down. Null if unreadable. Used to word a stale warning. */
export function monthsSince(value: string | undefined | null, now: Date): number | null {
  const p = parseDateParts(value);
  if (!p) return null;
  return (now.getUTCFullYear() - p.year) * 12 + (now.getUTCMonth() + 1 - p.month);
}

/** Sortable number for a date: year times 100 plus month. Missing dates sort as 0. */
export function monthKey(value: string | undefined | null): number {
  const p = parseDateParts(value);
  return p ? p.year * 100 + p.month : 0;
}
