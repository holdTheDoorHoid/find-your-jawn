import { compareNames } from './text';
import type { Group } from './types';

// Which groups appear on each guide page (DESIGN section 6). Pure functions, tested.
// Every list leaves out support groups (they live on the support page) and groups that are not
// open to a general visitor (students only, members only, by invitation).

/** How many groups a guide page lists per section before pointing to browse. */
export const PATH_CAP = 48;

export function openToVisitor(g: Group): boolean {
  if (g.audience.support_group || g.kind === 'support_group' || g.audience.partisan) return false;
  return g.audience.open_to === 'public' || g.audience.open_to === 'residents' || g.audience.open_to === 'parents';
}

function newcomer(g: Group): number {
  return g.first_step.newcomer_friendliness ?? 0;
}

/** Closer checks first, then A to Z. Neutral and explainable. */
function byWelcomeThenName(a: Group, b: Group): number {
  return newcomer(b) - newcomer(a) || b.research_tier - a.research_tier || compareNames(a.name, b.name);
}

function byName(a: Group, b: Group): number {
  return compareNames(a.name, b.name);
}

export function fitsTeens(g: Group): boolean {
  const { min_age: min, max_age: max } = g.audience;
  if (min === undefined || min > 16) return false;
  if (max !== undefined && max < 14) return false;
  return true;
}

export interface Capped {
  items: Group[];
  total: number;
}

function cap(list: Group[], n = PATH_CAP): Capped {
  return { items: list.slice(0, n), total: list.length };
}

export function serviceHours(groups: Group[]): { forms: Capped; teens: Capped } {
  const eligible = groups.filter(openToVisitor);
  const forms = eligible
    .filter((g) => g.requirements.service_hours_letter === 'yes')
    // Groups a teen can join come first.
    .sort((a, b) => Number(fitsTeens(b) || b.audience.min_age === undefined) - Number(fitsTeens(a) || a.audience.min_age === undefined) || byName(a, b));
  const formIds = new Set(forms.map((g) => g.id));
  const teens = eligible
    .filter((g) => !formIds.has(g.id) && g.requirements.service_hours_letter !== 'no' && fitsTeens(g))
    .sort(byWelcomeThenName);
  return { forms: cap(forms), teens: cap(teens) };
}

/** A yes for court ordered service. The pipeline refuses a yes without a source, so a yes here has one. */
export function acceptsCourtOrdered(g: Group): boolean {
  return g.requirements.court_ordered_ok === 'yes';
}

/** Kids can come along, and the minimum age is one a young child can meet. */
export function welcomesKids(g: Group): boolean {
  return g.requirements.kids_ok && (g.audience.min_age === undefined || g.audience.min_age <= 12);
}

/** Only groups with a sourced yes. The pipeline refuses a yes without a source. */
export function courtOrdered(groups: Group[]): Capped {
  return cap(groups.filter(openToVisitor).filter(acceptsCourtOrdered).sort(byName));
}

export function families(groups: Group[]): Capped {
  return cap(groups.filter(openToVisitor).filter(welcomesKids).sort(byWelcomeThenName));
}

const NEIGHBOR_WORDS = /civic|neighbor|walking|librar/;

/** Civic, library and walking groups: places where you meet people who live near you. */
export function isNeighborGroup(g: Group): boolean {
  if (g.kind === 'civic' || g.kind === 'friends_group') return true;
  if (/librar/i.test(g.name)) return true;
  return [...g.categories, ...g.interests].some((id) => NEIGHBOR_WORDS.test(id));
}

export function newToPhilly(groups: Group[]): { welcoming: Capped; neighbors: Capped } {
  const eligible = groups.filter(openToVisitor);
  const welcoming = eligible.filter((g) => newcomer(g) >= 4).sort(byWelcomeThenName);
  const seen = new Set(welcoming.slice(0, PATH_CAP).map((g) => g.id));
  const neighbors = eligible.filter((g) => isNeighborGroup(g) && !seen.has(g.id)).sort(byWelcomeThenName);
  return { welcoming: cap(welcoming), neighbors: cap(neighbors) };
}
