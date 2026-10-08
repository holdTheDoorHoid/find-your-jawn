import type { Group } from '../lib/types';
import type { Catalog } from './catalog';
import { buildPool, makeContext, type MatchOptions } from './match';
import type { Prepared } from './prepare';
import { similarity } from './similarity';
import { stretchCandidates } from './stretch';
import type { Answers, FollowId } from './types';
import { computeResults } from './select';

// The taste test (DESIGN stage 6): six to eight real groups, one tap each. The engine picks cards
// that teach it the most: strong candidates already inside the person's deal breakers that differ
// on whatever it is least sure about, plus one or two probes from further away.

export const TASTE_COUNT = 7;
export const TASTE_PROBES = 2;
/** How many top scoring groups the cards are drawn from. */
const POOL = 40;

export interface TasteCard {
  group: Group;
  /** a probe from further away, not a close fit */
  probe: boolean;
}

/** How much two groups differ on what the engine is least sure about, 0 to 1. */
function distance(a: Prepared, b: Prepared, w: { family: number; style: number; size: number; crowd: number; commit: number }): number {
  const jd = (x: string[], y: string[]) => {
    const sx = new Set(x);
    const sy = new Set(y);
    if (sx.size === 0 || sy.size === 0) return 0.5;
    let both = 0;
    for (const v of sx) if (sy.has(v)) both += 1;
    return 1 - both / (sx.size + sy.size - both);
  };
  const eq = (x: string | undefined, y: string | undefined) => (x === undefined || y === undefined ? 0.5 : x === y ? 0 : 1);
  const parts: [number, number][] = [
    [w.family, a.primary === b.primary ? jd(a.tags, b.tags) * 0.5 : 1],
    [w.style, (jd(a.g.roles, b.g.roles) + jd(a.g.formats, b.g.formats)) / 2],
    [w.size, eq(a.g.group_size, b.g.group_size)],
    [w.crowd, a.g.bridging === b.g.bridging ? jd(a.g.crowd, b.g.crowd) * 0.5 : 1],
    [w.commit, eq(a.g.commitment, b.g.commitment)],
  ];
  const total = parts.reduce((s, [wt]) => s + wt, 0);
  return total === 0 ? 0 : parts.reduce((s, [wt, d]) => s + wt * d, 0) / total;
}

