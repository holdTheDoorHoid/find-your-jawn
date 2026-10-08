import { timesMatch } from '../lib/filters';
import { crowdFit } from './crowd';
import { languageBase } from '../lib/language';
import { monthsSince } from '../lib/dates';
import { acceptsCourtOrdered } from '../lib/paths';
import type { Group } from '../lib/types';
import type { Evaluation } from './filters';
import type { Prepared } from './prepare';
import type { Evidence, Profile } from './profile';
import { similarity } from './similarity';
import type { NoteKey, PartName, Parts } from './types';

// The score (DESIGN section 3). Each part runs from 0 to 1, then the parts are weighted.
//
// Rules the parts follow:
//   - A fact the group's page does not give scores NEUTRAL (about 0.5), never zero.
//   - A question the person did not answer scores 0.5 for every group, so it cannot split them.
//   - Nothing here is hidden: `explain.ts` reads the evidence collected here to say why.

/** The weights, in one place. Starting values; the simulation in DESIGN section 12 tunes them. */
export const WEIGHTS: Readonly<Record<PartName, number>> = {
  interest: 0.25,
  motive: 0.2,
  roleFormat: 0.15,
  practical: 0.15,
  taste: 0.1,
  newcomer: 0.1,
  regular: 0.03,
  confidence: 0.02,
};

/** The newcomer part counts for this much when strangers feel hard (DESIGN: rises to 20 percent). */
export const NEWCOMER_WEIGHT_HARD = 0.2;

/**
 * Groups are shown in tiers: first the ones that pass every locked answer by what their page says,
 * then the ones with one locked answer we could not check, then two or more, and last the ones
 * whose place we could not find when distance is locked. Inside a tier, the score decides.
 */
export function rankTier(unknown: readonly NoteKey[]): number {
  if (unknown.includes('distance')) return 3;
  return Math.min(2, unknown.length);
}

/** Small lifts for things a path asks for, added after the weighted parts. */
export const PATH_BOOST = { hoursForm: 0.08, newcomer: 0.06, student: 0.08, faithTradition: 0.05, kids: 0.04 } as const;

/** Parts of practical fit and how much each counts when the person gave an answer for it. */
const PRACTICAL_WEIGHTS = { schedule: 1, travel: 1, commitment: 0.6, size: 0.5, cost: 1, language: 0.5, access: 0.8, follow: 0.4 } as const;

export interface Evidences {
  interest?: { ev: Evidence; matched: string };
  motive?: string;
  role?: { id: string; scene?: string };
  format?: { id: string; scene?: string };
  practical: {
    schedule?: { days: string[]; times: string[] };
    travel?: { minutes: number; limit: number };
    cost?: 'free' | 'low';
    language?: string;
    access?: boolean;
    follow: string[];
  };
  taste?: { liked: Group };
  newcomer?: { nf?: number };
  regular?: boolean;
}

export interface Scored {
  p: Prepared;
  ev: Evaluation;
  parts: Parts;
  /** weighted parts, 0 to 1 */
  total: number;
  /** weighted parts plus path lifts, 0 to 1 */
  score: number;
  /** 0 when every locked answer is confirmed, higher when some could not be checked (see rankTier) */
  tier: number;
  evidence: Evidences;
  /** locked answers we could not check */
  unknown: NoteKey[];
  boosts: string[];
}

