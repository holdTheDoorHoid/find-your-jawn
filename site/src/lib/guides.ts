// Guide lists (docs/DATA_MODEL.md section 9): things that are not groups, such as quizzo nights.
// The pipeline writes site/public/data/guides/<guide>.json with the confirmed entries only. This
// module reads that shape, groups it for the page and works out the small facts a card shows.
// Pure functions with tests; nothing here touches the file system.

import { quizzo as t } from '../strings/en';
import { REGIONS } from './geo';
import { obj, str, strList } from './normalize';
import { compareNames, hostOf, safeHttpUrl, slugify } from './text';
import type { Vocab } from './types';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export function isDay(x: unknown): x is Day {
  return typeof x === 'string' && (DAYS as readonly string[]).includes(x);
}

export type GuideCost = 'free' | 'paid' | 'unknown';
export type GuideAge = '21_plus' | 'all_ages' | 'unknown';

export interface GuideSource {
  url: string;
  seen?: string;
  fields: string[];
}

export interface GuideEntry {
  id: string;
  venue: string;
  address?: string;
  zip?: string;
  neighborhood?: string;
  planningDistrict?: string;
  day: Day;
  /** 24 hour "20:00" */
  start?: string;
  host?: string;
  cost: GuideCost;
  costText?: string;
  teamSize?: string;
  age: GuideAge;
  notes?: string;
  sources: GuideSource[];
  lastChecked?: string;
}

export interface GuideLeadSource {
  name: string;
  url: string;
}

export interface Guide {
  guide: string;
  title?: string;
  updated?: string;
  built?: string;
  leadSources: GuideLeadSource[];
  entries: GuideEntry[];
}

function oneOf<T extends string>(x: unknown, allowed: readonly T[], fallback: T): T {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : fallback;
}

function normalizeEntry(raw: unknown): GuideEntry | null {
  const o = obj(raw);
  const venue = str(o.venue);
  const day = o.day;
  if (!venue || !isDay(day)) return null;
  const sources: GuideSource[] = [];
  if (Array.isArray(o.sources)) {
    for (const s of o.sources) {
      const so = obj(s);
      const url = safeHttpUrl(str(so.url));
      if (url) sources.push({ url, seen: str(so.seen), fields: strList(so.fields) });
    }
  }
  const start = str(o.start);
  return {
    id: str(o.id) ?? `${slugify(venue)}-${day}`,
    venue,
    address: str(o.address),
    zip: str(o.zip),
    neighborhood: str(o.neighborhood),
    planningDistrict: str(o.planning_district),
    day,
    start: start && /^\d{1,2}:\d{2}$/.test(start) ? start : undefined,
    host: str(o.host),
    cost: oneOf(o.cost, ['free', 'paid', 'unknown'] as const, 'unknown'),
    costText: str(o.cost_text),
    teamSize: str(o.team_size),
    age: oneOf(o.age, ['21_plus', 'all_ages', 'unknown'] as const, 'unknown'),
    notes: str(o.notes),
    sources,
    lastChecked: str(o.last_checked),
  };
}

/** Reads guides/<guide>.json (or anything shaped like it). Never throws; unusable entries are dropped. */
export function normalizeGuide(raw: unknown, fallbackName = ''): Guide {
  const o = obj(raw);
  const leadSources: GuideLeadSource[] = [];
  if (Array.isArray(o.lead_sources)) {
    for (const l of o.lead_sources) {
      const lo = obj(l);
      const url = safeHttpUrl(str(lo.url));
      if (url) leadSources.push({ name: str(lo.name) ?? hostOf(url), url });
    }
  }
  const entries: GuideEntry[] = [];
  if (Array.isArray(o.entries)) {
    for (const e of o.entries) {
      const entry = normalizeEntry(e);
      if (entry) entries.push(entry);
    }
  }
  return {
    guide: str(o.guide) ?? fallbackName,
    title: str(o.title),
    updated: str(o.updated),
    built: str(o.built),
    leadSources,
    entries,
  };
}

// ---------------------------------------------------------------- small facts for a card

