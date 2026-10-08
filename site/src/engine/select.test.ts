import { describe, expect, it } from 'vitest';
import { loosen } from './filters';
import { moreResults, replacementFor, computeResults, Variety, VARIETY_CAP } from './select';
import { pickFollowUps, pickTasteCards, FOLLOW_MAX, TASTE_COUNT } from './taste';
import { straightLineTravel, haversineKm, roundMinutes } from './travel';
import { testGroups } from './test-groups';
import { answers, NOW, PEOPLE, realCatalog } from './testing';
import { sanitizeAnswers } from './answers';
import { emptyAnswers, type Answers, type Result } from './types';
import { evaluate } from './filters';
import { prepare } from './prepare';
import { deriveProfile } from './profile';

const cat = realCatalog();
const groups = testGroups();
const run = (a: Answers, extra = {}) => computeResults(groups, cat, a, { now: NOW, ...extra });

describe('Not for me', () => {
  const a = PEOPLE.extrovert!;
  const first = run(a);

  it('removes the group and fills the slot with the same kind of card', () => {
    const removed = first.results[0]!;
    const next: Answers = { ...a, notForMe: [{ id: removed.group.id, why: 'not_my_thing' }] };
    const out = run(next);
    expect(out.results.map((r) => r.group.id)).not.toContain(removed.group.id);
    const remaining = first.results.filter((r) => r.group.id !== removed.group.id);
    const fill = replacementFor(out, removed, remaining);
    expect(fill).not.toBeNull();
    expect(fill!.kind).toBe(removed.kind);
    expect(remaining.map((r) => r.group.id)).not.toContain(fill!.group.id);
    expect(fill!.group.id).not.toBe(removed.group.id);
  });

  it('keeps the other cards exactly where they are', () => {
    const removed = first.results[2]!;
    const remaining = first.results.filter((r) => r.group.id !== removed.group.id);
    const out = run({ ...a, notForMe: [{ id: removed.group.id, why: 'far' }] });
    const fill = replacementFor(out, removed, remaining)!;
    const list = first.results.map((r) => (r.group.id === removed.group.id ? fill : r));
    expect(list).toHaveLength(first.results.length);
    expect(list.filter((r) => r.group.id !== fill.group.id).map((r) => r.group.id)).toEqual(remaining.map((r) => r.group.id));
  });

  it('keeps the variety rule when it fills the slot', () => {
    let current: Result[] = first.results;
    let answersNow = a;
    for (let i = 0; i < 5; i++) {
      const removed = current[0]!;
      answersNow = { ...answersNow, notForMe: [...answersNow.notForMe, { id: removed.group.id, why: 'not_my_thing' }] };
      const out = run(answersNow);
      const remaining = current.filter((r) => r.group.id !== removed.group.id);
      const fill = replacementFor(out, removed, remaining);
      current = fill ? [...remaining, fill] : remaining;
    }
    const fam = new Map<string, number>();
    for (const r of current) fam.set(r.group.categories[0] ?? '', (fam.get(r.group.categories[0] ?? '') ?? 0) + 1);
    for (const n of fam.values()) expect(n).toBeLessThanOrEqual(VARIETY_CAP);
    expect(new Set(current.map((r) => r.group.id)).size).toBe(current.length);
  });

  it('"too far" shrinks the travel limit for this visit', () => {
    const base = answers({ place: { hood: 'rittenhouse' }, far: { mode: 'septa', minutes: 40, locked: true } });
    const gid = run(base).results[0]!.group.id;
    const after = deriveProfile({ ...base, notForMe: [{ id: gid, why: 'far' }] }, cat, (id) => groups.find((g) => g.id === id));
    expect(after.feedback.travelScale).toBeCloseTo(0.8, 5);
    const outAfter = run({ ...base, notForMe: [{ id: gid, why: 'far' }] });
    for (const r of outAfter.results) expect(r.minutes === undefined || r.minutes <= 40 * 0.8 + 5).toBe(true);
  });

  it('"not my thing" pushes away from the same interest', () => {
    const base = answers({ scenes: ['scene_book_coffee', 'scene_pottery'], place: { hood: 'fishtown' } });
    const out0 = run(base, { count: 20 });
    const book = out0.results.find((r) => r.group.interests.includes('book_club'));
    expect(book).toBeDefined();
    const with0 = out0.pool.byId.get('fishtown-library-friends')!.parts.interest;
    const out1 = run({ ...base, notForMe: [{ id: book!.group.id, why: 'not_my_thing' }] }, { count: 20 });
    const lib = out1.pool.byId.get('fishtown-library-friends');
    expect(lib).toBeDefined();
    expect(lib!.parts.interest).toBeLessThan(with0);
  });

  it('"too intense" makes strangers feel one step harder', () => {
    const base = answers({ strangers: 3, scenes: ['scene_pickup_soccer'] });
    const gid = run(base).results[0]!.group.id;
    const p = deriveProfile({ ...base, notForMe: [{ id: gid, why: 'intense' }] }, cat, (id) => groups.find((g) => g.id === id));
    expect(p.strangers).toBe(4);
    expect(p.hardStrangers).toBe(true);
  });

  it('"already in it" hides the group and counts as a vote for its topic', () => {
    const base = answers({ scenes: ['scene_book_coffee'] });
    const out0 = run(base, { count: 40 });
    const club = out0.pool.byId.get('central-library-book-club')!;
    const next: Answers = { ...base, notForMe: [{ id: 'central-library-book-club', why: 'already' }] };
    const out1 = run(next, { count: 40 });
    expect(out1.results.map((r) => r.group.id)).not.toContain('central-library-book-club');
    expect(out1.pool.byId.has('central-library-book-club')).toBe(false);
    expect(club).toBeDefined();
  });
});

