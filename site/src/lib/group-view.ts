import { formatDate, formatMonthYear, monthsSince } from './dates';
import { clip, hostOf, prettify } from './text';
import { fill } from './inline';
import { languageName } from './language';
import { group as t, labels } from '../strings/en';
import type { Group, GroupSource } from './types';

// Small decisions the group page makes, kept here so they can be tested.

/** True when the deep research pass (tier 2 or 3) left something to show about a first visit. */
export function hasFirstVisitGuide(g: Group): boolean {
  if (g.research_tier < 2) return false;
  const f = g.first_step;
  return Boolean(f.what_to_expect || f.first_visit_tips.length > 0 || f.how || f.newcomer_friendliness);
}

/** Sources that back one field. A source that lists "contacts" backs every contacts.* field. */
export function sourcesFor(g: Group, field: string): GroupSource[] {
  const parent = field.includes('.') ? field.slice(0, field.indexOf('.')) : null;
  return g.sources.filter((s) => s.fields.some((f) => f === field || (parent !== null && f === parent)));
}

export function fieldLabel(path: string): string {
  if (t.fields[path]) return t.fields[path];
  const last = path.split('.').pop() ?? path;
  return prettify(last);
}

export function tierSentence(g: Group): string {
  const date = formatDate(g.last_checked);
  if (!date) return g.research_tier >= 3 ? t.tier3.replace(' Last checked by our research team on {date}.', '') : t.tierNoDate;
  if (g.research_tier >= 3) return fill(t.tier3, { date });
  if (g.research_tier === 2) return fill(t.tier2, { date });
  return fill(t.tier1, { date });
}

/** One sentence about how fresh the last sign of life is, only when it needs saying. */
export function freshnessNote(g: Group, now: Date): string | null {
  if (g.status === 'probably_active') return t.fresh.probablyActive;
  if (g.status === 'dormant') return t.fresh.dormant;
  if (g.status === 'unknown') return t.fresh.unknown;
  const months = monthsSince(g.last_sign_of_life, now);
  if (months !== null && months > 12) return t.fresh.old;
  return null;
}

export function ageLine(g: Group): string | null {
  const { min_age: min, max_age: max } = g.audience;
  if (min !== undefined && max !== undefined) return fill(t.who.ages, { min, max });
  if (min !== undefined) return fill(t.who.minAge, { n: min });
  if (max !== undefined) return fill(t.who.maxAge, { n: max });
  return null;
}

export function metaDescription(g: Group): string {
  if (g.summary) return clip(g.summary, 155);
  return fill(t.meta.descriptionFallback, { kind: (labels.kind[g.kind] ?? g.kind).toLowerCase() });
}

export function newcomerLabel(n: number): string {
  return labels.newcomer[n] ?? '';
}

/** A readable name for a link: its host, so "https://www.example.org/a" gives "example.org". */
export function linkLabel(url: string): string {
  return hostOf(url);
}

export function socialLabel(url: string): string {
  const host = hostOf(url);
  const known: Record<string, string> = {
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'x.com': 'X',
    'twitter.com': 'X',
    'youtube.com': 'YouTube',
    'tiktok.com': 'TikTok',
    'linkedin.com': 'LinkedIn',
    'bsky.app': 'Bluesky',
    'meetup.com': 'Meetup',
  };
  return known[host] ?? host;
}

export function sourceSeen(s: GroupSource): string | null {
  return formatMonthYear(s.seen) ? formatDate(s.seen) : null;
}


/**
 * A label for an `audience.community` value. Values are plain ids such as "lgbtq", or carry a
 * prefix: "heritage:irish" and "language:es" (data/vocab/audiences.yaml). `lookup` finds a label in
 * the vocabulary section that owns the id.
 */
export function communityLabel(value: string, lookup: (section: string, id: string) => string | undefined = () => undefined): string {
  const [prefix, rest] = value.includes(':') ? (value.split(':', 2) as [string, string]) : ['', value];
  if (prefix === 'heritage') return fill(t.community.heritage, { name: lookup('heritage', rest) ?? prettify(rest) });
  if (prefix === 'language') return fill(t.community.language, { name: languageName(rest) });
  return lookup('community', rest) ?? t.community.names[rest] ?? prettify(rest);
}

/** "Saturday and Sunday" from ["sat", "sun"], in week order. */
export function dayList(days: string[]): string {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const names = order.filter((d) => days.includes(d)).map((d) => labels.dayLong[d] ?? d);
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ` ${t.listAnd} ` + names[names.length - 1];
}