export function pickTasteCards(groups: Group[], cat: Catalog, answers: Answers, opts: MatchOptions & { count?: number } = {}): TasteCard[] {
  const count = opts.count ?? TASTE_COUNT;
  // Cards already reacted to are not shown again.
  const done = new Set([...Object.keys(answers.taste), ...answers.notForMe.map((n) => n.id)]);
  const ctx = makeContext(groups, cat, answers, opts);
  const pool = buildPool(ctx);
  const profile = ctx.profile;

  // What the engine is least sure about decides which differences matter.
  const liked = profile.likedFamilies.size;
  const roleSpread = [...profile.roleW.values()].filter((v) => v >= 0.6).length / 6;
  const w = {
    family: liked >= 2 ? 0.9 : liked === 1 ? 0.45 : 0.7,
    style: 0.3 + 0.6 * Math.min(1, roleSpread * 1.5),
    size: answers.size && answers.size !== 'any' ? 0.1 : 0.4,
    crowd: answers.meet ? 0.1 : 0.4,
    commit: answers.often && answers.often.value !== 'any' ? 0.05 : 0.3,
  };

  const top = pool.scored.filter((s) => !done.has(s.p.g.id)).slice(0, POOL);
  if (top.length === 0) return [];
  const best = top[0]!.score;
  const worst = top[top.length - 1]!.score;
  const norm = (x: number) => (best === worst ? 1 : (x - worst) / (best - worst));

  const probesWanted = Math.min(TASTE_PROBES, Math.max(0, count - 4));
  const strongWanted = count - probesWanted;

  const chosen: { p: Prepared; probe: boolean }[] = [];
  const famCount = new Map<string, number>();
  const strongPool = top.slice();
  while (chosen.length < strongWanted && strongPool.length > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    strongPool.forEach((s, i) => {
      if ((famCount.get(s.p.primary) ?? 0) >= 2) return;
      const minD = chosen.length === 0 ? 1 : Math.min(...chosen.map((c) => distance(s.p, c.p, w)));
      const val = 0.45 * norm(s.score) + 0.55 * minD;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    });
    if (bestIdx < 0) break;
    const [s] = strongPool.splice(bestIdx, 1);
    chosen.push({ p: s!.p, probe: false });
    famCount.set(s!.p.primary, (famCount.get(s!.p.primary) ?? 0) + 1);
  }

  // Probes: stretches of different kinds, a step away from what they said.
  if (probesWanted > 0) {
    const taken = new Set([...done, ...chosen.map((c) => c.p.g.id)]);
    const seenTypes = new Set<string>();
    for (const c of stretchCandidates(pool, taken)) {
      if (chosen.filter((x) => x.probe).length >= probesWanted) break;
      if (seenTypes.has(c.type)) continue;
      if ((famCount.get(c.s.p.primary) ?? 0) >= 2) continue;
      seenTypes.add(c.type);
      chosen.push({ p: c.s.p, probe: true });
      famCount.set(c.s.p.primary, (famCount.get(c.s.p.primary) ?? 0) + 1);
    }
  }
  // Not enough probes: more strong cards.
  while (chosen.length < count && strongPool.length > 0) {
    const i = strongPool.findIndex((s) => (famCount.get(s.p.primary) ?? 0) < 2);
    if (i < 0) break;
    const [s] = strongPool.splice(i, 1);
    chosen.push({ p: s!.p, probe: false });
    famCount.set(s!.p.primary, (famCount.get(s!.p.primary) ?? 0) + 1);
  }
  return chosen.map((c) => ({ group: c.p.g, probe: c.probe }));
}

// ---------------------------------------------------------------- follow ups

export const FOLLOW_OPTIONS: Record<FollowId, string[]> = {
  setting: ['outdoors', 'indoors'],
  competition: ['casual', 'competitive'],
  online: ['yes', 'no'],
  cadence: ['one_time', 'ongoing'],
  kids_along: ['yes'],
};

/** A follow up is worth asking only when some answer would change at least this many of the top eight. */
export const FOLLOW_MIN_CHANGE = 2;
export const FOLLOW_MAX = 3;

export interface FollowPick {
  id: FollowId;
  /** the most groups of the top eight that any one answer would swap out */
  change: number;
}

/**
 * Which follow up questions to ask. For each one not already answered by an earlier screen, try each
 * answer and see how much of the top eight moves. Ask only the ones that could change it, biggest
 * first, and stop at three. Most people get one or none.
 */
export function pickFollowUps(groups: Group[], cat: Catalog, answers: Answers, opts: MatchOptions = {}): FollowPick[] {
  const base = computeResults(groups, cat, answers, opts);
  const baseIds = new Set(base.results.map((r) => r.group.id));
  if (baseIds.size === 0) return [];
  const picks: FollowPick[] = [];
  for (const id of Object.keys(FOLLOW_OPTIONS) as FollowId[]) {
    if (answers.follow[id] !== undefined) continue;
    if (id === 'cadence' && answers.often && answers.often.value !== 'any') continue;
    if (id === 'kids_along' && (answers.paths.includes('kids') || (answers.kidsAges?.length ?? 0) > 0)) continue;
    if (id === 'online' && answers.far?.mode === 'anywhere') continue;
    let change = 0;
    for (const value of FOLLOW_OPTIONS[id]) {
      const next: Answers = { ...answers, follow: { ...answers.follow, [id]: value } };
      const out = computeResults(groups, cat, next, opts);
      let moved = 0;
      for (const r of out.results) if (!baseIds.has(r.group.id)) moved += 1;
      change = Math.max(change, moved);
    }
    if (change >= FOLLOW_MIN_CHANGE) picks.push({ id, change });
  }
  picks.sort((a, b) => b.change - a.change);
  return picks.slice(0, FOLLOW_MAX);
}