describe('Show me more', () => {
  it('adds close fits that are not on the page already', () => {
    const out = run(PEOPLE.shy!);
    const more = moreResults(out, out.results, 4);
    expect(more.length).toBeGreaterThan(0);
    const shown = new Set(out.results.map((r) => r.group.id));
    for (const r of more) expect(shown.has(r.group.id)).toBe(false);
    expect(more.every((r) => r.kind === 'close')).toBe(true);
  });

  it('can bring back the group the variety rule held back on the first page', () => {
    const out = run(PEOPLE.court!);
    const passed = out.diagnosis.passed;
    const shownFirst = out.results.length;
    const more = moreResults(out, out.results, 4);
    expect(shownFirst + more.length).toBe(passed);
  });
});

describe('the honest empty state', () => {
  it('names the locked answer doing the blocking and loosening it brings groups back', () => {
    const a = answers({ budget: { value: 'free', locked: true }, when: { days: ['mon'], times: ['night'], flexible: false, locked: true }, scenes: ['scene_book_coffee'] });
    const out = run(a);
    expect(out.diagnosis.blockers.length).toBeGreaterThan(0);
    const top = out.diagnosis.blockers[0]!;
    const looser = run(loosen(a, top.key));
    expect(looser.diagnosis.passed).toBeGreaterThan(out.diagnosis.passed);
  });

  it('counts only groups that break nothing else', () => {
    const a = answers({ budget: { value: 'free', locked: true } });
    const out = run(a);
    const looser = run(loosen(a, 'budget'));
    expect(looser.diagnosis.passed - out.diagnosis.passed).toBe(out.diagnosis.blockers.find((b) => b.key === 'budget')!.count);
  });

  it('treats a loosened lock as a wish, not a rule', () => {
    const a = loosen(answers({ budget: { value: 'free', locked: true } }), 'budget');
    const profile = deriveProfile(a, cat);
    const paid = groups.find((g) => g.cost.level === 'paid')!;
    expect(evaluate(prepare(paid, cat), profile).fails).toEqual([]);
  });
});

describe('the variety rule', () => {
  it('holds each family and organization to two and nudges between batches', () => {
    const v = new Variety();
    const p = (id: string) => prepare(groups.find((g) => g.id === id)!, cat);
    const a = p('philadelphia-grotto');
    const b = p('philly-hiking-club');
    const c = p('grotto-trip-leaders');
    v.take(a);
    expect(v.canTake(b)).toBe(true);
    v.take(b);
    expect(v.canTake(c)).toBe(false);
    expect(new Variety().seed([a, b]).canTake(c)).toBe(true);
    expect(new Variety().seed([a, b]).penalty(c)).toBeGreaterThan(0);
  });
});

