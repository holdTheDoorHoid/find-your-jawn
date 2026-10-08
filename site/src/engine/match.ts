import type { Group } from '../lib/types';
import type { Catalog } from './catalog';
import { diagnose, evaluate, passes, type Evaluation } from './filters';
import { prepare, type Prepared } from './prepare';
import { deriveProfile, type Profile } from './profile';
import { scoreGroup, type Scored, type TasteSets } from './score';
import { straightLineTravel, type TravelModel } from './travel';
import type { Answers, Diagnosis } from './types';

// The shared setup for every engine call: the groups prepared, the answers turned into a profile,
// and the pool of groups that pass the hard filters, scored.

/** Confirmed passes first, then by score, then by id so the order never wobbles. */
export function compareScored(a: Scored, b: Scored): number {
  return a.tier - b.tier || b.score - a.score || (a.p.g.id < b.p.g.id ? -1 : 1);
}

export interface MatchOptions {
  /** the date to judge "last seen active" against; tests pass a fixed one */
  now?: Date;
  /** how long a trip takes; swap in real transit times here later */
  travel?: TravelModel;
}

export interface Context {
  cat: Catalog;
  profile: Profile;
  travel: TravelModel;
  now: Date;
  groups: Group[];
  byId: Map<string, Group>;
  taste: TasteSets;
}

export interface Pool {
  ctx: Context;
  /** every group, in the order given */
  evals: Evaluation[];
  /** groups that pass every rule, scored: confirmed passes first, then by score */
  scored: Scored[];
  byId: Map<string, Scored>;
  diagnosis: Diagnosis;
}

export function makeContext(groups: Group[], cat: Catalog, answers: Answers, opts: MatchOptions = {}): Context {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const profile = deriveProfile(answers, cat, (id) => byId.get(id));
  const fb = profile.feedback;
  const prep = (g: Group) => prepare(g, cat);
  const reasonWeight = (why: string | undefined) => (why === undefined || why === 'not_my_thing' ? 1 : 0.25);
  const taste: TasteSets = {
    into: fb.into.map(prep),
    maybe: fb.maybe.map(prep),
    not: fb.not.filter((n) => n.why !== 'already').map((n) => ({ p: prep(n.g), weight: reasonWeight(n.why) })),
    already: fb.already.map(prep),
  };
  return { cat, profile, travel: opts.travel ?? straightLineTravel, now: opts.now ?? new Date(), groups, byId, taste };
}

/** Run every group through the hard filters and score the ones that pass. */
export function buildPool(ctx: Context): Pool {
  const evals: Evaluation[] = [];
  const scored: Scored[] = [];
  for (const g of ctx.groups) {
    const p = prepare(g, ctx.cat);
    const ev = evaluate(p, ctx.profile, { travel: ctx.travel });
    evals.push(ev);
    if (passes(ev)) scored.push(scoreGroup(p, ev, ctx.profile, ctx.taste, ctx.now));
  }
  scored.sort(compareScored);
  return { ctx, evals, scored, byId: new Map(scored.map((s) => [s.p.g.id, s])), diagnosis: diagnose(evals) };
}

export function preparedOf(ctx: Context, g: Group): Prepared {
  return prepare(g, ctx.cat);
}
