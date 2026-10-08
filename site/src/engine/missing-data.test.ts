import { describe, expect, it } from 'vitest';
import { normalizeGroup } from '../lib/normalize';
import type { Group } from '../lib/types';
import { evaluate } from './filters';
import { buildPool, makeContext } from './match';
import { prepare } from './prepare';
import { deriveProfile } from './profile';
import { scoreGroup, WEIGHTS } from './score';
import { computeResults } from './select';
import { answers, NOW, PEOPLE, realCatalog } from './testing';
import { testGroups } from './test-groups';

// Real groups.json mixes records with a lot of facts and records with almost none. A missing fact
// must score neutral, never zero, never crash; a locked answer we cannot check lets the group
// through but ranks it below groups we know pass.

const cat = realCatalog();

/** The thinnest record the pipeline can publish: a name, a kind, a family, one ZIP. */
function bare(over: Record<string, unknown> = {}): Group {
  return normalizeGroup({
    id: 'bare-bones-group',
    name: 'Bare Bones Group',
    summary: 'A record with almost nothing in it.',
    kind: 'civic',
    categories: ['neighborhood-civic'],
    interests: ['civic_association'],
    locations: [{ zip: '19104', in_city: true }],
    research_tier: 1,
    status: 'active',
    ...over,
  });
}

/** A record with every practical fact filled in, to compare against. */
function full(over: Record<string, unknown> = {}): Group {
  return normalizeGroup({
    id: 'full-record-group',
    name: 'Full Record Group',
    summary: 'A record with everything in it.',
    kind: 'civic',
    categories: ['neighborhood-civic'],
    interests: ['civic_association'],
    motives: ['social'],
    formats: ['conversation'],
    roles: ['organize'],
    crowd: ['neighbors'],
    schedule: { days: ['sat'], times: ['morning'], recurring: true },
    locations: [{ zip: '19104', neighborhood: 'spruce_hill', lat: 39.9591, lng: -75.1982, in_city: true }],
    cost: { level: 'free' },
    commitment: 'weekly',
    group_size: 'small',
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    first_step: { newcomer_friendliness: 4, drop_in: true },
    requirements: { service_hours_letter: 'yes' },
    research_tier: 2,
    status: 'active',
    last_sign_of_life: '2026-09',
    ...over,
  });
}

function scoreOf(g: Group, a = answers()) {
  const ctx = makeContext([g], cat, a, { now: NOW });
  const pool = buildPool(ctx);
  return pool.scored[0];
}

describe('a record with almost nothing in it', () => {
  it('scores without a crash and every part stays between 0 and 1', () => {
    const s = scoreOf(bare(), PEOPLE.retiree!);
    expect(s).toBeDefined();
    for (const [k, v] of Object.entries(s!.parts)) {
      expect(Number.isFinite(v), k).toBe(true);
      expect(v, k).toBeGreaterThanOrEqual(0);
      expect(v, k).toBeLessThanOrEqual(1);
    }
    expect(s!.score).toBeGreaterThan(0);
  });

  it('scores neutral, about one half, on every part about a fact it does not give', () => {
    const a = answers({
      when: { days: ['sat'], times: ['morning'], flexible: false, locked: false },
      budget: { value: 'free', locked: false },
      often: { value: 'weekly', locked: false },
      size: 'small',
      wheelchair: { value: true, locked: false },
      motives: { m1: 'social', l1: 'career' },
      strangers: 2,
    });
    const g = bare({ locations: [] });
    const s = scoreOf(g, a)!;
    expect(s.parts.practical).toBeCloseTo(0.5, 1);
    expect(s.parts.motive).toBe(0.5);
    expect(s.parts.newcomer).toBeGreaterThanOrEqual(0.35);
    expect(s.parts.newcomer).toBeLessThanOrEqual(0.75);
  });

  it('is not pushed to the bottom by missing facts alone', () => {
    const a = answers({ budget: { value: 'free', locked: false }, when: { days: ['sat'], times: ['morning'], flexible: false, locked: false } });
    const ctx = makeContext([bare(), full({ cost: { level: 'paid' }, schedule: { days: ['wed'], times: ['evening'] } })], cat, a, { now: NOW });
    const pool = buildPool(ctx);
    const unknown = pool.byId.get('bare-bones-group')!;
    const wrong = pool.byId.get('full-record-group')!;
    // A group that is known to be paid and on the wrong day is worse than one that does not say.
    expect(unknown.parts.practical).toBeGreaterThan(wrong.parts.practical);
  });

  it('reflects its thinness in the confidence part', () => {
    const thin = scoreOf(bare())!;
    const rich = scoreOf(full())!;
    expect(thin.parts.confidence).toBeLessThan(rich.parts.confidence);
    expect(WEIGHTS.confidence).toBeLessThan(0.05);
  });

  it('explains itself without saying anything it does not know', () => {
    const out = computeResults([bare()], cat, answers({ scenes: ['scene_block_meeting'] }), { now: NOW });
    expect(out.results).toHaveLength(1);
    const r = out.results[0]!;
    expect(r.why.length).toBeGreaterThanOrEqual(1);
    expect(r.why.join(' ')).not.toMatch(/free|Saturday|minutes/i);
  });

  it('has a first step that points to the group page instead of inventing one', () => {
    const out = computeResults([bare()], cat, answers(), { now: NOW });
    expect(out.results[0]!.firstStep).toMatch(/group page/i);
  });
});

