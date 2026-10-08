import type { Catalog } from '../../engine/catalog';
import { sanitizeAnswers } from '../../engine/answers';
import { emptyAnswers, type Answers, type FollowId } from '../../engine/types';

// The quiz's flow, kept free of the screen: which screens apply, what comes next, how far along the
// bar is, and how answers are saved. Pure and tested.

export type ScreenId =
  | 'start'
  | 'hours'
  | 'court'
  | 'kids'
  | 'newcomer'
  | 'student'
  | 'scenes'
  | 'scenes_more'
  | 'moments'
  | 'when'
  | 'often'
  | 'far'
  | 'budget'
  | 'rules_a'
  | 'rules_b'
  | 'interests'
  | 'stars'
  | 'tags'
  | 'motives1'
  | 'motives2'
  | 'meet'
  | 'strangers'
  | 'newness'
  | 'future'
  | 'taste'
  | 'follow'
  | 'heard'
  | 'results';

export const SCREEN_IDS: readonly ScreenId[] = [
  'start',
  'hours',
  'court',
  'kids',
  'newcomer',
  'student',
  'scenes',
  'scenes_more',
  'moments',
  'when',
  'often',
  'far',
  'budget',
  'rules_a',
  'rules_b',
  'interests',
  'stars',
  'tags',
  'motives1',
  'motives2',
  'meet',
  'strangers',
  'newness',
  'future',
  'taste',
  'follow',
  'heard',
  'results',
];

export const QUIZ_KEY = 'quiz';
export const QUIZ_VERSION = 1;

/** Everything saved in the browser so a reload picks up where the person left off. */
export interface QuizState {
  v: 1;
  screen: ScreenId;
  /** screens already visited, so Back goes where the person came from */
  history: ScreenId[];
  answers: Answers;
  /** makes the shuffled order stable across renders and reloads */
  seed: number;
  /** the second set of scenes was offered */
  extra: boolean;
  /** the taste test cards chosen for this person, so a reload shows the same ones */
  tasteIds: string[];
  /** which of those cards are probes from further away */
  tasteProbes: string[];
  /** the follow up questions chosen for this person, once decided */
  followIds: FollowId[] | null;
}

export function newState(seed = Math.floor(Math.random() * 2 ** 31)): QuizState {
  return { v: 1, screen: 'start', history: [], answers: emptyAnswers(), seed, extra: false, tasteIds: [], tasteProbes: [], followIds: null };
}

export function readState(raw: unknown): QuizState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== QUIZ_VERSION) return null;
  const screen = SCREEN_IDS.find((s) => s === o.screen);
  if (!screen) return null;
  const history = Array.isArray(o.history) ? o.history.filter((h): h is ScreenId => SCREEN_IDS.includes(h as ScreenId)) : [];
  const followIds = Array.isArray(o.followIds)
    ? (o.followIds.filter((f): f is FollowId => ['setting', 'competition', 'online', 'cadence', 'kids_along'].includes(f as string)) as FollowId[])
    : null;
  return {
    v: 1,
    screen,
    history,
    answers: sanitizeAnswers(o.answers),
    seed: typeof o.seed === 'number' && Number.isFinite(o.seed) ? Math.floor(o.seed) : 1,
    extra: o.extra === true,
    tasteIds: Array.isArray(o.tasteIds) ? o.tasteIds.filter((x): x is string => typeof x === 'string').slice(0, 12) : [],
    tasteProbes: Array.isArray(o.tasteProbes) ? o.tasteProbes.filter((x): x is string => typeof x === 'string').slice(0, 12) : [],
    followIds,
  };
}

// ---------------------------------------------------------------- which screens apply

/** Few picks, or picks that share nothing: offer the second set of scenes. */
export function needsExtraScenes(cat: Catalog, scenes: string[]): boolean {
  if (scenes.length === 0) return false;
  if (scenes.length <= 2) return true;
  // Mixed: three or more picks and no two of them share an interest family.
  const seen = new Set<string>();
  for (const id of scenes) {
    const s = cat.sceneById.get(id);
    if (!s) continue;
    const fams = new Set<string>();
    for (const [tag, w] of Object.entries(s.interests)) {
      const f = cat.tagFamily.get(tag);
      if (f && w >= 0.5) fams.add(f);
    }
    for (const f of fams) {
      if (seen.has(f)) return false;
    }
    for (const f of fams) seen.add(f);
  }
  return true;
}

