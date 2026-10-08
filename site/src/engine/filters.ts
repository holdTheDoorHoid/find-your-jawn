import { timesMatch } from '../lib/filters';
import { languageBase } from '../lib/language';
import { acceptsCourtOrdered, welcomesKids } from '../lib/paths';
import type { Group } from '../lib/types';
import type { Precision, Prepared } from './prepare';
import type { Profile } from './profile';
import { haversineKm, straightLineTravel, type MovingMode, type TravelModel } from './travel';
import type { Answers, BlockerKey, Diagnosis, NoteKey } from './types';

// Hard filters (DESIGN section 3). A group that fails here is never shown in quiz results.
//
// Every locked answer returns one of three things for a group:
//   pass     we know the group meets it
//   fail     we know the group breaks it, so the group is out
//   unknown  the group's page does not say. We let it through but rank it below known passes and
//            say so on the card ("Cost not listed"). Real data has gaps, and "we do not know" is
//            not the same as "no".

export type Verdict = 'pass' | 'unknown' | 'fail';

export interface Evaluation {
  /** false when a rule that no answer can loosen rules the group out */
  baseOk: boolean;
  /** why the base rules failed, for tests and the empty state */
  baseWhy?: 'status' | 'tier' | 'partisan' | 'support' | 'hidden' | 'open_to' | 'age' | 'faith';
  /** locked answers (and path rules) that the group breaks */
  fails: BlockerKey[];
  /** locked answers we cannot check for this group */
  unknown: NoteKey[];
  /** estimated minutes from where the person starts, in the way they travel, when we can tell */
  minutes?: number;
  precision?: Precision;
}

/** Practical limits that stretches must never break, whether or not the person locked them. */
export const STRICT_KEYS: readonly BlockerKey[] = ['budget', 'when', 'often', 'far', 'wheelchair', 'languages', 'background'];

/** Extra minutes of doubt allowed before a group with only a rough location fails a travel limit. */
const SLACK: Record<Precision, number> = { exact: 0, neighborhood: 4, zip: 4, district: 12 };

/** Commitment from lightest to heaviest, for the "how often" answer. */
const COMMIT_RANK: Record<string, number> = { one_off: 0, drop_in: 0, seasonal: 1, monthly: 1, weekly: 2, ongoing_role: 3 };
const FREQ_RANK: Record<string, number> = { once: 0, monthly: 1, weekly: 2, any: 3 };

export interface EvalOptions {
  travel?: TravelModel;
  /** treat the practical answers as locks even when the person did not lock them (stretches) */
  strict?: boolean;
}

function isLoose(a: Answers, key: BlockerKey): boolean {
  return a.loose?.includes(key) ?? false;
}

/** Work with children, for the court ordered restriction "no work with children". */
export function worksWithChildren(g: Group): boolean {
  if (g.requirements.act153_clearances) return true;
  if (g.categories.includes('kids-youth-mentoring')) return true;
  const young = g.crowd.some((c) => c === 'kids' || c === 'teens');
  return young && g.roles.includes('help_teach');
}

/** Minutes from the person's starting point to the nearest point of the group, in their way of travelling. */
export function travelEstimate(
  p: Prepared,
  profile: Profile,
  travel: TravelModel = straightLineTravel,
): { minutes: number; precision: Precision; mode: MovingMode } | null {
  const far = profile.answers.far;
  if (!far || far.mode === 'anywhere' || !profile.home || p.points.length === 0) return null;
  const mode: MovingMode = far.mode;
  let best: { minutes: number; precision: Precision } | null = null;
  for (const pt of p.points) {
    const m = travel.minutes(profile.home, pt.at, mode);
    if (!best || m < best.minutes) best = { minutes: m, precision: pt.precision };
  }
  return best ? { ...best, mode } : null;
}

/** Straight line kilometers to the nearest point, for "people who live in the area" rules. */
function nearestKm(p: Prepared, profile: Profile): { km: number; precision: Precision } | null {
  if (!profile.home || p.points.length === 0) return null;
  let best: { km: number; precision: Precision } | null = null;
  for (const pt of p.points) {
    const km = haversineKm(profile.home, pt.at);
    if (!best || km < best.km) best = { km, precision: pt.precision };
  }
  return best;
}

