import { crowdDisjoint } from './crowd';
import { evaluate, passes } from './filters';
import type { Pool } from './match';
import type { Prepared } from './prepare';
import type { Profile } from './profile';
import type { Scored } from './score';
import type { Axes, EdgeType, StretchType, WayId } from './types';

// Stretches and the wildcard (DESIGN section 4).
//
// A stretch changes exactly ONE thing about what the person told us and keeps the rest familiar
// and practical. There are four things it can change, and `axesOf` is the single definition of
// them, used both to find stretches and by the tests that check every stretch:
//
//   topic  the group's interest is not one the person asked for (one step away in the interest graph)
//   way    the way of taking part is new (learn it, teach it, serve it) in an interest they asked for
//   crowd  the people in the room are a new mix (bridging groups, or a different age group)
//   depth  a bigger role (an ongoing role, or leading) in an interest they asked for
//
// Practical limits (cost, schedule, travel, access, age, clearances) are never stretched, support
// groups never appear here, and faith groups appear only for people who chose to include faith.

// ---------------------------------------------------------------- the four axes

export function topicFamiliar(p: Prepared, profile: Profile): boolean {
  return p.tags.some((t) => profile.likedTags.has(t)) || p.families.some((f) => profile.likedFamilies.has(f));
}

export function wayDiffers(p: Prepared, profile: Profile): boolean {
  if (p.ways.size === 0) return false;
  for (const w of p.ways) if (profile.ways.has(w)) return false;
  return true;
}

/**
 * The crowd is new: a group that mixes ages or neighborhoods on purpose, for someone who said they
 * want people like themselves, or a group made up of an age group the person is not part of. People
 * who asked for a mix, or for people different from them, never get a crowd stretch: that is a fit.
 * Someone who skipped the question gets a crowd stretch only for a crowd that is clearly not theirs.
 */
export function crowdDiffers(p: Prepared, profile: Profile): boolean {
  const meet = profile.answers.meet?.with;
  if (meet === 'mix' || meet === 'different') return false;
  if (p.g.bridging && meet === 'similar') return true;
  return crowdDisjoint(p, profile);
}

/** A bigger role: an ongoing role, or leading something that meets every week. */
export function isBiggerRole(p: Prepared): boolean {
  const g = p.g;
  return g.commitment === 'ongoing_role' || (g.roles.includes('lead') && g.commitment === 'weekly');
}

export function depthDiffers(p: Prepared, profile: Profile): boolean {
  return isBiggerRole(p) && !profile.likesLeading;
}

/** Which of the four things this group changes about what the person told us. */
export function axesOf(p: Prepared, profile: Profile): Axes {
  return {
    topic: !topicFamiliar(p, profile),
    way: wayDiffers(p, profile),
    crowd: crowdDiffers(p, profile),
    depth: depthDiffers(p, profile),
  };
}

export function axisCount(a: Axes): number {
  return Number(a.topic) + Number(a.way) + Number(a.crowd) + Number(a.depth);
}

export function onlyAxis(a: Axes): StretchType | null {
  if (axisCount(a) !== 1) return null;
  return a.topic ? 'topic' : a.way ? 'way' : a.crowd ? 'crowd' : 'depth';
}

// ---------------------------------------------------------------- stretch candidates

export interface StretchCandidate {
  s: Scored;
  type: StretchType;
  /** a rank that mixes fit, future self goals and comfort; higher is better */
  rank: number;
  /** how well it moves toward a chosen future self, 0 to 1 */
  goal: number;
  goalId?: string;
  /** topic: the interest the person asked for, the one next to it, and how they are linked */
  edge?: { from: string; to: string; type: EdgeType };
  /** way: the new way in */
  way?: WayId;
}

/** Edge types from most to least like what the person already does. */
const EDGE_STRENGTH: Record<EdgeType, number> = { same_skill: 1, same_place: 0.9, same_crowd: 0.9, same_topic: 0.75, same_cause: 0.7 };

/** Where a stretch stops being worth showing: the less a person likes new things, the closer the fit must be. */
export function minFit(profile: Profile): number {
  return 0.3 + 0.2 * (1 - profile.comfort);
}