/** The screens that apply to this person right now, in order. Taste, follow ups and results always close the list. */
export function sequence(a: Answers, extra: boolean): ScreenId[] {
  const out: ScreenId[] = ['start'];
  if (a.paths.includes('hours')) out.push('hours');
  if (a.paths.includes('court')) out.push('court');
  if (a.paths.includes('kids')) out.push('kids');
  if (a.paths.includes('newcomer')) out.push('newcomer');
  if (a.paths.includes('student')) out.push('student');
  out.push('scenes');
  if (extra) out.push('scenes_more');
  out.push('moments', 'when', 'often', 'far', 'budget', 'rules_a', 'rules_b', 'interests');
  if (a.picked.length >= 2) out.push('stars');
  if (a.starred.length > 0) out.push('tags');
  out.push('motives1');
  if (a.motives?.m1 || a.motives?.l1) out.push('motives2');
  out.push('meet', 'strangers', 'newness', 'future', 'taste', 'follow', 'heard', 'results');
  return out;
}

export function nextScreen(current: ScreenId, a: Answers, extra: boolean): ScreenId {
  const seq = sequence(a, extra);
  const at = seq.indexOf(current);
  if (at >= 0) return seq[Math.min(seq.length - 1, at + 1)] ?? 'results';
  // The current screen no longer applies (for example an answer was removed): the first later one that does.
  const order = SCREEN_IDS.indexOf(current);
  return seq.find((s) => SCREEN_IDS.indexOf(s) > order) ?? 'results';
}

// ---------------------------------------------------------------- the progress bar

/** Steps left to count, not including the results. */
export function stepsOf(a: Answers, extra: boolean): ScreenId[] {
  return sequence(a, extra).filter((s) => s !== 'results');
}

/**
 * How far along, 0 to 100. The bar moves fast at the start and slows near the end, which keeps more
 * people going (DESIGN section 2.1, rule 9). It never goes backward when the person goes back one
 * screen, because it is based on position, and always reaches 100 only on the last screen.
 */
export function progressPercent(current: ScreenId, a: Answers, extra: boolean): number {
  const steps = stepsOf(a, extra);
  if (current === 'results') return 100;
  const at = Math.max(0, steps.indexOf(current));
  const x = steps.length <= 1 ? 1 : (at + 1) / steps.length;
  // Ease out: 1 - (1 - x)^2 puts the first fifth of the steps at about a third of the bar.
  return Math.min(99, Math.round(100 * (1 - (1 - x) ** 2)));
}

export function stepNumber(current: ScreenId, a: Answers, extra: boolean): { n: number; total: number } {
  const steps = stepsOf(a, extra);
  return { n: Math.max(1, steps.indexOf(current) + 1), total: steps.length };
}

// ---------------------------------------------------------------- shuffled order

/** A small seeded random number generator, so the shuffled order does not change on re-render. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The same input and seed always give the same order, so no option is favored for being first (rule 8). */
export function shuffle<T>(items: readonly T[], seed: number, salt = ''): T[] {
  const rand = mulberry32(seed ^ hashString(salt));
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ---------------------------------------------------------------- ages

/** Ages the quiz offers, as a closed range the filters use. */
export const AGE_BANDS: Record<string, { lo: number; hi: number }> = {
  '13': { lo: 13, hi: 15 },
  '16': { lo: 16, hi: 17 },
  '18': { lo: 18, hi: 24 },
  '25': { lo: 25, hi: 34 },
  '35': { lo: 35, hi: 54 },
  '55': { lo: 55, hi: 64 },
  '65': { lo: 65, hi: 65 },
};

export function bandOf(age: { lo: number; hi: number } | undefined): string | undefined {
  if (!age) return undefined;
  return Object.entries(AGE_BANDS).find(([, r]) => r.lo === age.lo && r.hi === age.hi)?.[0];
}

