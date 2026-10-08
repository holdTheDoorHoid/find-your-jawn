import { fill } from '../../lib/inline';
import { parseDate, parseTime, weekdayOf } from '../../lib/plan-dates';
import { plainName } from '../../lib/text';
import { labels, plan as t } from '../../strings/en';

// "Plan it": the sentence that makes a plan feel real, and a calendar file made in the browser with
// reminders the day before and two hours before. Pure functions with no time zone surprises: dates
// are plain YYYY-MM-DD and times plain HH:MM, written to the file as local ("floating") times, so the
// calendar app shows the time the person picked wherever they are.

export { defaultTime, nextDateOn, parseDate, parseTime, todayString, weekdayOf } from '../../lib/plan-dates';

export interface PlanInput {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24 hour */
  time: string;
  firstStep?: string;
  /** the group's page on this site, with only the group id in it */
  url: string;
  /** where it meets, as the group published it */
  where?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "9 am", "9:30 am", "noon". */
export function timeWords(time: string): string {
  const p = parseTime(time);
  if (!p) return time;
  if (p.h === 12 && p.min === 0) return t.noon;
  const suffix = p.h < 12 ? 'am' : 'pm';
  const h = p.h % 12 === 0 ? 12 : p.h % 12;
  return p.min === 0 ? `${h} ${suffix}` : `${h}:${String(p.min).padStart(2, '0')} ${suffix}`;
}

/** "Saturday, October 11". */
export function dateWords(date: string): string {
  const p = parseDate(date);
  const wd = weekdayOf(date);
  if (!p || !wd) return date;
  return `${labels.dayLong[wd]}, ${MONTHS[p.m - 1]} ${p.d}`;
}

/** The sentence: "Saturday, October 11 at 9 am I will go to the Trail Crew." */
export function planSentence(plan: Pick<PlanInput, 'name' | 'date' | 'time'>): string {
  return fill(t.sentence, { when: dateWords(plan.date), time: timeWords(plan.time), name: plainName(plan.name) });
}

// ---------------------------------------------------------------- the calendar file

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

/** Local date and time as 20261011T090000. */
function floating(y: number, mo: number, d: number, h: number, min: number): string {
  return `${pad(y, 4)}${pad(mo)}${pad(d)}T${pad(h)}${pad(min)}00`;
}

function utcStamp(now: Date): string {
  return `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

/** Escape text for a calendar file: backslash, semicolon, comma and line breaks. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines may not be longer than 75 bytes. Longer ones continue on the next line after a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + n > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** The calendar file for one planned visit, with two reminders: the day before and two hours before. */
export function buildIcs(plan: PlanInput, now: Date = new Date()): string {
  const d = parseDate(plan.date);
  const tm = parseTime(plan.time);
  if (!d || !tm) throw new Error('A plan needs a date and a time.');
  const start = new Date(Date.UTC(d.y, d.m - 1, d.d, tm.h, tm.min));
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const dtStart = floating(d.y, d.m, d.d, tm.h, tm.min);
  const dtEnd = floating(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes());
  const sentence = planSentence(plan);
  const description = [sentence, plan.firstStep ? fill(t.firstStep, { step: plan.firstStep }) : '', plan.url, t.icsFooter].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Find Your Jawn//Plan it//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${plan.id}-${plan.date}-${plan.time.replace(':', '')}@findyourjawn`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(fill(t.icsTitle, { name: plan.name }))}`,
    `DESCRIPTION:${icsEscape(description)}`,
    ...(plan.where ? [`LOCATION:${icsEscape(plan.where)}`] : []),
    `URL:${plan.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(fill(t.reminderDay, { name: plan.name }))}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(fill(t.reminderHours, { name: plan.name }))}`,
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** A safe file name: "find-your-jawn-trail-crew-2026-10-11.ics". */
export function icsFileName(plan: Pick<PlanInput, 'id' | 'date'>): string {
  return `find-your-jawn-${plan.id.replace(/[^a-z0-9-]/gi, '')}-${plan.date}.ics`;
}