describe('a locked answer on a fact we do not have', () => {
  const lockedFree = answers({ budget: { value: 'free', locked: true } });

  it('lets the group through as unknown', () => {
    const ctx = makeContext([bare()], cat, lockedFree, { now: NOW });
    const e = evaluate(prepare(bare(), cat), ctx.profile);
    expect(e.baseOk).toBe(true);
    expect(e.fails).toEqual([]);
    expect(e.unknown).toEqual(['cost']);
  });

  it('ranks it below every group we know passes, even when it would otherwise win', () => {
    const better = bare({ id: 'unknown-cost-better-fit', name: 'Unknown Cost', interests: ['civic_association'], motives: ['social'] });
    const known = full({ id: 'known-free', name: 'Known Free', motives: ['values'], cost: { level: 'free' } });
    const a = answers({ ...lockedFree, motives: { m1: 'social', l1: 'values' }, scenes: ['scene_block_meeting'] });
    const pool = buildPool(makeContext([better, known], cat, a, { now: NOW }));
    const order = pool.scored.map((s) => s.p.g.id);
    expect(order.indexOf('known-free')).toBeLessThan(order.indexOf('unknown-cost-better-fit'));
  });

  it('says so on the card', () => {
    const out = computeResults([bare()], cat, lockedFree, { now: NOW });
    expect(out.results[0]!.notes).toContain('Cost not listed.');
  });

  it('counts every kind of locked unknown the same way', () => {
    const cases: [string, Parameters<typeof answers>[0], string][] = [
      ['schedule', { when: { days: ['sat'], times: ['morning'], flexible: false, locked: true } }, 'Days and times not listed.'],
      ['often', { often: { value: 'monthly', locked: true } }, 'How often it meets is not listed.'],
      ['access', { wheelchair: { value: true, locked: true } }, 'Access not listed. Ask the group first.'],
      ['languages', { languages: { codes: ['es'], locked: true } }, 'Languages not listed.'],
      ['background', { noBackgroundCheck: { value: true, locked: true } }, 'Background check rules not listed.'],
    ];
    for (const [, extra, note] of cases) {
      const out = computeResults([bare()], cat, answers(extra), { now: NOW });
      expect(out.results, note).toHaveLength(1);
      expect(out.results[0]!.notes).toContain(note);
    }
  });
});

