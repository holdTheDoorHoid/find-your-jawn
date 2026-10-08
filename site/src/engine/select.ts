import { buildResult } from './explain';
import { makeContext, buildPool, type Context, type MatchOptions, type Pool } from './match';
import type { Prepared } from './prepare';
import type { Scored } from './score';
import { pickStretches, stretchCandidates, wildcardCandidates, type StretchCandidate, type VarietyLike, type WildcardCandidate } from './stretch';
import type { Answers, Diagnosis, Dial, Result } from './types';
import type { Group } from '../lib/types';
import type { Catalog } from './catalog';

// Choosing what to show: the adventure dial, the variety rule, "show me more", and replacing a
// card the person says is not for them.

/** The adventure dial (DESIGN section 4): close fits, stretches, wildcard. Always eight cards. */
export const DIAL: Record<Dial, { close: number; stretch: number; wild: number }> = {
  gentle: { close: 7, stretch: 1, wild: 0 },
  balanced: { close: 5, stretch: 2, wild: 1 },
  bold: { close: 4, stretch: 3, wild: 1 },
};

export const DEFAULT_COUNT = 8;
/** No more than this many results may share an interest family or a parent organization. */
export const VARIETY_CAP = 2;
/** Between batches the rule is a nudge instead of a limit: lowers the score by this much per repeat. */
export const VARIETY_NUDGE = 0.04;

/** Tracks the interest families and organizations already chosen. */
export class Variety implements VarietyLike {
  private fam = new Map<string, number>();
  private org = new Map<string, number>();
  /** earlier batches: nudge only */
  private seen = new Map<string, number>();

  seed(previous: Prepared[]): this {
    for (const p of previous) for (const f of p.families) this.seen.set(f, (this.seen.get(f) ?? 0) + 1);
    return this;
  }

  /** Start from results already on screen, with the hard limit applied to them too. */
  hold(previous: Prepared[]): this {
    for (const p of previous) this.take(p);
    return this;
  }

  canTake(p: Prepared): boolean {
    return (this.fam.get(p.primary) ?? 0) < VARIETY_CAP && (this.org.get(p.org) ?? 0) < VARIETY_CAP;
  }

  take(p: Prepared): void {
    this.fam.set(p.primary, (this.fam.get(p.primary) ?? 0) + 1);
    this.org.set(p.org, (this.org.get(p.org) ?? 0) + 1);
    for (const f of p.families) if (f !== p.primary) this.fam.set(f, (this.fam.get(f) ?? 0) + 0.5);
  }

  /** A small penalty for each time this group's families or organization already appear. */
  penalty(p: Prepared): number {
    let n = 0;
    for (const f of p.families) n += Math.min(2, (this.fam.get(f) ?? 0) + (this.seen.get(f) ?? 0) * 0.5) * (f === p.primary ? 1 : 0.5);
    n += (this.org.get(p.org) ?? 0) * 1.5;
    return VARIETY_NUDGE * n;
  }
}

/**
 * Close fits, best first, one at a time, with a penalty for repeating a family or organization and
 * a hard stop at two. Groups are taken tier by tier: confirmed passes first, then the ones with a locked
 * answer we could not check, and last the ones whose place we could not find (see rankTier).
 */
export function selectClose(pool: Pool, n: number, variety: Variety, exclude: Set<string>): Scored[] {
  const picks: Scored[] = [];
  const taken = new Set<string>(exclude);
  for (let tier = 0; tier <= 3 && picks.length < n; tier++) {
    // Sorted best score first within the tier (the pool is sorted by tier, then score).
    const tierList = pool.scored.filter((s) => s.tier === tier);
    while (picks.length < n) {
      let best: Scored | null = null;
      let bestAdj = -Infinity;
      for (const s of tierList) {
        // Nothing after this one can beat the current best, because the list is sorted by score.
        if (best && s.score <= bestAdj) break;
        if (taken.has(s.p.g.id) || !variety.canTake(s.p)) continue;
        const adj = s.score - variety.penalty(s.p);
        if (adj > bestAdj) {
          best = s;
          bestAdj = adj;
        }
      }
      if (!best) break;
      picks.push(best);
      taken.add(best.p.g.id);
      variety.take(best.p);
    }
  }
  return picks;
}

export interface Outcome {
  results: Result[];
  diagnosis: Diagnosis;
  pool: Pool;
  ctx: Context;
  /** the stretch and wildcard candidates, for replacements */
  stretches: StretchCandidate[];
  wildcards: WildcardCandidate[];
}

export interface ComputeOptions extends MatchOptions {
  dial?: Dial;
  /** how many cards, eight unless asked otherwise */
  count?: number;
  /** groups to leave out, for example ones already on screen */
  exclude?: string[];
}

