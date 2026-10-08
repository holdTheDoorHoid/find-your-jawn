import { formatDate, formatMonthYear, monthsSince } from './dates';
import { clip, hostOf, prettify } from './text';
import { fill } from './inline';
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
  const map: Record<string, string> = {
    name: 'Name',
    aka: 'Other names',
    summary: 'Summary',
    what_you_do: 'What they do',
    schedule: 'Schedule',
    locations: 'Location',
    cost: 'Cost',
    contacts: 'Contacts',
    'contacts.website': 'Website',
    'contacts.email': 'Email',
    'contacts.phone': 'Phone',
    'contacts.contact_name': 'Contact name',
    'contacts.social': 'Social media',
    'contacts.calendar_feed': 'Calendar',
    'audience.school': 'School',
    'audience.open_to': 'Who can join',
    'requirements.court_ordered_ok': 'Court ordered hours',
    'requirements.service_hours_letter': 'Service hour forms',
    'requirements.act153_clearances': 'Clearances',
    'access.wheelchair': 'Wheelchair access',
  };
  if (map[path]) return map[path];
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
  if (g.status === 'probably_active') {
    return 'We think this group is probably still active, but the newest sign we found is more than a year old.';
  }
  if (g.status === 'dormant') return 'This group may have gone quiet. Ask before you go.';
  if (g.status === 'unknown') return 'We are not sure yet whether this group is still active.';
  const months = monthsSince(g.last_sign_of_life, now);
  if (months !== null && months > 12) return 'The newest sign of life we found is more than a year old. Ask before you go.';
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


const COMMUNITY: Record<string, string> = {
  lgbtq: 'LGBTQ+',
  veterans: 'Veterans',
  women: 'Women',
  seniors: 'Older adults',
  disability: 'People with disabilities',
  deaf: 'Deaf and hard of hearing',
};

/** A label for an affinity such as "lgbtq". Uses the vocabulary first, then a short built in list. */
export function communityLabel(id: string, vocabLabel?: string): string {
  return vocabLabel ?? COMMUNITY[id] ?? prettify(id);
}

/** "Saturday and Sunday" from ["sat", "sun"], in week order. */
export function dayList(days: string[]): string {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const names = order.filter((d) => days.includes(d)).map((d) => labels.dayLong[d] ?? d);
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
