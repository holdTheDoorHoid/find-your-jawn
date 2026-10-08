// Dates and times for planned visits, as plain strings with no time zone tricks: a date is
// YYYY-MM-DD and a time is HH:MM, both in the visitor's own clock. No interface text lives here, so
// the small script that decides whether to show a "Did you go?" card can use it without loading the
// rest of the site's text.

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function parseDate(date: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function parseTime(time: string): { h: number; min: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, min } : null;
}

/** The day of the week id ("sat") for a YYYY-MM-DD date, without any time zone. */
export function weekdayOf(date: string): (typeof WEEKDAYS)[number] | null {
  const p = parseDate(date);
  if (!p) return null;
  return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()] ?? null;
}

/** Today as YYYY-MM-DD in the browser's own time zone. */
export function todayString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The next date on or after `from` that falls on one of the days ("sat"), or the next Saturday. */
export function nextDateOn(from: Date, days: string[]): string {
  const want = days.length > 0 ? days : ['sat'];
  const probe = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  for (let i = 0; i < 8; i++) {
    const wd = WEEKDAYS[probe.getDay()];
    if (wd && want.includes(wd)) return todayString(probe);
    probe.setDate(probe.getDate() + 1);
  }
  return todayString(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1));
}

/** A sensible starting time from the parts of the day a group meets. */
export function defaultTime(times: string[]): string {
  if (times.includes('morning')) return '09:00';
  if (times.includes('daytime')) return '11:00';
  if (times.includes('afternoon')) return '14:00';
  if (times.includes('evening')) return '18:30';
  if (times.includes('night')) return '21:00';
  return '10:00';
}

