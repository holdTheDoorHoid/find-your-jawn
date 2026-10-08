import { isFaithGroup } from './badges';
import { DISTRICT_REGION, OTHER_REGION } from './geo';
import { languageBase } from './language';
import { placeLocations } from './place';
import { monthKey } from './dates';
import { fold, nameKey, slugify } from './text';
import { DAYS, type CostLevel, type Group } from './types';

// Pure filter, search and sort logic for the browse page. No DOM, no network, so it is easy to
// test and the quiz can reuse pieces of it.

export type FaithMode = 'include' | 'exclude' | 'only';
export type SortKey = 'best' | 'az' | 'recent';

export interface Filters {
  q: string;
  families: string[];
  kinds: string[];
  region: string;
  district: string;
  costs: CostLevel[];
  days: string[];
  times: string[];
  newcomers: boolean;
  kids: boolean;
  wheelchair: boolean;
  online: boolean;
  open: boolean;
  language: string;
  faith: FaithMode;
  hours: boolean;
  court: boolean;
}

export function emptyFilters(): Filters {
  return {
    q: '',
    families: [],
    kinds: [],
    region: '',
    district: '',
    costs: [],
    days: [],
    times: [],
    newcomers: false,
    kids: false,
    wheelchair: false,
    online: false,
    open: false,
    language: '',
    faith: 'include',
    hours: false,
    court: false,
  };
}

/** What we know about the places the vocabulary names; used to label and to find regions. */
export interface DistrictLookup {
  (value: string): { id: string; region: string };
}

export interface IndexContext {
  /** Readable label for an interest family or tag id, to make searches like "hiking" work. */
  labelOf(id: string): string;
  district: DistrictLookup;
}

export interface IndexedGroup {
  g: Group;
  /** folded text to search */
  text: string;
  /** folded name */
  name: string;
  sortName: string;
  districts: string[];
  regions: string[];
  recent: number;
  faith: boolean;
}

/** Support groups never appear in browse. They have their own page. */
export function isBrowsable(g: Group): boolean {
  return !g.audience.support_group && g.kind !== 'support_group' && !g.audience.partisan;
}

export function defaultDistrictLookup(known: Map<string, string> = new Map()): DistrictLookup {
  return (value) => {
    const id = slugify(value);
    const region = known.get(id) ?? DISTRICT_REGION[id] ?? OTHER_REGION.id;
    return { id, region };
  };
}

export function buildIndex(groups: Group[], ctx: IndexContext): IndexedGroup[] {
  const out: IndexedGroup[] = [];
  for (const g of groups) {
    if (!isBrowsable(g)) continue;
    const parts: string[] = [g.name, ...g.aka, g.summary];
    for (const id of g.interests) parts.push(id.replace(/[-_]/g, ' '), ctx.labelOf(id));
    for (const id of g.categories) parts.push(ctx.labelOf(id));
    const districts: string[] = [];
    const regions: string[] = [];
    for (const loc of placeLocations(g)) {
      if (loc.neighborhood) parts.push(loc.neighborhood.replace(/[-_]/g, ' '));
      if (loc.planning_district) {
        const d = ctx.district(loc.planning_district);
        if (!districts.includes(d.id)) districts.push(d.id);
        if (!regions.includes(d.region)) regions.push(d.region);
        parts.push(loc.planning_district.replace(/[-_]/g, ' '));
      }
    }
    out.push({
      g,
      text: fold(parts.join(' ')),
      name: fold(g.name),
      sortName: nameKey(g.name),
      districts,
      regions,
      recent: monthKey(g.last_sign_of_life),
      faith: isFaithGroup(g),
    });
  }
  return out;
}

function tokens(q: string): string[] {
  return fold(q).split(' ').filter(Boolean);
}

/** `daytime` means morning and afternoon, so either pick matches it. */
export function timesMatch(groupTimes: string[], wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const have = new Set(groupTimes);
  if (have.has('daytime')) {
    have.add('morning');
    have.add('afternoon');
  }
  if (have.has('morning') || have.has('afternoon')) have.add('daytime');
  return wanted.some((w) => have.has(w));
}

export function matchesFilters(e: IndexedGroup, f: Filters, toks: string[] = tokens(f.q)): boolean {
  const g = e.g;
  for (const t of toks) if (!e.text.includes(t)) return false;

  if (f.families.length && !g.categories.some((c) => f.families.includes(c))) return false;
  if (f.kinds.length && !f.kinds.includes(g.kind)) return false;
  if (f.district) {
    if (!e.districts.includes(f.district)) return false;
  } else if (f.region && !e.regions.includes(f.region)) return false;
  if (f.costs.length && !f.costs.includes(g.cost.level)) return false;
  if (f.days.length && !g.schedule.days.some((d) => f.days.includes(d))) return false;
  if (!timesMatch(g.schedule.times, f.times)) return false;
  if (f.newcomers && (g.first_step.newcomer_friendliness ?? 0) < 4) return false;
  if (f.kids && !g.requirements.kids_ok) return false;
  if (f.wheelchair && g.access.wheelchair !== 'yes') return false;
  if (f.online && !g.online_ok) return false;
  if (f.open && g.audience.open_to !== 'public') return false;
  if (f.language) {
    const want = languageBase(f.language);
    if (!g.access.languages.some((l) => languageBase(l) === want)) return false;
  }
  if (f.faith === 'exclude' && e.faith) return false;
  if (f.faith === 'only' && !e.faith) return false;
  if (f.hours && g.requirements.service_hours_letter !== 'yes') return false;
  if (f.court && g.requirements.court_ordered_ok !== 'yes') return false;
  return true;
}

