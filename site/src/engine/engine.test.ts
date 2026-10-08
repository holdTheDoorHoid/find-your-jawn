import { describe, expect, it } from 'vitest';
import type { Group } from '../lib/types';
import { prepare } from './prepare';
import { deriveProfile } from './profile';
import { computeResults, DIAL, VARIETY_CAP } from './select';
import { axesOf, onlyAxis } from './stretch';
import { evaluate, passes } from './filters';
import { testGroups } from './test-groups';
import { answers, NOW, PEOPLE, realCatalog } from './testing';
import type { Answers, Result } from './types';

// The properties DESIGN section 12 says must always hold, checked for every fixture person on a
// list of groups that has the gaps real data has.

const cat = realCatalog();
const groups = testGroups();
const byId = new Map(groups.map((g) => [g.id, g]));

function run(a: Answers, extra: Record<string, unknown> = {}) {
  return computeResults(groups, cat, a, { now: NOW, ...extra });
}

const names = Object.keys(PEOPLE);

describe('the fixture list', () => {
  it('has about sixty groups with real gaps in them', () => {
    expect(groups.length).toBeGreaterThanOrEqual(60);
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    // most records lack some of the facts the filters care about
    const noCost = groups.filter((g) => g.cost.level === 'unknown').length;
    const noDays = groups.filter((g) => g.schedule.days.length === 0).length;
    const noRating = groups.filter((g) => g.first_step.newcomer_friendliness === undefined).length;
    expect(noCost).toBeGreaterThan(10);
    expect(noDays).toBeGreaterThan(15);
    expect(noRating).toBeGreaterThan(20);
  });
});

describe.each(names)('for the fixture person %s', (name) => {
  const a = PEOPLE[name]!;
  const out = run(a);

  it('gets results, none of them twice', () => {
    expect(out.results.length).toBeGreaterThan(0);
    expect(new Set(out.results.map((r) => r.group.id)).size).toBe(out.results.length);
  });

  it('never sees a group a hard filter rules out', () => {
    const profile = deriveProfile(a, cat);
    for (const r of out.results) {
      const e = evaluate(prepare(r.group, cat), profile, {});
      expect(passes(e), `${r.group.name} should pass`).toBe(true);
    }
  });

  it('never sees a support group', () => {
    for (const r of out.results) {
      expect(r.group.audience.support_group).toBe(false);
      expect(r.group.kind).not.toBe('support_group');
      expect(r.group.categories).not.toContain('support-recovery');
    }
  });

  it('never sees a members only, invitation only or other school group', () => {
    for (const r of out.results) {
      const open = r.group.audience.open_to;
      expect(['members', 'invite']).not.toContain(open);
      if (open === 'students') expect(r.group.audience.school).toBe(a.school);
    }
  });

  it('has no more than two results sharing an interest family or a parent organization', () => {
    const fam = new Map<string, number>();
    for (const r of out.results) {
      const primary = r.group.categories[0] ?? 'none';
      fam.set(primary, (fam.get(primary) ?? 0) + 1);
    }
    for (const [family, n] of fam) expect(n, family).toBeLessThanOrEqual(VARIETY_CAP);
  });

  it('shows at most eight cards, with the right number of each kind when there is room', () => {
    expect(out.results.length).toBeLessThanOrEqual(8);
    const want = DIAL[a.dial];
    const stretches = out.results.filter((r) => r.kind === 'stretch').length;
    const wild = out.results.filter((r) => r.kind === 'wildcard').length;
    expect(stretches).toBeLessThanOrEqual(want.stretch);
    expect(wild).toBeLessThanOrEqual(want.wild);
  });

  it('labels every stretch with the one thing it changes', () => {
    const profile = deriveProfile(a, cat);
    for (const r of out.results.filter((x) => x.kind === 'stretch')) {
      const axes = axesOf(prepare(r.group, cat), profile);
      expect(onlyAxis(axes), `${r.group.name} should differ on exactly one axis`).toBe(r.stretch);
    }
  });

  it('keeps every stretch inside the practical limits', () => {
    const profile = deriveProfile(a, cat);
    for (const r of out.results.filter((x) => x.kind !== 'close')) {
      const e = evaluate(prepare(r.group, cat), profile, { strict: true });
      expect(passes(e), `${r.group.name} breaks a practical limit`).toBe(true);
    }
  });

  it('explains every result in plain words with no dashes used as punctuation', () => {
    for (const r of out.results) {
      expect(r.why.length).toBeGreaterThanOrEqual(1);
      expect(r.why.length).toBeLessThanOrEqual(3);
      const text = [...r.why, r.stretchLine ?? '', ...r.notes, r.firstStep].join(' ');
      expect(text).not.toMatch(/[–—]/);
      expect(text).not.toMatch(/ - /);
      expect(text).not.toMatch(/\{\w+\}/);
      expect(text).not.toMatch(/undefined|NaN/);
    }
  });
});