export function evaluate(p: Prepared, profile: Profile, opts: EvalOptions = {}): Evaluation {
  const a = profile.answers;
  const g = p.g;
  const travel = opts.travel ?? straightLineTravel;
  const out: Evaluation = { baseOk: true, fails: [], unknown: [] };

  const baseFail = (why: NonNullable<Evaluation['baseWhy']>) => {
    out.baseOk = false;
    out.baseWhy ??= why;
  };
  const fail = (key: BlockerKey) => {
    if (!out.fails.includes(key)) out.fails.push(key);
  };
  const unknown = (key: NoteKey) => {
    if (!out.unknown.includes(key)) out.unknown.push(key);
  };
  /** A lock counts when the person locked it, or when strict mode is on for a practical limit. */
  const active = (key: BlockerKey, locked: boolean | undefined): boolean => {
    if (isLoose(a, key)) return false;
    if (locked) return true;
    return Boolean(opts.strict) && STRICT_KEYS.includes(key);
  };

  // ---- rules no answer can loosen
  if (g.status === 'defunct' || g.status === 'dormant') baseFail('status');
  if (g.research_tier < 1) baseFail('tier');
  if (g.audience.partisan) baseFail('partisan');
  if (p.support && !a.includeSupport) baseFail('support');
  if (profile.feedback.hidden.has(g.id)) baseFail('hidden');

  // Age: a group the person is too young or too old for is never shown. On the kids path, a group
  // where kids can come along is judged by the children's ages, because the parent is only there
  // with them (a youth league with a maximum age of 14 is exactly what a parent of an 8 year old wants).
  const { min_age: min, max_age: max } = g.audience;
  const forTheKids = a.paths.includes('kids') && !isLoose(a, 'kids') && g.requirements.kids_ok;
  if (!forTheKids && ((min !== undefined && min > profile.age.lo) || (max !== undefined && max < profile.age.hi))) baseFail('age');

  // Who may join.
  switch (g.audience.open_to) {
    case 'public':
      break;
    case 'students':
      if (!a.school) baseFail('open_to');
      else if (!g.audience.school) unknown('school');
      else if (g.audience.school !== a.school) baseFail('open_to');
      break;
    case 'parents': {
      const parent = a.paths.includes('kids') || (a.kidsAges?.length ?? 0) > 0 || (a.meet?.communities ?? []).includes('parents');
      if (!parent) baseFail('open_to');
      break;
    }
    case 'residents': {
      const near = nearestKm(p, profile);
      if (!near || near.precision === 'district') unknown('residents');
      else if (near.km > 3) baseFail('open_to');
      break;
    }
    default:
      // members only, by invitation
      baseFail('open_to');
  }

  // Faith: out when excluded, and other traditions out when the person wants only their own.
  const faith = a.faith;
  if (p.faith && faith) {
    if (faith.mode === 'exclude') baseFail('faith');
    else if (faith.mode === 'only' && faith.tradition) {
      const mine = g.audience.faith;
      if (!mine) unknown('faith');
      else if (mine !== faith.tradition && mine !== 'interfaith') baseFail('faith');
    }
  }
  if (!out.baseOk) return out;

  // ---- paths (DESIGN section 6)
  if (a.paths.includes('court') && !isLoose(a, 'path')) {
    if (!acceptsCourtOrdered(g)) fail('path');
    else if (a.court?.noChildren && worksWithChildren(g)) fail('path');
  }
  if (a.paths.includes('hours') && a.hours?.form && !isLoose(a, 'form')) {
    const letter = g.requirements.service_hours_letter;
    if (letter === 'no') fail('form');
    else if (letter === 'unknown') unknown('hours_form');
  }
  if (a.paths.includes('kids') && !isLoose(a, 'kids')) {
    const youngest = Math.min(...((a.kidsAges?.length ?? 0) > 0 ? (a.kidsAges as number[]) : [12]));
    const { min_age: kidMin, max_age: kidMax } = g.audience;
    if (!welcomesKids(g) || (kidMin !== undefined && kidMin > youngest) || (kidMax !== undefined && kidMax < youngest)) fail('kids');
  }

  // ---- locked answers
  if (a.budget && a.budget.value !== 'any' && active('budget', a.budget.locked)) {
    const level = g.cost.level;
    if (level === 'unknown') unknown('cost');
    else if (level === 'paid') fail('budget');
    else if (level === 'low' && a.budget.value === 'free') fail('budget');
  }

  if (a.when && !a.when.flexible && (a.when.days.length > 0 || a.when.times.length > 0) && active('when', a.when.locked)) {
    const dayKnown = g.schedule.days.length > 0 && a.when.days.length > 0;
    const timeKnown = g.schedule.times.length > 0 && a.when.times.length > 0;
    if (!dayKnown && !timeKnown) unknown('schedule');
    else {
      if (dayKnown && !g.schedule.days.some((d) => a.when!.days.includes(d))) fail('when');
      if (timeKnown && !timesMatch(g.schedule.times, a.when.times)) fail('when');
    }
  }

  if (a.often && a.often.value !== 'any' && active('often', a.often.locked)) {
    const rank = g.commitment ? COMMIT_RANK[g.commitment] : undefined;
    if (rank === undefined) unknown('frequency');
    else if (rank > (FREQ_RANK[a.often.value] ?? 3)) fail('often');
  }

  // Online only groups have no place to travel to.
  if (p.onlineOnly) {
    if (a.follow.online === 'no') fail('online');
    else if (a.far && a.far.mode !== 'anywhere' && active('far', a.far.locked) && a.follow.online !== 'yes') fail('far');
  } else if (a.far && a.far.mode !== 'anywhere' && profile.home) {
    const est = travelEstimate(p, profile, travel);
    if (est) {
      out.minutes = est.minutes;
      out.precision = est.precision;
      const limit = a.far.minutes * profile.feedback.travelScale;
      if (active('far', a.far.locked) && est.minutes - SLACK[est.precision] > limit) {
        // An online option rescues a group that is too far only when the person is fine with online.
        if (!(g.online_ok && a.follow.online === 'yes')) fail('far');
      }
    } else if (active('far', a.far.locked)) {
      unknown('distance');
    }
  }

  if (a.wheelchair?.value && active('wheelchair', a.wheelchair.locked)) {
    const w = g.access.wheelchair;
    if (w === 'no') fail('wheelchair');
    else if (w === 'partial') unknown('access_partial');
    else if (w !== 'yes') unknown('access');
  }

  if (a.languages && a.languages.codes.length > 0 && active('languages', a.languages.locked)) {
    const wanted = new Set(a.languages.codes.map(languageBase));
    const offered = g.access.languages.map(languageBase);
    for (const c of g.audience.community) if (c.startsWith('language:')) offered.push(languageBase(c.slice(9)));
    if (offered.length === 0) unknown('languages');
    else if (!offered.some((l) => wanted.has(l))) fail('languages');
  }

  if (a.noBackgroundCheck?.value && active('background', a.noBackgroundCheck.locked)) {
    if (g.requirements.background_check || g.requirements.act153_clearances) fail('background');
    // The data leaves out a "no", so only a deep research pass can say the answer is no.
    else if (g.research_tier < 2) unknown('background');
  }

  // Strangers feel hard: groups rated under 3 for newcomers are out. No rating means unknown.
  if (profile.hardStrangers && !isLoose(a, 'newcomer')) {
    const nf = g.first_step.newcomer_friendliness;
    if (nf === undefined) unknown('newcomer');
    else if (nf < 3) fail('newcomer');
  }

  return out;
}