describe('the taste test', () => {
  it('picks six to eight real groups', () => {
    for (const name of Object.keys(PEOPLE)) {
      const cards = pickTasteCards(groups, cat, PEOPLE[name]!, { now: NOW });
      expect(cards.length, name).toBeLessThanOrEqual(8);
      expect(cards.length, name).toBeGreaterThanOrEqual(1);
      expect(new Set(cards.map((c) => c.group.id)).size).toBe(cards.length);
    }
    expect(pickTasteCards(groups, cat, PEOPLE.extrovert!, { now: NOW })).toHaveLength(TASTE_COUNT);
  });

  it('keeps every card inside the deal breakers', () => {
    const a = answers({ budget: { value: 'free', locked: true }, age: { lo: 15, hi: 15 }, scenes: ['scene_pickup_soccer', 'scene_book_coffee'] });
    const profile = deriveProfile(a, cat);
    for (const c of pickTasteCards(groups, cat, a, { now: NOW })) {
      const e = evaluate(prepare(c.group, cat), profile);
      expect(e.fails, c.group.name).toEqual([]);
      expect(c.group.cost.level === 'paid' || c.group.cost.level === 'low').toBe(false);
      expect(c.group.audience.min_age ?? 0).toBeLessThanOrEqual(15);
    }
  });

  it('shows cards that differ from each other', () => {
    const cards = pickTasteCards(groups, cat, PEOPLE.retiree!, { now: NOW });
    const fam = new Map<string, number>();
    for (const c of cards) fam.set(c.group.categories[0] ?? '', (fam.get(c.group.categories[0] ?? '') ?? 0) + 1);
    for (const n of fam.values()) expect(n).toBeLessThanOrEqual(2);
    expect(fam.size).toBeGreaterThanOrEqual(3);
  });

  it('includes one or two probes from further away, marked', () => {
    const cards = pickTasteCards(groups, cat, { ...PEOPLE.extrovert!, newness: 5 }, { now: NOW });
    const probes = cards.filter((c) => c.probe);
    expect(probes.length).toBeGreaterThanOrEqual(1);
    expect(probes.length).toBeLessThanOrEqual(2);
  });

  it('does not repeat a card the person already answered', () => {
    const a = PEOPLE.shy!;
    const first = pickTasteCards(groups, cat, a, { now: NOW });
    const answered: Answers = { ...a, taste: Object.fromEntries(first.map((c) => [c.group.id, { r: 'maybe' as const }])) };
    const second = pickTasteCards(groups, cat, answered, { now: NOW });
    for (const c of second) expect(first.map((x) => x.group.id)).not.toContain(c.group.id);
  });

  it('shifts the results: into it lifts similar groups, not for me lowers them', () => {
    const a = answers({ scenes: ['scene_book_coffee', 'scene_garden'] });
    const base = run(a, { count: 40 }).pool.byId.get('central-library-book-club')!.parts.taste;
    const liked = run({ ...a, taste: { 'fishtown-library-friends': { r: 'into' } } }, { count: 40 }).pool.byId.get('central-library-book-club')!.parts.taste;
    const disliked = run({ ...a, taste: { 'fishtown-library-friends': { r: 'not', why: 'not_my_thing' } } }, { count: 40 }).pool.byId.get('central-library-book-club')!.parts.taste;
    expect(base).toBe(0.5);
    expect(liked).toBeGreaterThan(base);
    expect(disliked).toBeLessThan(base);
  });

  it('returns nothing when nothing is left to show', () => {
    expect(pickTasteCards([], cat, answers(), { now: NOW })).toEqual([]);
  });
});

describe('follow up questions', () => {
  it('asks at most three, and none when no answer would change the top eight', () => {
    for (const name of Object.keys(PEOPLE)) {
      const picks = pickFollowUps(groups, cat, PEOPLE[name]!, { now: NOW });
      expect(picks.length, name).toBeLessThanOrEqual(FOLLOW_MAX);
    }
    expect(pickFollowUps([], cat, answers(), { now: NOW })).toEqual([]);
  });

  it('asks only what could change the eight, and never what is already answered', () => {
    const a = answers({ scenes: ['scene_cave', 'scene_pickup_soccer', 'scene_book_coffee'], picked: ['outdoors-adventure', 'books-writing', 'sports-teams'], place: { hood: 'rittenhouse' }, far: { mode: 'septa', minutes: 60, locked: false } });
    const picks = pickFollowUps(groups, cat, a, { now: NOW });
    for (const p of picks) {
      expect(p.change).toBeGreaterThanOrEqual(2);
      const answeredEarly = { ...a, follow: { [p.id]: 'x' } };
      expect(pickFollowUps(groups, cat, answeredEarly, { now: NOW }).map((q) => q.id)).not.toContain(p.id);
    }
  });

  it('skips cadence when how often was answered', () => {
    const a = { ...PEOPLE.extrovert!, often: { value: 'weekly' as const, locked: false } };
    expect(pickFollowUps(groups, cat, a, { now: NOW }).map((q) => q.id)).not.toContain('cadence');
  });
});