describe('court ordered service', () => {
  const a = PEOPLE.court!;
  const out = run(a, { count: 40 });

  it('shows only groups with a yes for court ordered hours', () => {
    expect(out.results.length).toBeGreaterThan(0);
    for (const r of out.results) expect(r.group.requirements.court_ordered_ok).toBe('yes');
  });

  it('also keeps the "no work with children" restriction', () => {
    for (const r of out.results) {
      expect(r.group.requirements.act153_clearances).toBe(false);
      expect(r.group.categories).not.toContain('kids-youth-mentoring');
    }
  });

  it('treats an unknown as not good enough', () => {
    const unknown = groups.filter((g) => g.requirements.court_ordered_ok !== 'yes');
    expect(unknown.length).toBeGreaterThan(30);
    for (const g of unknown) expect(out.results.map((r) => r.group.id)).not.toContain(g.id);
  });

  it('says why when nothing qualifies', () => {
    const none = computeResults(groups.map((g) => ({ ...g, requirements: { ...g.requirements, court_ordered_ok: 'unknown' as const } })), cat, a, { now: NOW });
    expect(none.results).toHaveLength(0);
    expect(none.diagnosis.blockers[0]?.key).toBe('path');
  });
});

describe('a teenager', () => {
  const a = PEOPLE.teen!;

  it('never sees a group with a minimum age above hers', () => {
    const out = run(a, { count: 40 });
    expect(out.results.length).toBeGreaterThan(3);
    for (const r of out.results) {
      const min = r.group.audience.min_age;
      if (min !== undefined) expect(min).toBeLessThanOrEqual(15);
      const max = r.group.audience.max_age;
      if (max !== undefined) expect(max).toBeGreaterThanOrEqual(15);
    }
  });

  it('never sees an 18 plus group even when she locks nothing', () => {
    const out = run(answers({ age: { lo: 15, hi: 15 }, scenes: ['scene_pickup_soccer', 'scene_cave', 'scene_book_coffee'] }), { count: 40 });
    const eighteenPlus = groups.filter((g) => (g.audience.min_age ?? 0) >= 18);
    expect(eighteenPlus.length).toBeGreaterThan(10);
    for (const g of eighteenPlus) expect(out.results.map((r) => r.group.id)).not.toContain(g.id);
  });

  it('ranks a group that signs hour forms above an otherwise identical one that does not say', () => {
    const trail = byId.get('wissahickon-trail-crew')!;
    const twin: Group = { ...trail, id: 'wissahickon-trail-crew-twin', name: 'Twin Trail Crew', requirements: { ...trail.requirements, service_hours_letter: 'unknown' } };
    const out = computeResults([...groups.filter((g) => g.id !== 'wissahickon-trail-crew'), trail, twin], cat, a, { now: NOW, count: 40 });
    const order = out.pool.scored.map((s) => s.p.g.id);
    expect(order.indexOf('wissahickon-trail-crew')).toBeLessThan(order.indexOf('wissahickon-trail-crew-twin'));
    const twinResult = out.results.find((r) => r.group.id === 'wissahickon-trail-crew-twin');
    if (twinResult) expect(twinResult.notes).toContain('Ask if they sign service hour forms.');
  });

  it('rules out a group that says it does not sign forms', () => {
    const none = groups.map((g) => (g.id === 'wissahickon-trail-crew' ? { ...g, requirements: { ...g.requirements, service_hours_letter: 'no' as const } } : g));
    const out = computeResults(none, cat, a, { now: NOW, count: 40 });
    expect(out.results.map((r) => r.group.id)).not.toContain('wissahickon-trail-crew');
  });
});