export function applyFilters(index: IndexedGroup[], f: Filters): IndexedGroup[] {
  const toks = tokens(f.q);
  const out: IndexedGroup[] = [];
  for (const e of index) if (matchesFilters(e, f, toks)) out.push(e);
  return out;
}

function matchScore(e: IndexedGroup, toks: string[], phrase: string): number {
  if (toks.length === 0) return 0;
  let s = 0;
  if (e.name === phrase) s += 8;
  else if (e.name.startsWith(phrase)) s += 6;
  else if (e.name.includes(phrase)) s += 4;
  else if (toks.every((t) => e.name.includes(t))) s += 3;
  else if (toks.some((t) => e.name.includes(t))) s += 1;
  return s;
}

export function sortGroups(list: IndexedGroup[], sort: SortKey, q = ''): IndexedGroup[] {
  const copy = list.slice();
  const toks = tokens(q);
  const phrase = toks.join(' ');
  // sortName is folded once when the index is built, so sorting thousands of groups stays fast.
  const az = (a: IndexedGroup, b: IndexedGroup) =>
    a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : a.g.id < b.g.id ? -1 : 1;
  if (sort === 'recent') {
    copy.sort((a, b) => b.recent - a.recent || az(a, b));
  } else if (sort === 'best' && toks.length) {
    const scores = new Map<IndexedGroup, number>();
    for (const e of copy) scores.set(e, matchScore(e, toks, phrase));
    copy.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || az(a, b));
  } else {
    copy.sort(az);
  }
  return copy;
}

/** How many filters are on, not counting the search box. */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  n += f.families.length + f.kinds.length + f.costs.length + f.days.length + f.times.length;
  if (f.region || f.district) n += 1;
  for (const b of [f.newcomers, f.kids, f.wheelchair, f.online, f.open, f.hours, f.court]) if (b) n += 1;
  if (f.language) n += 1;
  if (f.faith !== 'include') n += 1;
  return n;
}

export function hasAnyFilter(f: Filters): boolean {
  return f.q.trim() !== '' || activeFilterCount(f) > 0;
}

// URL query state

const COSTS: readonly CostLevel[] = ['free', 'low', 'paid'];

function list(v: string | null): string[] {
  if (!v) return [];
  return [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))];
}

export function filtersFromParams(params: URLSearchParams): { filters: Filters; sort: SortKey | null } {
  const f = emptyFilters();
  f.q = (params.get('q') ?? '').slice(0, 200);
  f.families = list(params.get('fam'));
  f.kinds = list(params.get('kind'));
  f.region = params.get('region') ?? '';
  f.district = params.get('district') ?? '';
  f.costs = list(params.get('cost')).filter((c): c is CostLevel => (COSTS as readonly string[]).includes(c));
  f.days = list(params.get('day')).filter((d) => (DAYS as readonly string[]).includes(d));
  f.times = list(params.get('time'));
  const on = (k: string) => params.get(k) === '1';
  f.newcomers = on('newcomers');
  f.kids = on('kids');
  f.wheelchair = on('wheelchair');
  f.online = on('online');
  f.open = on('open');
  f.hours = on('hours');
  f.court = on('court');
  f.language = params.get('lang') ?? '';
  const faith = params.get('faith');
  f.faith = faith === 'exclude' || faith === 'only' ? faith : 'include';
  const s = params.get('sort');
  const sort = s === 'best' || s === 'az' || s === 'recent' ? s : null;
  return { filters: f, sort };
}

export function filtersToParams(f: Filters, sort: SortKey | null): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  const set = (k: string, v: string[]) => {
    if (v.length) p.set(k, [...v].sort().join(','));
  };
  set('fam', f.families);
  set('kind', f.kinds);
  if (f.district) p.set('district', f.district);
  else if (f.region) p.set('region', f.region);
  set('cost', f.costs);
  set('day', f.days);
  set('time', f.times);
  const flag = (k: string, v: boolean) => {
    if (v) p.set(k, '1');
  };
  flag('newcomers', f.newcomers);
  flag('kids', f.kids);
  flag('wheelchair', f.wheelchair);
  flag('online', f.online);
  flag('open', f.open);
  flag('hours', f.hours);
  flag('court', f.court);
  if (f.language) p.set('lang', f.language);
  if (f.faith !== 'include') p.set('faith', f.faith);
  if (sort) p.set('sort', sort);
  return p;
}

/** Sorted set of language base codes used by the groups, most common first. */
export function languagesInUse(groups: Group[]): string[] {
  const counts = new Map<string, number>();
  for (const g of groups) {
    for (const l of new Set(g.access.languages.map(languageBase))) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] === 'en' ? -1 : b[0] === 'en' ? 1 : b[1] - a[1] || (a[0] < b[0] ? -1 : 1)))
    .map(([l]) => l);
}

/** Times seen in the data, in a sensible order. */
export function timesInUse(groups: Group[]): string[] {
  const order = ['morning', 'daytime', 'afternoon', 'evening', 'night', 'flexible'];
  const seen = new Set<string>();
  for (const g of groups) for (const t of g.schedule.times) seen.add(t);
  return [...seen].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || (a < b ? -1 : 1);
  });
}

export function kindsInUse(groups: Group[]): string[] {
  const counts = new Map<string, number>();
  for (const g of groups) if (isBrowsable(g)) counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1);
  return [...counts.keys()].sort();
}
