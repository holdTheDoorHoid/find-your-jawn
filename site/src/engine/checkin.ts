import type { Group } from '../lib/types';
import type { Catalog } from './catalog';
import { buildResult } from './explain';
import type { MatchOptions } from './match';
import { computeResults } from './select';
import { stretchCandidates } from './stretch';
import { emptyAnswers, type Answers, type Result } from './types';

// The "Did you go?" follow up (DESIGN section 7): after a visit, what is the next rung? More like it,
// a bigger role, or a stretch. And when a visit did not happen, a group that removes what got in
// the way. Built on the same engine, using the group the person visited as a vote for its topic.

/** Answers from just one group: its interests are the starting point. Used when the quiz was never taken. */
export function answersFromGroup(g: Group, base?: Answers): Answers {
  const a = base ? { ...base } : emptyAnswers();
  const fam = g.categories[0];
  return {
    ...a,
    picked: fam && !a.picked.includes(fam) ? [...a.picked, fam] : a.picked,
    starred: fam && a.starred.length === 0 ? [fam] : a.starred,
    tags: a.tags.length === 0 ? g.interests.filter(Boolean) : a.tags,
  };
}

/** The answers with the visited group counted as a group the person is already in. */
function withVisit(g: Group, base: Answers | undefined): Answers {
  const a = answersFromGroup(g, base);
  return { ...a, dial: 'bold', notForMe: [...a.notForMe.filter((n) => n.id !== g.id), { id: g.id, why: 'already' }] };
}

export interface Rungs {
  more: Result[];
  bigger: Result | null;
  stretch: Result | null;
}

/** Ideas for what to do after a good first visit. */
export function nextRung(groups: Group[], cat: Catalog, visited: Group, base: Answers | undefined, opts: MatchOptions = {}): Rungs {
  const a = withVisit(visited, base);
  const out = computeResults(groups, cat, a, { ...opts, count: 8 });
  const more = out.results.filter((r) => r.kind === 'close').slice(0, 2);
  const cands = stretchCandidates(out.pool);
  const pick = (type: 'depth' | 'other') => cands.find((c) => (type === 'depth' ? c.type === 'depth' : c.type !== 'depth'));
  const depth = pick('depth');
  const other = pick('other');
  return {
    more,
    bigger: depth ? buildResult(depth.s, 'stretch', out.ctx, { stretch: depth }) : null,
    stretch: other ? buildResult(other.s, 'stretch', out.ctx, { stretch: other }) : null,
  };
}

export interface SimilarOptions extends MatchOptions {
  /** only groups that cost little or nothing */
  cheaper?: boolean;
  /** favor groups you can just show up to */
  dropIn?: boolean;
  count?: number;
}

/** Groups like one the person meant to visit, with the thing that got in the way taken out. */
export function similarTo(groups: Group[], cat: Catalog, visited: Group, base: Answers | undefined, opts: SimilarOptions = {}): Result[] {
  let a = withVisit(visited, base);
  a = { ...a, dial: 'gentle' };
  if (opts.cheaper) a = { ...a, budget: { value: 'free', locked: true } };
  let pool = groups;
  if (opts.dropIn) pool = groups.filter((g) => g.first_step.drop_in === true || g.commitment === 'drop_in');
  const count = opts.count ?? 3;
  const out = computeResults(pool, cat, a, { ...opts, count });
  if (out.results.length > 0 || !opts.dropIn) return out.results;
  // No drop in group is close enough: fall back to anything similar.
  return computeResults(groups, cat, a, { ...opts, count }).results;
}