export interface TasteSets {
  into: Prepared[];
  maybe: Prepared[];
  not: { p: Prepared; weight: number }[];
  already: Prepared[];
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

// ---------------------------------------------------------------- the parts

function interestPart(p: Prepared, profile: Profile): { value: number; evidence?: Evidences['interest'] } {
  if (profile.tagW.size === 0 && profile.famW.size === 0) return { value: 0.5 };
  let best = 0;
  let second = 0;
  let bestEv: Evidences['interest'];
  const consider = (w: number, ev: Evidence | undefined, matched: string) => {
    if (w <= 0) return;
    if (w > best) {
      second = best;
      best = w;
      if (ev) bestEv = { ev, matched };
    } else if (w > second) second = w;
  };
  for (const t of p.tags) consider(profile.tagW.get(t) ?? 0, profile.tagEv.get(t), t);
  for (const f of p.families) consider(profile.famW.get(f) ?? 0, profile.famEv.get(f), f);
  // "Not my thing" taps push away from the same interests and, more gently, the same families.
  let avoid = 0;
  for (const t of p.tags) avoid = Math.max(avoid, profile.feedback.avoidTags.get(t) ?? 0);
  for (const f of p.families) avoid = Math.max(avoid, (profile.feedback.avoidFamilies.get(f) ?? 0) * 0.5);
  return { value: clamp(best + 0.15 * second - 0.6 * avoid), evidence: bestEv };
}

function motivePart(p: Prepared, profile: Profile): { value: number; motive?: string } {
  if (!profile.hasMotive) return { value: 0.5 };
  const known = p.g.motives.filter((m) => profile.motiveW.has(m));
  if (known.length === 0) return { value: 0.5 };
  const ws = known.map((m) => profile.motiveW.get(m) ?? 0);
  const value = 0.65 * Math.max(...ws) + 0.35 * avg(ws);
  const top = known.reduce((a, b) => ((profile.motiveW.get(b) ?? 0) > (profile.motiveW.get(a) ?? 0) ? b : a));
  return { value, motive: (profile.motiveW.get(top) ?? 0) >= 0.75 ? top : undefined };
}

function roleFormatPart(p: Prepared, profile: Profile): { value: number; role?: Evidences['role']; format?: Evidences['format'] } {
  const part = (have: string[], want: Map<string, number>): { v: number; best?: string } | null => {
    if (want.size === 0 || have.length === 0) return null;
    const ws = have.map((h) => want.get(h) ?? 0);
    const max = Math.max(...ws);
    const best = have[ws.indexOf(max)];
    return { v: 0.7 * max + 0.3 * avg(ws), best: max >= 0.6 ? best : undefined };
  };
  const r = part(p.g.roles, profile.roleW);
  const f = part(p.g.formats, profile.formatW);
  const vals = [r?.v, f?.v, crowdFit(p, profile) ?? undefined].filter((x): x is number => x !== undefined);
  if (vals.length === 0) return { value: 0.5 };
  return {
    value: avg(vals),
    role: r?.best ? { id: r.best, scene: profile.roleScene.get(r.best) } : undefined,
    format: f?.best ? { id: f.best, scene: profile.formatScene.get(f.best) } : undefined,
  };
}

function travelScore(minutes: number, limit: number): number {
  if (minutes <= 0.5 * limit) return 1;
  if (minutes <= limit) return 1 - (0.4 * (minutes - 0.5 * limit)) / (0.5 * limit);
  return Math.max(0, 0.6 - (0.6 * (minutes - limit)) / (0.5 * limit));
}

const SIZE_ORDER: Record<string, number> = { small: 0, medium: 1, large: 2 };
const COMMIT_RANK: Record<string, number> = { one_off: 0, drop_in: 0, seasonal: 1, monthly: 1, weekly: 2, ongoing_role: 3 };
const FREQ_RANK: Record<string, number> = { once: 0, monthly: 1, weekly: 2, any: 3 };

function practicalPart(p: Prepared, ev: Evaluation, profile: Profile): { value: number; evidence: Evidences['practical'] } {
  const a = profile.answers;
  const g = p.g;
  const fb = profile.feedback;
  const parts: { w: number; v: number }[] = [];
  const evidence: Evidences['practical'] = { follow: [] };

  // Schedule
  if (a.when && !a.when.flexible && (a.when.days.length > 0 || a.when.times.length > 0)) {
    const vs: number[] = [];
    const days = g.schedule.days.filter((d) => a.when!.days.includes(d));
    if (g.schedule.days.length > 0 && a.when.days.length > 0) vs.push(days.length > 0 ? 1 : 0);
    const timeOk = timesMatch(g.schedule.times, a.when.times);
    if (g.schedule.times.length > 0 && a.when.times.length > 0) vs.push(timeOk ? 1 : 0);
    if (vs.length > 0 && vs.every((v) => v === 1)) {
      evidence.schedule = { days, times: g.schedule.times.filter((t) => a.when!.times.includes(t) || t === 'daytime') };
    }
    parts.push({ w: PRACTICAL_WEIGHTS.schedule * fb.boost.schedule, v: vs.length > 0 ? avg(vs) : 0.5 });
  } else if (a.when?.flexible) {
    const easy = g.first_step.drop_in === true || g.commitment === 'drop_in' || g.commitment === 'one_off';
    parts.push({ w: 0.5, v: easy ? 1 : g.commitment || g.first_step.drop_in !== undefined ? 0.4 : 0.5 });
  } else if (fb.avoidSlots.size > 0 && g.schedule.days.length > 0) {
    // "Wrong time" taps with no schedule answer: steer away from the same days and times.
    let hits = 0;
    for (const d of g.schedule.days) for (const t of g.schedule.times.length ? g.schedule.times : ['any']) hits += fb.avoidSlots.get(`${d}|${t}`) ?? 0;
    parts.push({ w: PRACTICAL_WEIGHTS.schedule * fb.boost.schedule, v: clamp(1 - 0.35 * hits) });
  }

  // Travel
  if (a.far && a.far.mode !== 'anywhere' && profile.home) {
    const limit = a.far.minutes * fb.travelScale;
    if (p.onlineOnly) parts.push({ w: PRACTICAL_WEIGHTS.travel * fb.boost.travel, v: a.follow.online === 'yes' ? 1 : 0.2 });
    else if (ev.minutes !== undefined) {
      parts.push({ w: PRACTICAL_WEIGHTS.travel * fb.boost.travel, v: travelScore(ev.minutes, limit) });
      if (ev.minutes <= limit) evidence.travel = { minutes: ev.minutes, limit };
    } else parts.push({ w: PRACTICAL_WEIGHTS.travel * fb.boost.travel, v: 0.5 });
  }

  // How often
  if (a.often && a.often.value !== 'any') {
    const rank = g.commitment ? COMMIT_RANK[g.commitment] : undefined;
    const want = FREQ_RANK[a.often.value] ?? 3;
    parts.push({ w: PRACTICAL_WEIGHTS.commitment, v: rank === undefined ? 0.5 : rank <= want ? 1 - 0.15 * (want - rank) : 0.1 });
  }

  // Group size: asked outright, or leaned toward by "too many people" taps and hard strangers.
  const sizePref = a.size && a.size !== 'any' ? a.size : fb.smallBias > 0 || profile.hardStrangers ? 'small' : null;
  if (sizePref) {
    const have = g.group_size ? SIZE_ORDER[g.group_size] : undefined;
    const want = SIZE_ORDER[sizePref] ?? 0;
    const w = PRACTICAL_WEIGHTS.size * fb.boost.size * (a.size && a.size !== 'any' ? 1 : 0.6);
    parts.push({ w, v: have === undefined ? 0.5 : Math.abs(have - want) === 0 ? 1 : Math.abs(have - want) === 1 ? 0.45 : 0.1 });
  }

  // Cost: asked, or leaned toward by "cost" taps.
  const budget = a.budget && a.budget.value !== 'any' ? a.budget.value : fb.cheaper > 0 ? 'low' : null;
  if (budget) {
    const level = g.cost.level;
    let v = 0.5;
    if (level === 'free') {
      v = 1;
      evidence.cost = 'free';
    } else if (level === 'low') {
      v = budget === 'free' ? 0.5 : 1;
      if (budget !== 'free') evidence.cost = 'low';
    } else if (level === 'paid') v = budget === 'free' ? 0 : 0.2;
    parts.push({ w: PRACTICAL_WEIGHTS.cost * fb.boost.cost, v });
  }

  // Languages
  if (a.languages && a.languages.codes.length > 0) {
    const wanted = a.languages.codes.map(languageBase);
    const offered = g.access.languages.map(languageBase);
    const wantsOther = wanted.filter((l) => l !== 'en');
    if (offered.length === 0) parts.push({ w: PRACTICAL_WEIGHTS.language, v: 0.5 });
    else {
      const hit = wanted.find((l) => offered.includes(l));
      parts.push({ w: PRACTICAL_WEIGHTS.language, v: hit ? 1 : 0.2 });
      if (hit && wantsOther.includes(hit)) evidence.language = hit;
    }
  }

  // Access
  if (a.wheelchair?.value) {
    const w = g.access.wheelchair;
    parts.push({ w: PRACTICAL_WEIGHTS.access, v: w === 'yes' ? 1 : w === 'partial' ? 0.4 : w === 'no' ? 0 : 0.5 });
    if (w === 'yes') evidence.access = true;
  }

  // Follow ups
  const follow = a.follow;
  if (follow.setting && follow.setting !== 'either' && p.outdoors !== null) {
    const ok = (follow.setting === 'outdoors') === p.outdoors;
    parts.push({ w: PRACTICAL_WEIGHTS.follow, v: ok ? 1 : 0.15 });
    if (ok) evidence.follow.push(follow.setting === 'outdoors' ? 'outdoors' : 'indoors');
  }
  if (follow.competition && follow.competition !== 'either') {
    const competitive = g.kind === 'team' || g.formats.includes('team_play');
    const known = g.kind === 'team' || g.formats.length > 0;
    if (known) {
      const ok = (follow.competition === 'competitive') === competitive;
      parts.push({ w: PRACTICAL_WEIGHTS.follow, v: ok ? 1 : 0.2 });
      if (ok) evidence.follow.push(follow.competition === 'competitive' ? 'competitive' : 'casual');
    }
  }
  if (follow.online === 'yes' && g.online_ok) {
    parts.push({ w: PRACTICAL_WEIGHTS.follow, v: 1 });
    evidence.follow.push('online');
  }
  if (follow.cadence && follow.cadence !== 'either' && g.commitment) {
    const oneTime = g.commitment === 'one_off' || g.commitment === 'drop_in' || g.schedule.season === 'event_only';
    const ok = (follow.cadence === 'one_time') === oneTime;
    parts.push({ w: PRACTICAL_WEIGHTS.follow, v: ok ? 1 : 0.2 });
    if (ok) evidence.follow.push(follow.cadence === 'one_time' ? 'one_time' : 'ongoing');
  }
  if (follow.kids_along === 'yes') {
    parts.push({ w: PRACTICAL_WEIGHTS.follow * 1.5, v: g.requirements.kids_ok ? 1 : 0.25 });
    if (g.requirements.kids_ok) evidence.follow.push('kids');
  }

  if (parts.length === 0) return { value: 0.5, evidence };
  const totalW = parts.reduce((s, x) => s + x.w, 0);
  return { value: parts.reduce((s, x) => s + x.w * x.v, 0) / totalW, evidence };
}

function tastePart(p: Prepared, taste: TasteSets): { value: number; liked?: Group } {
  if (taste.into.length + taste.maybe.length + taste.not.length + taste.already.length === 0) return { value: 0.5 };
  let up = 0;
  let liked: Group | undefined;
  for (const q of taste.into) {
    const s = similarity(p, q);
    if (s > up) {
      up = s;
      liked = q.g;
    }
  }
  for (const q of taste.already) up = Math.max(up, 0.7 * similarity(p, q));
  for (const q of taste.maybe) up = Math.max(up, 0.4 * similarity(p, q));
  let down = 0;
  for (const n of taste.not) down = Math.max(down, n.weight * similarity(p, n.p));
  // A group is the same group as one already liked: not a new idea, but still a fit.
  return { value: clamp(0.5 + 0.55 * up - 0.6 * down), liked: up >= 0.3 ? liked : undefined };
}

function newcomerPart(p: Prepared): { value: number; nf?: number } {
  const g = p.g;
  const nf = g.first_step.newcomer_friendliness;
  if (nf !== undefined) return { value: (nf - 1) / 4, nf };
  let v = 0.5;
  if (g.crowd.includes('newcomers')) v += 0.15;
  if (g.first_step.drop_in === true) v += 0.1;
  if (g.first_step.sign_up_needed === true) v -= 0.05;
  return { value: clamp(v, 0.35, 0.75) };
}

function regularPart(p: Prepared): { value: number; regular: boolean } {
  const g = p.g;
  const recurring = g.schedule.recurring === undefined ? 0.5 : g.schedule.recurring ? 1 : 0;
  const place = p.onlineOnly ? 0.2 : p.points.length > 0 ? 1 : 0.5;
  const dropIn = g.first_step.drop_in === undefined ? (g.commitment === 'weekly' || g.commitment === 'drop_in' ? 0.8 : 0.5) : g.first_step.drop_in ? 1 : 0.4;
  const value = avg([recurring, place, dropIn]);
  return { value, regular: recurring === 1 && place === 1 && dropIn >= 0.8 };
}

function confidencePart(p: Prepared, now: Date): number {
  const g = p.g;
  const tier = [0.2, 0.5, 0.8, 1][Math.min(3, Math.max(0, g.research_tier))] ?? 0.5;
  const months = monthsSince(g.last_sign_of_life, now);
  const recency = months === null ? 0.3 : months <= 6 ? 1 : months <= 12 ? 0.8 : months <= 24 ? 0.45 : 0.2;
  const status = g.status === 'active' ? 1 : g.status === 'probably_active' ? 0.7 : 0.4;
  return 0.3 * tier + 0.25 * recency + 0.15 * status + 0.3 * p.completeness;
}

// ---------------------------------------------------------------- the whole score

export function scoreGroup(p: Prepared, ev: Evaluation, profile: Profile, taste: TasteSets, now: Date): Scored {
  const interest = interestPart(p, profile);
  const motive = motivePart(p, profile);
  const rf = roleFormatPart(p, profile);
  const practical = practicalPart(p, ev, profile);
  const tasteP = tastePart(p, taste);
  const newcomer = newcomerPart(p);
  const regular = regularPart(p);

  const parts: Parts = {
    interest: interest.value,
    motive: motive.value,
    roleFormat: rf.value,
    practical: practical.value,
    taste: tasteP.value,
    newcomer: newcomer.value,
    regular: regular.value,
    confidence: confidencePart(p, now),
  };

  const weights: Record<PartName, number> = { ...WEIGHTS };
  if (profile.hardStrangers) weights.newcomer = NEWCOMER_WEIGHT_HARD;
  let sum = 0;
  let wsum = 0;
  for (const k of Object.keys(weights) as PartName[]) {
    sum += weights[k] * parts[k];
    wsum += weights[k];
  }
  const total = sum / wsum;

  // Lifts a path asks for.
  const a = profile.answers;
  const boosts: string[] = [];
  let lift = 0;
  const g = p.g;
  if (a.paths.includes('hours') && a.hours?.form && g.requirements.service_hours_letter === 'yes') {
    lift += PATH_BOOST.hoursForm;
    boosts.push('hours_form');
  }
  if (a.paths.includes('court') && acceptsCourtOrdered(g)) boosts.push('court');
  if (a.paths.includes('newcomer') && (g.crowd.includes('newcomers') || (g.first_step.newcomer_friendliness ?? 0) >= 4)) {
    lift += PATH_BOOST.newcomer;
    boosts.push('newcomer');
  }
  if (a.paths.includes('student') && g.audience.open_to === 'students' && g.audience.school && g.audience.school === a.school) {
    lift += PATH_BOOST.student;
    boosts.push('student');
  }
  if (a.paths.includes('kids') && g.requirements.kids_ok) {
    lift += PATH_BOOST.kids;
    boosts.push('kids');
  }
  if (a.faith?.mode === 'only' && a.faith.tradition && g.audience.faith === a.faith.tradition) {
    lift += PATH_BOOST.faithTradition;
    boosts.push('faith_tradition');
  }

  const score = clamp(total + lift);

  return {
    p,
    ev,
    parts,
    total,
    score,
    tier: rankTier(ev.unknown),
    unknown: ev.unknown,
    boosts,
    evidence: {
      interest: interest.evidence,
      motive: motive.motive,
      role: rf.role,
      format: rf.format,
      practical: practical.evidence,
      taste: tasteP.liked ? { liked: tasteP.liked } : undefined,
      newcomer: { nf: newcomer.nf },
      regular: regular.regular,
    },
  };
}

/**
 * How much each part lifted this group above a neutral 0.5, as a share of the whole score. The
 * explanation reads the biggest positive ones.
 */
export function lifts(s: Scored, profile: Profile): Record<PartName, number> {
  const weights: Record<PartName, number> = { ...WEIGHTS };
  if (profile.hardStrangers) weights.newcomer = NEWCOMER_WEIGHT_HARD;
  const wsum = Object.values(weights).reduce((x, y) => x + y, 0);
  const out = {} as Record<PartName, number>;
  for (const k of Object.keys(weights) as PartName[]) out[k] = (weights[k] * (s.parts[k] - 0.5)) / wsum;
  return out;
}
