import { describe, expect, it } from 'vitest';
import { buildIcs, dateWords, defaultTime, foldLine, icsEscape, icsFileName, nextDateOn, parseDate, parseTime, planSentence, timeWords, todayString, weekdayOf } from './ics';

const plan = {
  id: 'wissahickon-trail-crew',
  name: 'Wissahickon Trail Crew',
  date: '2026-10-10',
  time: '09:00',
  firstStep: 'Come to a Saturday work day, and ask for the crew lead',
  url: 'https://holdthedoorhoid.github.io/find-your-jawn/g/wissahickon-trail-crew/',
  where: '100 Valley Green Rd; Philadelphia, PA',
};
const NOW = new Date('2026-10-08T15:30:45Z');

describe('dates and times', () => {
  it('reads real dates only', () => {
    expect(parseDate('2026-10-10')).toEqual({ y: 2026, m: 10, d: 10 });
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('10/10/2026')).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('reads real times only', () => {
    expect(parseTime('09:30')).toEqual({ h: 9, min: 30 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9:30')).toBeNull();
  });

  it('finds the day of the week without a time zone', () => {
    expect(weekdayOf('2026-10-10')).toBe('sat');
    expect(weekdayOf('2026-10-11')).toBe('sun');
    expect(weekdayOf('2024-02-29')).toBe('thu');
    expect(weekdayOf('nope')).toBeNull();
  });

  it('says times and dates in plain words', () => {
    expect(timeWords('09:00')).toBe('9 am');
    expect(timeWords('18:30')).toBe('6:30 pm');
    expect(timeWords('12:00')).toBe('noon');
    expect(timeWords('00:15')).toBe('12:15 am');
    expect(dateWords('2026-10-10')).toBe('Saturday, October 10');
  });

  it('writes the plan as a sentence', () => {
    expect(planSentence(plan)).toBe('Saturday, October 10 at 9 am I will go to Wissahickon Trail Crew.');
  });

  it('picks the next day the group meets, never today', () => {
    const thursday = new Date(2026, 9, 8, 12, 0);
    expect(nextDateOn(thursday, ['sat'])).toBe('2026-10-10');
    expect(nextDateOn(thursday, ['thu'])).toBe('2026-10-15');
    expect(nextDateOn(thursday, [])).toBe('2026-10-10');
    expect(nextDateOn(thursday, ['fri', 'tue'])).toBe('2026-10-09');
  });

  it('starts at a sensible time', () => {
    expect(defaultTime(['evening'])).toBe('18:30');
    expect(defaultTime(['morning', 'evening'])).toBe('09:00');
    expect(defaultTime([])).toBe('10:00');
  });

  it('writes today in the local calendar', () => {
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('the calendar file', () => {
  const ics = buildIcs(plan, NOW);
  const lines = ics.split('\r\n');

  it('is a calendar with one event', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines.filter((l) => l === 'END:VEVENT')).toHaveLength(1);
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('uses CRLF line breaks and never folds a line past 75 bytes', () => {
    expect(ics).not.toMatch(/[^\r]\n/);
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });

  it('puts the visit at the day and time the person picked, as a local time', () => {
    expect(ics).toContain('DTSTART:20261010T090000\r\n');
    expect(ics).toContain('DTEND:20261010T103000\r\n');
    expect(ics).not.toMatch(/DTSTART[^:]*Z/);
    expect(ics).toContain('DTSTAMP:20261008T153045Z\r\n');
  });

  it('adds a reminder the day before and another two hours before', () => {
    const alarms = ics.split('BEGIN:VALARM').slice(1);
    expect(alarms).toHaveLength(2);
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics).toContain('TRIGGER:-PT2H');
    for (const a of alarms) expect(a).toContain('ACTION:DISPLAY');
  });

  it('carries only the group id in its link, never answers', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('URL:https://holdthedoorhoid.github.io/find-your-jawn/g/wissahickon-trail-crew/');
    expect(unfolded).not.toMatch(/\?/);
  });

  it('escapes commas, semicolons and line breaks', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('LOCATION:100 Valley Green Rd\; Philadelphia\\, PA');
    expect(unfolded).toContain('Come to a Saturday work day\\, and ask for the crew lead');
    expect(icsEscape('a\\b;c,d\ne')).toBe('a\\\\b\;c\\,d\\ne');
  });

  it('folds long lines at a space and keeps every character', () => {
    const long = 'DESCRIPTION:' + 'x'.repeat(200);
    const folded = foldLine(long);
    expect(folded.split('\r\n').length).toBeGreaterThan(2);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('folds multi byte characters without splitting them', () => {
    const line = 'SUMMARY:' + 'é'.repeat(60) + '🌱'.repeat(10);
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('has a stable unique id and a safe file name', () => {
    expect(lines).toContain('UID:wissahickon-trail-crew-2026-10-10-0900@findyourjawn');
    expect(icsFileName(plan)).toBe('find-your-jawn-wissahickon-trail-crew-2026-10-10.ics');
    expect(icsFileName({ id: '../../etc', date: '2026-10-10' })).toBe('find-your-jawn-etc-2026-10-10.ics');
  });

  it('refuses a plan without a real date or time', () => {
    expect(() => buildIcs({ ...plan, date: 'soon' })).toThrow();
    expect(() => buildIcs({ ...plan, time: '' })).toThrow();
  });

  it('works without a place or a first step', () => {
    const bare = buildIcs({ id: 'x', name: 'X', date: '2026-10-10', time: '10:00', url: 'https://example.org/' }, NOW);
    expect(bare).not.toContain('LOCATION');
    expect(bare).toContain('SUMMARY:Visit X');
  });
});
