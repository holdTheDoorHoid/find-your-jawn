import { describe, expect, it } from 'vitest';
import { prepare } from './prepare';
import { deriveProfile } from './profile';
import { buildPool, makeContext } from './match';
import { computeResults } from './select';
import { axesOf, axisCount, onlyAxis, pickStretches, stretchCandidates, wildcardCandidates } from './stretch';
import { Variety } from './select';
import { testGroups } from './test-groups';
import { answers, NOW, PEOPLE, realCatalog } from './testing';
import { normalizeGroup } from '../lib/normalize';

const cat = realCatalog();
const groups = testGroups();

/** A hiker who lives where the fixture's trail groups are and does not mind a ride. */
const hiker = answers({
  scenes: ['scene_cave'],
  moments: ['moment_outdoors'],
  place: { hood: 'rittenhouse' },
  far: { mode: 'septa', minutes: 90, locked: false },
  meet: { with: 'similar', communities: [] },
  strangers: 2,
  newness: 4,
  dial: 'bold',
});

/** Someone who only did the cave scene: caving and nothing else, and doing it is the only way they take part. */
const caver = { ...hiker, moments: [] as string[] };

describe('stretches', () => {
  const ctx = makeContext(groups, cat, hiker, { now: NOW });
  const pool = buildPool(ctx);
  const cands = stretchCandidates(pool);
  const caverCtx = makeContext(groups, cat, caver, { now: NOW });
  const caverCands = stretchCandidates(buildPool(caverCtx));

  it('come in all four kinds with the fixture list', () => {
    const types = new Set([...cands, ...caverCands].map((c) => c.type));
    expect([...types].sort()).toEqual(['crowd', 'depth', 'topic', 'way']);
  });

  it('change exactly one thing each', () => {
    expect(cands.length).toBeGreaterThan(3);
    for (const c of cands) {
      const axes = axesOf(c.s.p, ctx.profile);
      expect(axisCount(axes), c.s.p.g.name).toBe(1);
      expect(onlyAxis(axes)).toBe(c.type);
    }
  });

  it('topic: sits next to something they asked for in the interest graph', () => {
    const topic = cands.filter((c) => c.type === 'topic');
    expect(topic.length).toBeGreaterThan(0);
    for (const c of topic) {
      expect(c.edge).toBeDefined();
      expect(ctx.profile.likedTags.has(c.edge!.from)).toBe(true);
      expect(c.s.p.tags).toContain(c.edge!.to);
      expect(cat.neighbors.get(c.edge!.from)?.some((n) => n.tag === c.edge!.to)).toBe(true);
    }
  });

  it('way: the same family of interest with a way of taking part they did not use', () => {
    const way = caverCands.filter((c) => c.type === 'way');
    expect(way.length).toBeGreaterThan(0);
    for (const c of way) {
      expect(c.way).toBeDefined();
      expect(caverCtx.profile.ways.has(c.way!)).toBe(false);
      expect(c.s.p.families.some((f) => caverCtx.profile.likedFamilies.has(f))).toBe(true);
    }
  });

  it('crowd: bridging for a person who wants people like themselves', () => {
    const crowd = cands.filter((c) => c.type === 'crowd');
    expect(crowd.length).toBeGreaterThan(0);
    expect(crowd.some((c) => c.s.p.g.bridging)).toBe(true);
  });

  it('crowd: not offered to people who asked for a mix', () => {
    const mixer = makeContext(groups, cat, { ...hiker, meet: { with: 'mix', communities: [] } }, { now: NOW });
    const mixed = stretchCandidates(buildPool(mixer));
    expect(mixed.filter((c) => c.type === 'crowd')).toHaveLength(0);
  });

  it('depth: a bigger role in an interest they asked for', () => {
    const depth = cands.filter((c) => c.type === 'depth');
    expect(depth.length).toBeGreaterThan(0);
    for (const c of depth) {
      expect(c.s.p.g.commitment === 'ongoing_role' || c.s.p.g.roles.includes('lead')).toBe(true);
      expect(c.s.p.families.some((f) => ctx.profile.likedFamilies.has(f))).toBe(true);
    }
  });

  it('depth: never when the person said they can only come once in a while', () => {
    const once = makeContext(groups, cat, { ...hiker, often: { value: 'monthly', locked: false } }, { now: NOW });
    const out = stretchCandidates(buildPool(once));
    for (const c of out) expect(c.s.p.g.commitment).not.toBe('ongoing_role');
  });

  it('never break a practical limit, even one that was not locked', () => {
    const tight = makeContext(groups, cat, { ...hiker, far: { mode: 'walk', minutes: 20, locked: false }, budget: { value: 'free', locked: false } }, { now: NOW });
    const out = stretchCandidates(buildPool(tight));
    for (const c of out) {
      expect(c.s.p.g.cost.level).not.toBe('paid');
      expect(c.s.p.g.cost.level).not.toBe('low');
      expect(c.s.ev.minutes === undefined || c.s.ev.minutes <= 25).toBe(true);
    }
  });

  it('are never support groups', () => {
    const asked = makeContext(groups, cat, { ...hiker, includeSupport: true }, { now: NOW });
    for (const c of stretchCandidates(buildPool(asked))) expect(c.s.p.support).toBe(false);
  });

  it('need something they asked for to stretch from', () => {
    const blank = makeContext(groups, cat, answers({ dial: 'bold' }), { now: NOW });
    expect(stretchCandidates(buildPool(blank))).toHaveLength(0);
  });

  it('prefer the kind that moves toward a future self they chose', () => {
    const spoke = makeContext(groups, cat, { ...hiker, future: ['spoke_up'] }, { now: NOW });
    const out = stretchCandidates(buildPool(spoke));
    const picked = pickStretches(out, 2, new Variety());
    expect(picked.length).toBe(2);
    expect(new Set(picked.map((c) => c.type)).size).toBe(2);
  });

  it('give a person who likes new things more reach than one who does not', () => {
    const wary = makeContext(groups, cat, { ...hiker, newness: 1, lastNew: 'hard' }, { now: NOW });
    const bold = makeContext(groups, cat, { ...hiker, newness: 5, lastNew: 'great' }, { now: NOW });
    const a = stretchCandidates(buildPool(wary)).length;
    const b = stretchCandidates(buildPool(bold)).length;
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

describe('the stretch sentence', () => {
  const out = computeResults(groups, cat, hiker, { now: NOW });
  const stretches = out.results.filter((r) => r.kind === 'stretch');

  it('says what changes and what stays', () => {
    expect(stretches.length).toBeGreaterThan(0);
    for (const r of stretches) {
      expect(r.stretchLine).toMatch(/^This is a stretch:/);
      expect(r.stretchLine).toMatch(/still/);
    }
  });
});

describe('the wildcard', () => {
  const people = ['retiree', 'extrovert', 'spanish', 'shy', 'nurse'] as const;

  it.each(people)('for %s is very welcoming, free or cheap, easy to try, and tied to something they said', (name) => {
    const ctx = makeContext(groups, cat, { ...PEOPLE[name]!, dial: 'balanced' }, { now: NOW });
    const pool = buildPool(ctx);
    const wild = wildcardCandidates(pool, new Set());
    for (const w of wild) {
      const g = w.s.p.g;
      expect(g.first_step.newcomer_friendliness).toBeGreaterThanOrEqual(4);
      expect(['free', 'low']).toContain(g.cost.level);
      expect(g.commitment === 'one_off' || g.commitment === 'drop_in' || g.first_step.drop_in === true).toBe(true);
      expect(w.links.length).toBeGreaterThan(0);
      expect(w.s.p.support).toBe(false);
    }
  });

  it('is something they would not pick: not an interest they asked for', () => {
    const ctx = makeContext(groups, cat, PEOPLE.extrovert!, { now: NOW });
    const wild = wildcardCandidates(buildPool(ctx), new Set());
    for (const w of wild) for (const t of w.s.p.tags) expect(ctx.profile.likedTags.has(t)).toBe(false);
  });

  it('prefers uniquely Philly and bridging groups', () => {
    const ctx = makeContext(groups, cat, { ...PEOPLE.extrovert!, scenes: ['scene_pickup_soccer', 'scene_coach_basketball'] }, { now: NOW });
    const wild = wildcardCandidates(buildPool(ctx), new Set());
    expect(wild.length).toBeGreaterThan(1);
    const top = wild[0]!.s.p;
    expect(top.philly || top.g.bridging).toBe(true);
  });

  it('appears under balanced and bold, never under gentle', () => {
    const base = PEOPLE.extrovert!;
    expect(computeResults(groups, cat, { ...base, dial: 'gentle' }, { now: NOW }).results.some((r) => r.kind === 'wildcard')).toBe(false);
    expect(computeResults(groups, cat, { ...base, dial: 'balanced' }, { now: NOW }).results.some((r) => r.kind === 'wildcard')).toBe(true);
  });

  it('does not exist without a rating that says very welcoming', () => {
    const unrated = groups.map((g) => normalizeGroup({ ...g, first_step: { ...g.first_step, newcomer_friendliness: undefined } }));
    const out = computeResults(unrated, cat, { ...PEOPLE.extrovert!, dial: 'bold' }, { now: NOW });
    expect(out.results.some((r) => r.kind === 'wildcard')).toBe(false);
  });

  it('connects honestly: its sentence names something from the answers', () => {
    const out = computeResults(groups, cat, PEOPLE.extrovert!, { now: NOW });
    const wild = out.results.find((r) => r.kind === 'wildcard');
    expect(wild?.stretchLine).toMatch(/connects to what you said/);
  });
});

describe('groups with an unusual crowd', () => {
  it('count as a new crowd for someone who is not part of it', () => {
    const profile = deriveProfile(answers({ age: { lo: 25, hi: 34 }, scenes: ['scene_garden'] }), cat);
    const seniors = prepare(groups.find((g) => g.id === 'south-philly-senior-center')!, cat);
    const kids = prepare(groups.find((g) => g.id === 'hunting-park-youth-league')!, cat);
    expect(axesOf(seniors, profile).crowd).toBe(true);
    expect(axesOf(kids, profile).crowd).toBe(true);
  });
});