export function futureFit(p: Prepared, profile: Profile): { value: number; id?: string } {
  const f = profile.future;
  if (f.ids.length === 0) return { value: 0 };
  let best = 0;
  let bestId: string | undefined;
  for (const id of f.ids) {
    const def = profile.cat.futureById.get(id);
    if (!def) continue;
    const tag = Math.max(0, ...p.tags.map((t) => def.interests[t] ?? 0));
    const role = Math.max(0, ...p.g.roles.map((r) => (def.roles.indexOf(r) >= 0 ? 1 - 0.3 * def.roles.indexOf(r) : 0)));
    const fmt = Math.max(0, ...p.g.formats.map((r) => (def.formats.indexOf(r) >= 0 ? 1 - 0.3 * def.formats.indexOf(r) : 0)));
    const way = Math.max(0, ...[...p.ways, ...(isBiggerRole(p) ? ['lead_it'] : [])].map((w) => (def.ways.indexOf(w) >= 0 ? 1 - 0.3 * def.ways.indexOf(w) : 0)));
    const v = 0.5 * tag + 0.2 * role + 0.15 * fmt + 0.15 * way;
    if (v > best) {
      best = v;
      bestId = id;
    }
  }
  return { value: best, id: bestId };
}

function candidateFor(s: Scored, profile: Profile): StretchCandidate | null {
  const p = s.p;
  const axes = axesOf(p, profile);
  const type = onlyAxis(axes);
  if (!type) return null;
  const { value: goal, id: goalId } = futureFit(p, profile);
  const cand: StretchCandidate = { s, type, rank: 0, goal, goalId };

  if (type === 'topic') {
    // One step sideways needs a real edge from something they asked for.
    let best: { from: string; to: string; type: EdgeType; strength: number } | null = null;
    for (const t of p.tags) {
      for (const n of profile.cat.neighbors.get(t) ?? []) {
        if (!profile.likedTags.has(n.tag)) continue;
        const strength = EDGE_STRENGTH[n.type] * (profile.tagW.get(n.tag) ?? 0.5);
        // People who are wary of new things only take the closest kinds of step.
        if (profile.comfort < 0.35 && EDGE_STRENGTH[n.type] < 0.9) continue;
        if (!best || strength > best.strength) best = { from: n.tag, to: t, type: n.type, strength };
      }
    }
    if (!best) return null;
    cand.edge = { from: best.from, to: best.to, type: best.type };
  } else if (type === 'way') {
    const order: WayId[] = ['learn_it', 'teach_it', 'serve_it', 'do_it'];
    cand.way = order.find((w) => p.ways.has(w) && !profile.ways.has(w));
    if (!cand.way) return null;
  } else if (type === 'depth') {
    // The bigger role must fit how often they said they can come.
    const often = profile.answers.often;
    if (often && often.value !== 'any' && p.g.commitment === 'ongoing_role') return null;
  }

  cand.rank = 0.6 * s.score + 0.3 * goal + 0.1 * (cand.edge ? EDGE_STRENGTH[cand.edge.type] : 0.8);
  return cand;
}

/** May this group appear as a stretch or wildcard at all, whatever its axes? */
function stretchAllowed(s: Scored, profile: Profile, pool: Pool): boolean {
  const p = s.p;
  if (p.support) return false;
  // Faith groups are stretches only for people who chose to include faith.
  if (p.faith && profile.answers.faith?.mode !== 'include' && profile.answers.faith?.mode !== 'only') return false;
  // Never stretch a practical limit, whether or not it was locked.
  const strict = evaluate(p, profile, { strict: true, travel: pool.ctx.travel });
  if (!passes(strict)) return false;
  // A group whose place we cannot find might be too far, so it cannot be offered as a stretch.
  if (strict.unknown.includes('distance')) return false;
  return true;
}

/** Every group that could be a stretch, best first within each type. */
export function stretchCandidates(pool: Pool, exclude: Set<string> = new Set()): StretchCandidate[] {
  const { profile } = pool.ctx;
  if (!profile.hasInterest) return [];
  const floor = minFit(profile);
  const out: StretchCandidate[] = [];
  for (const s of pool.scored) {
    if (exclude.has(s.p.g.id) || s.score < floor) continue;
    if (!stretchAllowed(s, profile, pool)) continue;
    const c = candidateFor(s, profile);
    if (c) out.push(c);
  }
  out.sort((a, b) => b.rank - a.rank || (a.s.p.g.id < b.s.p.g.id ? -1 : 1));
  return out;
}

/** Counts of interest families and parent organizations already chosen, for the variety rule. */
export interface VarietyLike {
  canTake(p: Prepared): boolean;
  take(p: Prepared): void;
}

/**
 * Pick `n` stretches, one per type where possible, favoring types that move toward the person's
 * future self goals. The variety rule decides who may be taken, and is updated as they are.
 */