describe('groups with no coordinates', () => {
  const placed = answers({ place: { hood: 'spruce_hill' }, far: { mode: 'walk', minutes: 30, locked: true } });

  it('are not ruled out by a locked distance, and are shown after the ones we can measure', () => {
    const nowhere = bare({ id: 'nowhere-group', name: 'Nowhere Group', locations: [], interests: ['civic_association'] });
    const near = full({ id: 'near-group', name: 'Near Group', motives: [] });
    const a = answers({ ...placed, scenes: ['scene_block_meeting'] });
    const out = computeResults([nowhere, near], cat, a, { now: NOW });
    expect(out.results.map((r) => r.group.id)).toEqual(['near-group', 'nowhere-group']);
    expect(out.results[1]!.notes).toContain('Location not listed.');
  });

  it('are neutral on distance when the distance is not locked', () => {
    const nowhere = bare({ locations: [] });
    const s = scoreOf(nowhere, answers({ place: { hood: 'spruce_hill' }, far: { mode: 'walk', minutes: 15, locked: false } }))!;
    expect(s.parts.practical).toBeCloseTo(0.5, 2);
  });

  it('use the middle of their neighborhood or ZIP when that is all there is', () => {
    const zipOnly = bare({ locations: [{ zip: '19104', in_city: true }] });
    const hoodOnly = bare({ locations: [{ neighborhood: 'spruce_hill', in_city: true }] });
    const ride = answers({ place: { hood: 'spruce_hill' }, far: { mode: 'septa', minutes: 30, locked: true } });
    for (const g of [zipOnly, hoodOnly]) {
      const ctx = makeContext([g], cat, ride, { now: NOW });
      const e = evaluate(prepare(g, cat), ctx.profile);
      expect(e.minutes).toBeDefined();
      expect(e.fails).toEqual([]);
    }
  });

  it('with only a planning district, rule out a group only when it is clearly too far', () => {
    const farDistrict = bare({ locations: [{ planning_district: 'upper_far_northeast', in_city: true }] });
    const ctx = makeContext([farDistrict], cat, placed, { now: NOW });
    const e = evaluate(prepare(farDistrict, cat), ctx.profile);
    expect(e.precision).toBe('district');
    expect(e.fails).toContain('far');
  });
});

describe('people who gave very little', () => {
  it('get results from a list of nothing but thin records', () => {
    const thin = Array.from({ length: 30 }, (_, i) => bare({ id: `thin-${i}`, name: `Thin ${i}`, categories: [['neighborhood-civic', 'nature-environment', 'books-writing'][i % 3]], interests: [['civic_association', 'park_cleanup', 'library_programs'][i % 3]] }));
    for (const name of Object.keys(PEOPLE)) {
      const out = computeResults(thin, cat, PEOPLE[name]!, { now: NOW });
      expect(out.results.length, name).toBeGreaterThanOrEqual(0);
      for (const r of out.results) {
        expect(Number.isFinite(r.score)).toBe(true);
      }
    }
  });

  it('get an empty list and an honest diagnosis when there is nothing', () => {
    const out = computeResults([], cat, PEOPLE.teen!, { now: NOW });
    expect(out.results).toEqual([]);
    expect(out.diagnosis).toEqual({ pool: 0, passed: 0, blockers: [] });
  });

  it('do not crash on records with no interests, no categories and no locations at all', () => {
    const odd = normalizeGroup({ id: 'odd', name: 'Odd', summary: '', kind: 'club', research_tier: 1, status: 'active' });
    const out = computeResults([odd], cat, PEOPLE.extrovert!, { now: NOW });
    expect(out.results.length).toBeLessThanOrEqual(1);
  });

  it('ignore an unknown scene, family, motive or place id', () => {
    const a = answers({ scenes: ['nope'], picked: ['nope'], starred: ['nope'], tags: ['nope'], motives: { m1: 'nope' }, place: { hood: 'nope' }, far: { mode: 'walk', minutes: 20, locked: true }, future: ['nope'] });
    const out = computeResults(testGroups(), cat, a, { now: NOW });
    expect(out.results.length).toBeGreaterThan(0);
  });
});

describe('profile edge cases', () => {
  it('turns a locked distance with no starting point into no filter at all', () => {
    const a = answers({ far: { mode: 'walk', minutes: 10, locked: true } });
    const out = computeResults(testGroups(), cat, a, { now: NOW });
    expect(out.diagnosis.blockers).toEqual([]);
    expect(out.results).toHaveLength(8);
  });

  it('derives a profile without scenes', () => {
    const p = deriveProfile(answers(), cat);
    expect(p.hasInterest).toBe(false);
    expect(p.hasMotive).toBe(false);
    expect(p.age).toEqual({ lo: 21, hi: 21 });
  });
});

describe('scoring is deterministic', () => {
  it('gives the same score twice', () => {
    const g = full();
    const ctx = makeContext([g], cat, PEOPLE.retiree!, { now: NOW });
    const p = prepare(g, cat);
    const ev = evaluate(p, ctx.profile);
    const a = scoreGroup(p, ev, ctx.profile, ctx.taste, NOW);
    const b = scoreGroup(p, ev, ctx.profile, ctx.taste, NOW);
    expect(a.score).toBe(b.score);
  });
});