describe('travel estimates', () => {
  const fishtown: [number, number] = [39.9729, -75.1247];
  const rittenhouse: [number, number] = [39.9492, -75.1728];
  const mayfair: [number, number] = [40.0355, -75.0584];

  it('measures straight line distance', () => {
    expect(haversineKm(fishtown, fishtown)).toBe(0);
    expect(haversineKm(fishtown, rittenhouse)).toBeGreaterThan(4);
    expect(haversineKm(fishtown, rittenhouse)).toBeLessThan(5);
  });

  it('walks about three miles an hour, with a street factor', () => {
    const m = straightLineTravel.minutes(fishtown, rittenhouse, 'walk');
    expect(m).toBeGreaterThan(60);
    expect(m).toBeLessThan(80);
  });

  it('rides SEPTA at about 8 to 10 miles an hour door to door', () => {
    const m = straightLineTravel.minutes(fishtown, mayfair, 'septa');
    const km = haversineKm(fishtown, mayfair) * 1.3;
    const mph = (km / 1.609344) / (m / 60);
    expect(mph).toBeGreaterThan(7);
    expect(mph).toBeLessThan(11);
  });

  it('never makes a short trip on SEPTA slower than walking', () => {
    const near: [number, number] = [39.9735, -75.1255];
    expect(straightLineTravel.minutes(fishtown, near, 'septa')).toBeLessThanOrEqual(straightLineTravel.minutes(fishtown, near, 'walk'));
  });

  it('is faster by car than by SEPTA on a long trip', () => {
    expect(straightLineTravel.minutes(fishtown, mayfair, 'drive')).toBeLessThan(straightLineTravel.minutes(fishtown, mayfair, 'septa'));
  });

  it('grows with distance and rounds to five minutes for display', () => {
    expect(straightLineTravel.minutes(fishtown, mayfair, 'septa')).toBeGreaterThan(straightLineTravel.minutes(fishtown, rittenhouse, 'septa'));
    expect(roundMinutes(22)).toBe(20);
    expect(roundMinutes(23)).toBe(25);
    expect(roundMinutes(1)).toBe(5);
  });

  it('can be swapped for real transit times', () => {
    const fixed = { minutes: () => 7 };
    const a = answers({ place: { hood: 'fishtown' }, far: { mode: 'septa', minutes: 10, locked: true } });
    const out = computeResults(groups, cat, a, { now: NOW, travel: fixed, count: 40 });
    expect(out.results.length).toBeGreaterThan(0);
    for (const r of out.results) expect(r.minutes === undefined || r.minutes === 5 || r.minutes === 10).toBe(true);
  });
});

describe('reading answers back from storage', () => {
  it('gives empty answers for nonsense', () => {
    for (const bad of [null, undefined, 5, 'x', [], { v: 'x' }]) expect(sanitizeAnswers(bad)).toEqual(emptyAnswers());
  });

  it('keeps what is valid and drops what is not', () => {
    const a = sanitizeAnswers({
      paths: ['hours', 'bogus'],
      scenes: ['scene_cave', 5, null],
      age: { lo: 15, hi: 15 },
      far: { mode: 'rocket', minutes: 30 },
      budget: { value: 'free', locked: true },
      faith: { mode: 'exclude' },
      strangers: 9,
      taste: { a: { r: 'into' }, b: { r: 'wat' } },
      dial: 'wild',
      loose: ['budget', 'nope'],
      notForMe: [{ id: 'x', why: 'far' }, { id: 5 }],
    });
    expect(a.paths).toEqual(['hours']);
    expect(a.scenes).toEqual(['scene_cave']);
    expect(a.age).toEqual({ lo: 15, hi: 15 });
    expect(a.far).toBeUndefined();
    expect(a.budget).toEqual({ value: 'free', locked: true });
    expect(a.faith?.mode).toBe('exclude');
    expect(a.strangers).toBe(5);
    expect(Object.keys(a.taste)).toEqual(['a']);
    expect(a.dial).toBe('balanced');
    expect(a.loose).toEqual(['budget']);
    expect(a.notForMe).toEqual([{ id: 'x', why: 'far' }]);
  });

  it('round trips every fixture person', () => {
    for (const [name, person] of Object.entries(PEOPLE)) {
      const back = sanitizeAnswers(JSON.parse(JSON.stringify(person)));
      expect(back.scenes, name).toEqual(person.scenes);
      expect(back.age, name).toEqual(person.age);
      expect(back.far, name).toEqual(person.far);
      expect(back.motives, name).toEqual(person.motives);
    }
  });
});