export function pickStretches(cands: StretchCandidate[], n: number, variety: VarietyLike): StretchCandidate[] {
  const chosen: StretchCandidate[] = [];
  const usedIds = new Set<string>();
  const take = (c: StretchCandidate) => {
    chosen.push(c);
    usedIds.add(c.s.p.g.id);
    variety.take(c.s.p);
  };
  // Best candidate per type first, ordered by goal then rank.
  const firsts: StretchCandidate[] = [];
  for (const t of ['topic', 'way', 'crowd', 'depth'] as StretchType[]) {
    const c = cands.find((x) => x.type === t && variety.canTake(x.s.p));
    if (c) firsts.push(c);
  }
  firsts.sort((a, b) => b.goal - a.goal || b.rank - a.rank);
  for (const c of firsts) {
    if (chosen.length >= n) break;
    if (variety.canTake(c.s.p)) take(c);
  }
  // More than one of a type only when there are fewer types than stretches.
  for (const c of cands) {
    if (chosen.length >= n) break;
    if (usedIds.has(c.s.p.g.id) || !variety.canTake(c.s.p)) continue;
    take(c);
  }
  return chosen;
}

// ---------------------------------------------------------------- the wildcard

export interface WildcardCandidate {
  s: Scored;
  rank: number;
  /** what links it honestly to something the person said */
  links: WildLink[];
}

export type WildLink =
  | { kind: 'interest'; tag: string; via: string }
  | { kind: 'motive'; id: string }
  | { kind: 'format'; id: string }
  | { kind: 'role'; id: string }
  | { kind: 'crowd' }
  | { kind: 'future'; id: string };

export function wildcardLinks(p: Prepared, profile: Profile): WildLink[] {
  const links: WildLink[] = [];
  const g = p.g;
  // A neighbor in the interest graph of something they asked for.
  for (const t of p.tags) {
    const w = profile.tagW.get(t) ?? 0;
    const ev = profile.tagEv.get(t);
    if (w >= 0.3 && ev?.kind === 'edge' && ev.via) {
      links.push({ kind: 'interest', tag: t, via: ev.via });
      break;
    }
  }
  // Their top reason for joining.
  for (const [id, w] of profile.motiveW) {
    if (w >= 0.75 && g.motives.includes(id)) {
      links.push({ kind: 'motive', id });
      break;
    }
  }
  for (const f of g.formats) {
    if ((profile.formatW.get(f) ?? 0) >= 0.8) {
      links.push({ kind: 'format', id: f });
      break;
    }
  }
  for (const r of g.roles) {
    if ((profile.roleW.get(r) ?? 0) >= 0.8) {
      links.push({ kind: 'role', id: r });
      break;
    }
  }
  if (g.bridging && profile.wantsMix) links.push({ kind: 'crowd' });
  const fut = futureFit(p, profile);
  if (fut.id && fut.value >= 0.3) links.push({ kind: 'future', id: fut.id });
  return links;
}

/**
 * The wildcard: something they would not pick themselves. Very welcoming, free or cheap, drop in or
 * one time, practical for them, tied honestly to what they said, and preferring uniquely Philly and
 * bridging groups.
 */
export function wildcardCandidates(pool: Pool, exclude: Set<string>, accept: (s: Scored) => boolean = () => true): WildcardCandidate[] {
  const { profile } = pool.ctx;
  const out: WildcardCandidate[] = [];
  for (const s of pool.scored) {
    const g = s.p.g;
    if (exclude.has(g.id) || !accept(s)) continue;
    if ((g.first_step.newcomer_friendliness ?? 0) < 4) continue;
    if (g.cost.level !== 'free' && g.cost.level !== 'low') continue;
    const easy = g.commitment === 'one_off' || g.commitment === 'drop_in' || g.first_step.drop_in === true;
    if (!easy) continue;
    // Something they would not pick: not an interest they asked for.
    if (s.p.tags.some((t) => profile.likedTags.has(t))) continue;
    if (!stretchAllowed(s, profile, pool)) continue;
    const links = wildcardLinks(s.p, profile);
    if (links.length === 0) continue;
    const welcome = ((g.first_step.newcomer_friendliness ?? 4) - 1) / 4;
    const rank = 0.3 * welcome + 0.2 * (s.p.philly ? 1 : 0) + 0.15 * (g.bridging ? 1 : 0) + 0.2 * s.score + 0.15 * Math.min(1, links.length / 2);
    out.push({ s, rank, links });
  }
  out.sort((a, b) => b.rank - a.rank || (a.s.p.g.id < b.s.p.g.id ? -1 : 1));
  return out;
}