/** "20:00" gives "8 pm", "19:30" gives "7:30 pm", "12:00" gives "noon". */
export function formatStart(start: string | undefined): string | undefined {
  const m = start ? /^(\d{1,2}):(\d{2})$/.exec(start) : null;
  if (!m) return undefined;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return undefined;
  if (hour === 12 && minute === 0) return t.time.noon;
  if (hour === 0 && minute === 0) return t.time.midnight;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${h12}${mm} ${hour < 12 ? t.time.am : t.time.pm}`;
}

/** Minutes after midnight, for sorting. Entries with no start sort last. */
function startMinutes(start: string | undefined): number {
  const m = start ? /^(\d{1,2}):(\d{2})$/.exec(start) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
}

/** Cost words for a card: the venue's own words when we have them, else Free or Paid, else nothing. */
export function costLabel(entry: GuideEntry): { text: string; tone: 'good' | 'note' } | undefined {
  const words = entry.costText && entry.costText.length <= 48 ? entry.costText : undefined;
  if (entry.cost === 'free') return { text: words ?? t.card.free, tone: 'good' };
  if (entry.cost === 'paid') return { text: words ?? t.card.paid, tone: 'note' };
  return words ? { text: words, tone: 'note' } : undefined;
}

export function placeLine(entry: GuideEntry): string {
  return [entry.neighborhood, entry.address].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- sources

/** Host names (no www) of the lead sources, so a card links to the venue or host, not the lead. */
export function leadHosts(guide: Guide): Set<string> {
  return new Set(guide.leadSources.map((l) => hostOf(l.url).toLowerCase()));
}

function isLeadUrl(url: string, hosts: Set<string>): boolean {
  const host = hostOf(url).toLowerCase();
  for (const lead of hosts) if (host === lead || host.endsWith(`.${lead}`)) return true;
  return false;
}

/** The source a card links to: the first one that is not a lead page, else the first. */
export function pickSource(entry: GuideEntry, hosts: Set<string>): GuideSource | undefined {
  return entry.sources.find((s) => !isLeadUrl(s.url, hosts)) ?? entry.sources[0];
}

// ---------------------------------------------------------------- grouping and filtering

export interface DayGroup {
  day: Day;
  entries: GuideEntry[];
}

/** Entries by night of the week, Monday first. Days with no entries are left out. Within a night:
 * earliest start first, entries with no start last, then A to Z. */
export function byDay(entries: GuideEntry[]): DayGroup[] {
  const out: DayGroup[] = [];
  for (const day of DAYS) {
    const list = entries
      .filter((e) => e.day === day)
      .sort((a, b) => startMinutes(a.start) - startMinutes(b.start) || compareNames(a.venue, b.venue));
    if (list.length > 0) out.push({ day, entries: list });
  }
  return out;
}

export const OTHER_REGION_ID = 'other';

/** The part of the city (a region id such as "north") an entry sits in, or "other" when its
 * planning district is missing or not in the vocabulary. */
export function regionIdOf(entry: GuideEntry, vocab: Vocab): string {
  if (!entry.planningDistrict) return OTHER_REGION_ID;
  const id = slugify(entry.planningDistrict);
  const district = vocab.districts.find((d) => d.id === id);
  return district && district.region ? district.region : OTHER_REGION_ID;
}

export interface RegionOption {
  id: string;
  label: string;
  count: number;
}

/** The parts of the city that have at least one night, in the usual order, then "other". */
export function regionOptions(entries: GuideEntry[], vocab: Vocab): RegionOption[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const id = regionIdOf(e, vocab);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const labels = new Map<string, string>(REGIONS.map((r) => [r.id, r.label]));
  for (const d of vocab.districts) if (!labels.has(d.region)) labels.set(d.region, d.regionLabel);
  const known = [...REGIONS.map((r) => r.id), ...[...counts.keys()].filter((id) => id !== OTHER_REGION_ID && !labels.has(id))];
  const options: RegionOption[] = [];
  for (const id of known) {
    const count = counts.get(id) ?? 0;
    if (count > 0) options.push({ id, label: labels.get(id) ?? id, count });
  }
  const other = counts.get(OTHER_REGION_ID) ?? 0;
  if (other > 0) options.push({ id: OTHER_REGION_ID, label: t.filter.other, count: other });
  return options;
}

export interface Visible {
  total: number;
  perDay: Record<string, number>;
}

/** How many nights show for a chosen part of the city ("all" shows everything). The page script
 * uses this on the data attributes of the rendered cards. */
export function visibleCounts(items: { day: string; region: string }[], region: string): Visible {
  const perDay: Record<string, number> = {};
  let total = 0;
  for (const item of items) {
    if (region !== 'all' && item.region !== region) continue;
    perDay[item.day] = (perDay[item.day] ?? 0) + 1;
    total += 1;
  }
  return { total, perDay };
}

// ---------------------------------------------------------------- the quiz results line

/** Whether the quiz results show the small "Also try: Quizzo nights" line: the person chose "I'm new
 * to Philly", picked the trivia and pub games interest, or starred Games and puzzles. */
export function showQuizzoLine(a: { paths: readonly string[]; tags: readonly string[]; starred: readonly string[] }): boolean {
  return a.paths.includes('newcomer') || a.tags.includes('trivia_nights') || a.starred.includes('games-puzzles');
}

/** The words between items in a list read aloud: nothing before the first, " and " before the last,
 * ", " otherwise. So "A", "A and B" and "A, B and C". */
export function listSeparator(index: number, length: number): string {
  if (index === 0) return '';
  return index === length - 1 ? ` ${t.credit.and} ` : ', ';
}