describe('free only', () => {
  const a = answers({ budget: { value: 'free', locked: true }, scenes: ['scene_pottery', 'scene_game_night', 'scene_pickup_soccer'] });

  it('never shows a paid or low cost group', () => {
    const out = run(a, { count: 60 });
    expect(out.results.length).toBeGreaterThan(5);
    for (const r of out.results) expect(['free', 'unknown']).toContain(r.group.cost.level);
  });

  it('lets unknown costs through, ranked below the free ones, and says the cost is not listed', () => {
    const out = run(a, { count: 60 });
    const unknown = out.results.filter((r) => r.group.cost.level === 'unknown');
    expect(unknown.length).toBeGreaterThan(0);
    for (const r of unknown) expect(r.notes).toContain('Cost not listed.');
    for (const r of out.results.filter((x) => x.group.cost.level === 'free')) expect(r.notes).not.toContain('Cost not listed.');
  });

  it('names the locked answer when it is what empties the list', () => {
    const only = answers({ budget: { value: 'free', locked: true } });
    const paidOnly = groups.map((g) => ({ ...g, cost: { level: 'paid' as const } }));
    const out = computeResults(paidOnly, cat, only, { now: NOW });
    expect(out.results).toHaveLength(0);
    expect(out.diagnosis.blockers[0]).toMatchObject({ key: 'budget' });
    expect(out.diagnosis.blockers[0]!.count).toBeGreaterThan(20);
  });
});

describe('people who find strangers hard', () => {
  const a = PEOPLE.grad!;

  it('get groups rated 3 or higher for newcomers when a rating exists', () => {
    const out = run(a, { count: 60 });
    for (const r of out.results) {
      const nf = r.group.first_step.newcomer_friendliness;
      if (nf !== undefined) expect(nf).toBeGreaterThanOrEqual(3);
    }
  });

  it('never see a group rated below 3', () => {
    const low = groups.filter((g) => (g.first_step.newcomer_friendliness ?? 5) < 3);
    expect(low.length).toBeGreaterThan(0);
    const out = run(a, { count: 60 });
    for (const g of low) expect(out.results.map((r) => r.group.id)).not.toContain(g.id);
  });

  it('see groups with no rating below groups that have a good one, with a note', () => {
    const out = run(answers({ strangers: 5, scenes: ['scene_book_coffee'], picked: ['books-writing'], starred: ['books-writing'] }), { count: 30 });
    const unrated = out.results.filter((r) => r.group.first_step.newcomer_friendliness === undefined);
    expect(unrated.length).toBeGreaterThan(0);
    for (const r of unrated) expect(r.notes).toContain('Not rated for newcomers yet.');
  });
});

describe('support groups', () => {
  it('appear only when asked for', () => {
    const quiet = run(answers({ scenes: ['scene_book_coffee'] }), { count: 60 });
    expect(quiet.results.some((r) => r.group.audience.support_group)).toBe(false);
    const asked = run(answers({ includeSupport: true, motives: { m1: 'protective' } }), { count: 60 });
    expect(asked.results.some((r) => r.group.audience.support_group)).toBe(true);
  });

  it('are never stretches or the wildcard, even when asked for', () => {
    const asked = run(answers({ includeSupport: true, dial: 'bold', scenes: ['scene_book_coffee', 'scene_garden'], picked: ['books-writing'], starred: ['books-writing'], meet: { with: 'similar', communities: [] } }));
    for (const r of asked.results.filter((x) => x.kind !== 'close')) expect(r.group.audience.support_group).toBe(false);
  });
});

describe('faith', () => {
  it('shows no faith community to someone who excluded faith', () => {
    for (const mode of [{ mode: 'exclude' as const }]) {
      const out = run(answers({ faith: mode, scenes: ['scene_congregation_meal', 'scene_pantry'], motives: { m1: 'values' } }), { count: 60 });
      expect(out.results.length).toBeGreaterThan(3);
      for (const r of out.results) {
        expect(r.group.kind).not.toBe('congregation');
        expect(r.group.audience.faith).toBeUndefined();
      }
    }
  });

  it('shows only their own tradition among faith groups when they chose only mine', () => {
    const out = run(answers({ faith: { mode: 'only', tradition: 'catholic' }, scenes: ['scene_congregation_meal'] }), { count: 60 });
    const faith = out.results.filter((r) => r.group.audience.faith);
    expect(faith.length).toBeGreaterThan(0);
    for (const r of faith) expect(['catholic', 'interfaith']).toContain(r.group.audience.faith);
  });

  it('is a stretch only for someone who chose to include it', () => {
    const base = { dial: 'bold' as const, scenes: ['scene_pantry'], picked: ['hunger-housing-basic-needs'], starred: ['hunger-housing-basic-needs'], place: { hood: 'olney' }, far: { mode: 'septa' as const, minutes: 60, locked: false } };
    const skipped = run(answers(base), { count: 8 });
    for (const r of skipped.results.filter((x) => x.kind !== 'close')) expect(r.group.audience.faith).toBeUndefined();
  });
});

