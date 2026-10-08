import { isFaithGroup } from '../lib/badges';
import { placeLocations } from '../lib/place';
import { slugify } from '../lib/text';
import type { Group } from '../lib/types';
import { districtCenter, neighborhoodCenter, zipCenter, type Catalog } from './catalog';
import type { LatLng } from './centroids';
import { groupFamilies } from './profile';
import type { WayId } from './types';

// One pass over each group to work out the things the filters and scores keep asking for. The
// result is cached per group, so changing an answer re-scores without redoing this work.

/** How exactly we know where a group meets. */
export type Precision = 'exact' | 'neighborhood' | 'zip' | 'district';

export interface Point {
  at: LatLng;
  precision: Precision;
}

export interface Prepared {
  g: Group;
  /** categories plus the families of the tags */
  families: string[];
  /** the family counted for the "no more than two of a kind" rule */
  primary: string;
  tags: string[];
  /** the parent organization, for the same rule */
  org: string;
  points: Point[];
  /** planning districts and neighborhoods, as slugs, for "residents only" groups */
  districts: string[];
  hoods: string[];
  /** ways in the group offers, from the vocabulary lists and from its roles and formats. Empty means unknown. */
  ways: Set<WayId>;
  faith: boolean;
  support: boolean;
  outdoors: boolean | null;
  philly: boolean;
  /** share of the facts the filters care about that we know, 0 to 1 */
  completeness: number;
  /** meets only online */
  onlineOnly: boolean;
}

/** Tags that are uniquely Philadelphia, beyond the Philly traditions family. */
export const PHILLY_TAGS = new Set([
  'mummers_string_band',
  'mummers_fancy_brigade',
  'mummers_comic_club',
  'mummers_clubhouse',
  'parade_units',
  'street_festivals',
  'cultural_dance',
  'rowing',
  'dragon_boat',
  'regatta_volunteering',
  'mural_public_art',
  'walking_tours',
  'historic_site_volunteering',
  'heritage_clubs',
]);
export const PHILLY_FAMILIES = new Set(['philly-traditions']);

const OUTDOOR_FAMILIES = new Set(['outdoors-adventure', 'nature-environment', 'gardening-greening', 'water-rowing']);
const OUTDOOR_TAGS = new Set(['running', 'walking_group', 'group_bike_rides', 'soccer', 'softball_baseball', 'football_rugby', 'cricket', 'park_cleanup', 'clean_blocks', 'tree_tending', 'friends_of_park', 'dog_owner_groups']);
const INDOOR_FAMILIES = new Set([
  'books-writing',
  'games-puzzles',
  'arts-crafts',
  'music',
  'theater-dance-performance',
  'making-tech',
  'science-learning',
  'culture-language-heritage-groups',
  'food-drink',
  'careers-skills-professional',
  'health-wellness',
]);

const PARENTS: [RegExp, string][] = [
  [/free library/, 'free-library'],
  [/parks (and|&) rec|philadelphia parks/, 'parks-and-rec'],
  [/habitat for humanity/, 'habitat'],
  [/boys? (and|&) girls? club/, 'boys-girls-club'],
  [/(girl|boy) scouts?/, 'scouts'],
  [/\bymca\b/, 'ymca'],
];

/** The organization behind a group, worked out from its name. Replace with a `parent_org` field when the data has one. */
export function orgKey(g: Group): string {
  if (g.kind === 'student_org' && g.audience.school) return `school:${g.audience.school}`;
  const name = g.name.toLowerCase();
  for (const [re, key] of PARENTS) if (re.test(name)) return key;
  const head = name.split(/\s[-:|]\s|:|\||\(| at /)[0] ?? name;
  return slugify(head.replace(/^the /, '')) || g.id;
}

export function groupPoints(g: Group): Point[] {
  const out: Point[] = [];
  for (const loc of placeLocations(g)) {
    if (loc.lat !== undefined && loc.lng !== undefined) {
      out.push({ at: [loc.lat, loc.lng], precision: 'exact' });
      continue;
    }
    const hood = loc.neighborhood ? neighborhoodCenter(loc.neighborhood) : null;
    if (hood) {
      out.push({ at: hood, precision: 'neighborhood' });
      continue;
    }
    const zip = loc.zip ? zipCenter(loc.zip) : null;
    if (zip) {
      out.push({ at: zip, precision: 'zip' });
      continue;
    }
    const d = loc.planning_district ? districtCenter(loc.planning_district) : null;
    if (d) out.push({ at: d, precision: 'district' });
  }
  return out;
}

function waysOf(g: Group, cat: Catalog): Set<WayId> {
  const ways = new Set<WayId>();
  for (const t of g.interests) for (const w of cat.tagWays.get(t) ?? []) if (w !== 'lead_it') ways.add(w);
  // Roles and formats, for groups whose tags the vocabulary does not list under any way in.
  if (g.formats.includes('learn_skill')) ways.add('learn_it');
  if (g.formats.includes('behind_the_scenes')) ways.add('serve_it');
  if (g.roles.includes('help_teach')) ways.add('teach_it');
  const doing = ['side_by_side', 'team_play', 'perform_make_together', 'conversation'];
  if (g.formats.some((f) => doing.includes(f)) || g.roles.some((r) => r === 'hands_on' || r === 'create' || r === 'figure_out')) ways.add('do_it');
  return ways;
}

function outdoorsOf(g: Group, families: string[]): boolean | null {
  if (g.interests.some((t) => OUTDOOR_TAGS.has(t)) || families.some((f) => OUTDOOR_FAMILIES.has(f))) return true;
  if (families.length > 0 && families.every((f) => INDOOR_FAMILIES.has(f))) return false;
  return null;
}

function completenessOf(g: Group, points: Point[]): number {
  const checks = [
    g.schedule.days.length > 0,
    g.schedule.times.length > 0,
    g.cost.level !== 'unknown',
    g.commitment !== undefined,
    g.group_size !== undefined,
    g.first_step.newcomer_friendliness !== undefined,
    g.access.wheelchair !== 'unknown',
    points.length > 0,
    g.roles.length > 0,
    g.formats.length > 0,
    g.motives.length > 0,
    g.summary.length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

const caches = new WeakMap<Catalog, WeakMap<Group, Prepared>>();

export function prepare(g: Group, cat: Catalog): Prepared {
  let cache = caches.get(cat);
  if (!cache) {
    cache = new WeakMap();
    caches.set(cat, cache);
  }
  const hit = cache.get(g);
  if (hit) return hit;
  const families = groupFamilies(g, cat);
  const points = groupPoints(g);
  const locs = placeLocations(g);
  const p: Prepared = {
    g,
    families,
    primary: g.categories[0] ?? families[0] ?? 'other',
    tags: g.interests,
    org: orgKey(g),
    points,
    districts: locs.map((l) => slugify(l.planning_district ?? '')).filter(Boolean),
    hoods: locs.map((l) => (l.neighborhood ?? '').toLowerCase().replace(/[-\s]+/g, '_')).filter(Boolean),
    ways: waysOf(g, cat),
    faith: isFaithGroup(g),
    support: g.audience.support_group || g.kind === 'support_group' || families.some((f) => cat.supportFamilies.has(f)),
    outdoors: outdoorsOf(g, families),
    philly: families.some((f) => PHILLY_FAMILIES.has(f)) || g.interests.some((t) => PHILLY_TAGS.has(t)),
    completeness: completenessOf(g, points),
    onlineOnly: g.online_ok && g.locations.every((l) => !l.in_city),
  };
  cache.set(g, p);
  return p;
}