/** A group is shown in results only when nothing base or locked rules it out. */
export function passes(e: Evaluation): boolean {
  return e.baseOk && e.fails.length === 0;
}

// ---------------------------------------------------------------- the honest empty state

/** Keys the visitor can loosen, and the one tap that does it. */
export const LOOSENABLE: readonly BlockerKey[] = ['budget', 'when', 'often', 'far', 'wheelchair', 'languages', 'background', 'path', 'form', 'kids', 'newcomer', 'online'];

/**
 * Which answers are doing the blocking. For every group that passes the rules no answer can loosen,
 * count the locked answers it breaks. A group blocked by exactly one answer counts for that answer
 * ("these would come back"); groups blocked by several count toward each of them, less strongly.
 */
export function diagnose(evals: Evaluation[]): Diagnosis {
  let pool = 0;
  let passed = 0;
  const solo = new Map<BlockerKey, number>();
  const shared = new Map<BlockerKey, number>();
  for (const e of evals) {
    if (!e.baseOk) continue;
    pool += 1;
    if (e.fails.length === 0) {
      passed += 1;
      continue;
    }
    if (e.fails.length === 1) solo.set(e.fails[0]!, (solo.get(e.fails[0]!) ?? 0) + 1);
    else for (const k of e.fails) shared.set(k, (shared.get(k) ?? 0) + 1);
  }
  const keys = new Set<BlockerKey>([...solo.keys(), ...shared.keys()]);
  const blockers = [...keys]
    .map((key) => ({ key, count: solo.get(key) ?? 0, shared: shared.get(key) ?? 0 }))
    .sort((x, y) => y.count - x.count || y.shared - x.shared)
    .map(({ key, count }) => ({ key, count }));
  return { pool, passed, blockers };
}

/** Add a key to the loosened list. Pure, so the island and the tests share it. */
export function loosen(a: Answers, key: BlockerKey): Answers {
  return { ...a, loose: [...new Set([...(a.loose ?? []), key])] };
}