function quotas(dial: Dial, count: number): { close: number; stretch: number; wild: number } {
  const d = DIAL[dial];
  if (count === DEFAULT_COUNT) return d;
  const scale = count / DEFAULT_COUNT;
  const wild = d.wild > 0 && count >= 4 ? 1 : 0;
  const stretch = Math.round(d.stretch * scale);
  return { close: Math.max(0, count - stretch - wild), stretch, wild };
}

/** The whole thing: answers and groups in, about eight ranked results with reasons out. */
export function computeResults(groups: Group[], cat: Catalog, answers: Answers, opts: ComputeOptions = {}): Outcome {
  const ctx = makeContext(groups, cat, answers, opts);
  const pool = buildPool(ctx);
  const dial = opts.dial ?? answers.dial;
  const count = opts.count ?? DEFAULT_COUNT;
  const want = quotas(dial, count);
  const exclude = new Set(opts.exclude ?? []);
  const variety = new Variety();

  // With very few groups to show, every card is a close fit: there is nothing spare to stretch with.
  const roomToStretch = pool.scored.length - exclude.size >= count + want.stretch + want.wild;
  const stretches = roomToStretch && (want.stretch > 0 || want.wild > 0) ? stretchCandidates(pool, exclude) : [];
  // A wildcard is something we would not have shown as a close fit.
  const topIds = new Set(pool.scored.slice(0, count).map((s) => s.p.g.id));
  const wildcards = roomToStretch && want.wild > 0 ? wildcardCandidates(pool, new Set([...exclude, ...topIds])) : [];

  const stretchPicks = want.stretch > 0 ? pickStretches(stretches, want.stretch, variety) : [];
  const wildPick = wildcards.find((w) => !stretchPicks.some((c) => c.s.p.g.id === w.s.p.g.id) && variety.canTake(w.s.p));
  if (wildPick) variety.take(wildPick.s.p);

  const taken = new Set<string>(exclude);
  for (const c of stretchPicks) taken.add(c.s.p.g.id);
  if (wildPick) taken.add(wildPick.s.p.g.id);

  // Slots a stretch or the wildcard could not fill go to more close fits.
  const closeCount = count - stretchPicks.length - (wildPick ? 1 : 0);
  const close = selectClose(pool, closeCount, variety, taken);

  const results: Result[] = [
    ...close.map((s) => buildResult(s, 'close', ctx)),
    ...stretchPicks.map((c) => buildResult(c.s, 'stretch', ctx, { stretch: c })),
    ...(wildPick ? [buildResult(wildPick.s, 'wildcard', ctx, { wild: wildPick })] : []),
  ];
  return { results, diagnosis: pool.diagnosis, pool, ctx, stretches, wildcards };
}

/** More close fits for "Show me more". The one in the way of the hard limit is the batch, not the whole page. */
export function moreResults(outcome: Outcome, shown: Result[], n = 4): Result[] {
  const { pool, ctx } = outcome;
  const variety = new Variety().seed(shown.map((r) => pool.byId.get(r.group.id)?.p).filter((p): p is Prepared => !!p));
  const exclude = new Set(shown.map((r) => r.group.id));
  return selectClose(pool, n, variety, exclude).map((s) => buildResult(s, 'close', ctx));
}

/**
 * A card the person said is not for them leaves, and one of the same kind takes its place. The
 * other cards stay where they are. Call with an outcome computed from the answers that already
 * include the new "Not for me", so the replacement reflects what it taught us.
 */
export function replacementFor(outcome: Outcome, removed: Result, remaining: Result[]): Result | null {
  const { pool, ctx } = outcome;
  const preps = remaining.map((r) => pool.byId.get(r.group.id)?.p ?? null).filter((p): p is Prepared => p !== null);
  const variety = new Variety().hold(preps);
  const exclude = new Set([...remaining.map((r) => r.group.id), removed.group.id]);

  if (removed.kind === 'stretch') {
    const cands = outcome.stretches.filter((c) => !exclude.has(c.s.p.g.id));
    const pick = pickStretches(cands, 1, variety)[0];
    if (pick) return buildResult(pick.s, 'stretch', ctx, { stretch: pick });
  } else if (removed.kind === 'wildcard') {
    const pick = outcome.wildcards.find((w) => !exclude.has(w.s.p.g.id) && variety.canTake(w.s.p));
    if (pick) return buildResult(pick.s, 'wildcard', ctx, { wild: pick });
  }
  const close = selectClose(pool, 1, variety, exclude)[0];
  return close ? buildResult(close, 'close', ctx) : null;
}