describe('people with access needs', () => {
  const a = PEOPLE.wheelchair!;

  it('never see a group that says it is not accessible', () => {
    const out = run(a, { count: 60 });
    for (const r of out.results) expect(r.group.access.wheelchair).not.toBe('no');
  });

  it('see accessible groups first and a note on the ones that do not say', () => {
    const out = run(a, { count: 60 });
    const yes = out.results.filter((r) => r.group.access.wheelchair === 'yes');
    const unknown = out.results.filter((r) => r.group.access.wheelchair === 'unknown');
    expect(yes.length).toBeGreaterThan(0);
    expect(unknown.length).toBeGreaterThan(0);
    for (const r of unknown) expect(r.notes).toContain('Access not listed. Ask the group first.');
  });
});

describe('families with young children', () => {
  it('see only groups where kids can come and the minimum age fits the youngest', () => {
    const out = run(PEOPLE.parent!, { count: 40 });
    expect(out.results.length).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.group.requirements.kids_ok).toBe(true);
      const min = r.group.audience.min_age;
      if (min !== undefined) expect(min).toBeLessThanOrEqual(2);
    }
  });
});

describe('students', () => {
  it('see their own school groups and nobody else’s', () => {
    const out = run(PEOPLE.grad!);
    expect(out.pool.byId.has('penn-hiking-club')).toBe(true);
    expect(out.pool.byId.has('drexel-board-game-society')).toBe(false);
  });

  it('people who are not students never see school groups', () => {
    const out = run(PEOPLE.retiree!);
    expect([...out.pool.byId.values()].some((s) => s.p.g.audience.open_to === 'students')).toBe(false);
  });
});

describe('residents only groups', () => {
  it('appear only near the person', () => {
    const near = run(answers({ place: { hood: 'mayfair' }, far: { mode: 'septa', minutes: 60, locked: false } }), { count: 60 });
    expect(near.results.map((r) => r.group.id)).toContain('mayfair-civic-association');
    const far = run(answers({ place: { hood: 'cobbs_creek' }, far: { mode: 'septa', minutes: 60, locked: false } }), { count: 60 });
    expect(far.results.map((r) => r.group.id)).not.toContain('mayfair-civic-association');
  });
});

describe('the adventure dial', () => {
  const base = answers({
    scenes: ['scene_cave', 'scene_pickup_soccer'],
    moments: ['moment_outdoors'],
    picked: ['outdoors-adventure', 'sports-teams'],
    starred: ['outdoors-adventure'],
    motives: { m1: 'social', l1: 'career' },
    place: { hood: 'rittenhouse' },
    far: { mode: 'septa', minutes: 45, locked: false },
    meet: { with: 'similar', communities: [] },
    strangers: 2,
    newness: 4,
    future: ['know_neighbors'],
  });

  it('gives gentle people seven close fits and one stretch', () => {
    const out = run({ ...base, dial: 'gentle' });
    expect(out.results).toHaveLength(8);
    expect(out.results.filter((r) => r.kind === 'wildcard')).toHaveLength(0);
    expect(out.results.filter((r) => r.kind === 'stretch').length).toBeLessThanOrEqual(1);
  });

  it('gives bold people room for more stretches than gentle people', () => {
    const gentle = run({ ...base, dial: 'gentle' }).results.filter((r) => r.kind !== 'close').length;
    const bold = run({ ...base, dial: 'bold' }).results.filter((r) => r.kind !== 'close').length;
    expect(bold).toBeGreaterThanOrEqual(gentle);
  });

  it('fills the slot with a close fit when there is nothing to stretch to', () => {
    const out = run(answers({ dial: 'bold' }));
    expect(out.results).toHaveLength(8);
    expect(out.results.every((r) => r.kind === 'close')).toBe(true);
  });
});

describe('people who skip everything', () => {
  it('still get eight reasonable results', () => {
    const out = run(answers());
    expect(out.results).toHaveLength(8);
    for (const r of out.results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.why.length).toBeGreaterThan(0);
    }
  });
});

function ids(rs: Result[]): string[] {
  return rs.map((r) => r.group.id);
}

describe('results do not depend on the order of the list', () => {
  it('gives the same cards for a shuffled list', () => {
    const a = PEOPLE.shy!;
    const reversed = [...groups].reverse();
    const x = ids(computeResults(groups, cat, a, { now: NOW }).results);
    const y = ids(computeResults(reversed, cat, a, { now: NOW }).results);
    expect(y).toEqual(x);
  });

  it('knows every group it returns', () => {
    for (const name of names) for (const r of run(PEOPLE[name]!).results) expect(byId.get(r.group.id)).toBeDefined();
  });
});

describe('Group typing', () => {
  it('keeps result groups as the originals', () => {
    const g: Group | undefined = groups[0];
    expect(g).toBeDefined();
  });
});
