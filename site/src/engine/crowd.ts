import type { Prepared } from './prepare';
import type { Profile } from './profile';

// Who is in the room, and whether that is who the person wants to meet (quiz question 6).

/** Crowds that welcome nearly anyone, so they never count as a new crowd. */
export const BROAD_CROWDS = new Set(['all_ages', 'all_adults', 'neighbors', 'newcomers']);

/** Crowds the person is already at home with, from their age and path. */
export function familiarCrowds(profile: Profile): Set<string> {
  const out = new Set<string>(['all_ages', 'all_adults', 'neighbors']);
  const { lo, hi } = profile.age;
  if (hi < 18) {
    out.add('teens');
    out.add('students');
  } else if (lo < 25) {
    out.add('young_adults');
    out.add('students');
  }
  if (lo >= 22 && hi < 40) {
    out.add('young_adults');
    out.add('professionals');
  }
  if (lo >= 30 && hi < 60) out.add('professionals');
  if (lo >= 55) out.add('seniors');
  const paths = profile.answers.paths;
  if (paths.includes('newcomer')) out.add('newcomers');
  if (paths.includes('kids')) {
    out.add('families');
    out.add('kids');
  }
  if (paths.includes('student')) out.add('students');
  return out;
}

/** The group's crowd is made up only of people the person is not like. Unknown crowds never count. */
export function crowdDisjoint(p: Prepared, profile: Profile): boolean {
  const crowd = p.g.crowd;
  if (crowd.length === 0) return false;
  if (crowd.some((c) => BROAD_CROWDS.has(c))) return false;
  const mine = familiarCrowds(profile);
  return !crowd.some((c) => mine.has(c));
}

/** A community the person said they would like to find, that the group is for (LGBTQ+, veterans, ...). */
export function communityMatch(p: Prepared, profile: Profile): string | null {
  const wanted = profile.answers.meet?.communities ?? [];
  if (wanted.length === 0) return null;
  return p.g.audience.community.find((c) => wanted.includes(c)) ?? null;
}

/**
 * How well the people in the room match who the person wants to meet, 0 to 1. Null when we know
 * nothing about the group's crowd.
 */
export function crowdFit(p: Prepared, profile: Profile): number | null {
  const g = p.g;
  if (communityMatch(p, profile)) return 1;
  if (g.crowd.length === 0 && !g.bridging) return null;
  const meet = profile.answers.meet;
  const mixed = g.bridging || g.crowd.includes('all_ages');
  const disjoint = crowdDisjoint(p, profile);
  if (!meet) return disjoint ? 0.3 : 0.6;
  const sameAge = meet.sameAge === true;
  if (meet.with === 'similar') return disjoint ? 0.15 : mixed ? 0.6 : 1;
  if (meet.with === 'different') return mixed || disjoint ? 1 : 0.4;
  // a mix
  return mixed ? 1 : disjoint ? (sameAge ? 0.2 : 0.7) : 0.7;
}
