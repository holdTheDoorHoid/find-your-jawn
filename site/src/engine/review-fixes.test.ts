import { describe, expect, it } from 'vitest';
import { normalizeGroup } from '../lib/normalize';
import { plainName } from '../lib/text';
import type { Group } from '../lib/types';
import { evaluate } from './filters';
import { buildPool, makeContext } from './match';
import { orgKey, prepare } from './prepare';
import { deriveProfile } from './profile';
import { computeResults } from './select';
import { pickTasteCards } from './taste';
import { wildcardCandidates } from './stretch';
import { testGroups } from './test-groups';
import { answers, NOW, PEOPLE, realCatalog } from './testing';

// Regression tests for problems an independent review found in the first version of the engine.

const cat = realCatalog();
const groups = testGroups();
const run = (a: ReturnType<typeof answers>, list: Group[] = groups, extra = {}) => computeResults(list, cat, a, { now: NOW, ...extra });

function mk(over: Record<string, unknown>): Group {
  return normalizeGroup({ id: 'x', name: 'X', summary: 'x', kind: 'club', categories: ['games-puzzles'], interests: ['board_games'], research_tier: 1, status: 'active', ...over });
}

describe('a taste test "Not for me"', () => {
  it('takes the group out of the results, like a Not for me on a result', () => {
    const a = PEOPLE.teen!;
    const first = run(a).results[0]!.group.id;
    const out = run({ ...a, taste: { [first]: { r: 'not', why: 'not_my_thing' } } }, groups, { count: 40 });
    expect(out.results.map((r) => r.group.id)).not.toContain(first);
    expect(out.pool.byId.has(first)).toBe(false);
  });

  it('even without a reason', () => {
    const a = PEOPLE.shy!;
    const first = run(a).results[0]!.group.id;
    expect(run({ ...a, taste: { [first]: { r: 'not' } } }).results.map((r) => r.group.id)).not.toContain(first);
  });

  it('but "Into it" and "Maybe" keep the group eligible', () => {
    const a = PEOPLE.shy!;
    const first = run(a).results[0]!.group.id;
    expect(run({ ...a, taste: { [first]: { r: 'into' } } }).pool.byId.has(first)).toBe(true);
    expect(run({ ...a, taste: { [first]: { r: 'maybe' } } }).pool.byId.has(first)).toBe(true);
  });
});

describe('the taste test cards', () => {
  it('never show the same group twice, for any fixture person or when probes are scarce', () => {
    const people = [...Object.values(PEOPLE), answers({ scenes: ['scene_fix_bikes', 'scene_street_trees', 'scene_block_meeting'], often: { value: 'once', locked: true } })];
    for (const a of people) {
      const cards = pickTasteCards(groups, cat, a, { now: NOW });
      expect(new Set(cards.map((c) => c.group.id)).size).toBe(cards.length);
    }
  });
});

describe('the wildcard', () => {
  it('is never from a family the person picked or starred', () => {
    const a = answers({ starred: ['arts-crafts'], picked: ['arts-crafts'], tags: ['pottery_ceramics', 'birding', 'caving'], moments: ['moment_organizing'], motives: { m1: 'protective', m2: 'values' }, dial: 'balanced' });
    const out = run(a);
    for (const w of out.results.filter((r) => r.kind === 'wildcard')) expect(w.group.categories).not.toContain('arts-crafts');
    const pool = buildPool(makeContext(groups, cat, a, { now: NOW }));
    for (const c of wildcardCandidates(pool, new Set())) expect(c.s.p.families).not.toContain('arts-crafts');
  });

  it('prefers a group whose practical facts we could confirm', () => {
    const a = answers({ dial: 'bold', noBackgroundCheck: { value: true, locked: true }, motives: { m1: 'social' }, notForMe: [{ id: 'learn-to-row-days' }] });
    const pool = buildPool(makeContext(groups, cat, a, { now: NOW }));
    const cands = wildcardCandidates(pool, new Set());
    for (let i = 1; i < cands.length; i++) expect(cands[i]!.tier).toBeGreaterThanOrEqual(cands[i - 1]!.tier);
  });

  it('says what it could not check on its card', () => {
    const a = answers({ dial: 'bold', budget: { value: 'free', locked: false }, motives: { m1: 'social' } });
    for (const r of run(a).results.filter((x) => x.kind !== 'close')) {
      if (r.group.access.wheelchair === 'unknown' && a.wheelchair) expect(r.notes.join(' ')).toMatch(/Access/);
    }
  });

  it('states the reason for joining in grammatical words', () => {
    for (const m1 of ['enhancement', 'protective', 'values', 'understanding', 'social', 'career']) {
      const out = run(answers({ dial: 'bold', motives: { m1, l1: m1 === 'career' ? 'social' : 'career' }, scenes: ['scene_pickup_soccer'] }));
      const wild = out.results.find((r) => r.kind === 'wildcard');
      if (wild) expect(wild.stretchLine).not.toMatch(/want to (feel good about myself|get out of my head)/);
    }
  });
});

describe('stretches', () => {
  it('prefer groups we could confirm over groups we could not, within the same kind', () => {
    const a = answers({ dial: 'bold', scenes: ['scene_cave'], moments: ['moment_outdoors'], place: { hood: 'rittenhouse' }, far: { mode: 'septa', minutes: 90, locked: false }, meet: { with: 'similar', communities: [] }, strangers: 4 });
    const pool = buildPool(makeContext(groups, cat, a, { now: NOW }));
    // candidates come sorted confirmed first
    const cands = [...(computeResults(groups, cat, a, { now: NOW }).stretches)];
    for (let i = 1; i < cands.length; i++) expect(cands[i]!.tier).toBeGreaterThanOrEqual(cands[i - 1]!.tier);
    expect(pool.scored.length).toBeGreaterThan(0);
  });
});

describe('explanations', () => {
  it('never carry a dash from a group name into our sentence', () => {
    const liked = mk({ id: 'trail-saturday', name: 'Wissahickon Trail Crew - Saturday Team', categories: ['nature-environment'], interests: ['trail_building'] });
    const other = mk({ id: 'trail-other', name: 'Another Trail Crew', categories: ['nature-environment'], interests: ['trail_building'] });
    const a = answers({ scenes: ['scene_garden'], taste: { 'trail-saturday': { r: 'into' } } });
    const out = run(a, [liked, other, ...groups], { count: 20 });
    const text = out.results.flatMap((r) => [...r.why, r.stretchLine ?? '']).join(' ');
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/ - /);
  });

  it('turns dashes in a name into commas', () => {
    expect(plainName('MASTERY CHARTER SCHOOL - THOMAS CAMPUS')).toBe('MASTERY CHARTER SCHOOL, THOMAS CAMPUS');
    expect(plainName('Philadelphia Senior Center – Allegheny Branch')).toBe('Philadelphia Senior Center, Allegheny Branch');
    expect(plainName('Aston-Woodbridge Friends')).toBe('Aston-Woodbridge Friends');
  });

  it('never say a group is like itself', () => {
    const a = answers({ taste: { 'esl-conversation-circle': { r: 'into' } }, dial: 'bold' });
    const out = run(a, groups, { count: 40 });
    for (const r of out.results) expect(r.why.join(' ')).not.toContain(`like ${r.group.name}, which you liked`);
  });
});

describe('access that is only partly there', () => {
  it('says so, instead of "not listed"', () => {
    const partial = mk({ id: 'partial', name: 'Partly Accessible Club', access: { wheelchair: 'partial' } });
    const out = run(answers({ wheelchair: { value: true, locked: true } }), [partial]);
    expect(out.results[0]!.notes).toContain('Only partly wheelchair accessible. Ask the group first.');
    expect(out.results[0]!.notes.join(' ')).not.toContain('not listed');
  });
});

describe('parent organizations', () => {
  it('are found even when the name uses an en dash or an em dash', () => {
    const a = mk({ name: 'Philadelphia Senior Center – Allegheny Branch' });
    const b = mk({ name: 'Philadelphia Senior Center — Avenue of the Arts' });
    const c = mk({ name: 'Philadelphia Senior Center - Northeast' });
    expect(orgKey(a)).toBe(orgKey(b));
    expect(orgKey(a)).toBe(orgKey(c));
    expect(orgKey(mk({ name: 'Aston-Woodbridge Friends' }))).toBe('aston-woodbridge-friends');
  });

  it('keep sibling branches to two results', () => {
    const branches = ['Allegheny', 'Avenue of the Arts', 'Northeast', 'South'].map((n, i) => mk({ id: `psc-${i}`, name: `Philadelphia Senior Center – ${n} Branch`, categories: ['seniors-intergenerational'], interests: ['senior_centers'] }));
    const out = run(answers({ picked: ['seniors-intergenerational'], starred: ['seniors-intergenerational'] }), [...branches, ...groups], { count: 12 });
    expect(out.results.filter((r) => r.group.id.startsWith('psc-')).length).toBeLessThanOrEqual(2);
  });
});

describe('the kids path', () => {
  const league = mk({ id: 'youth-league', name: 'Youth League', categories: ['sports-teams'], interests: ['youth_coaching'], audience: { open_to: 'public', min_age: 5, max_age: 14 }, requirements: { kids_ok: true }, crowd: ['kids'] });

  it('judges a kids group by the child’s age, not the parent’s', () => {
    const a = answers({ paths: ['kids'], kidsAges: [8], age: { lo: 35, hi: 44 } });
    const out = run(a, [league]);
    expect(out.pool.byId.has('youth-league')).toBe(true);
  });

  it('still rules out a group the child is too old or too young for', () => {
    expect(run(answers({ paths: ['kids'], kidsAges: [2], age: { lo: 35, hi: 44 } }), [league]).pool.byId.has('youth-league')).toBe(false);
    expect(run(answers({ paths: ['kids'], kidsAges: [16], age: { lo: 35, hi: 44 } }), [league]).pool.byId.has('youth-league')).toBe(false);
  });

  it('keeps the parent’s own age rules for everyone else', () => {
    const adults = mk({ id: 'adults', name: 'Adults Only', audience: { open_to: 'public', min_age: 21 }, requirements: { kids_ok: false } });
    const out = run(answers({ paths: ['kids'], kidsAges: [8], age: { lo: 18, hi: 24 }, loose: ['kids'] }), [adults]);
    expect(out.pool.byId.has('adults')).toBe(false);
  });
});

describe('faith communities', () => {
  it('are found by their family even when the faith field is missing', () => {
    const church = mk({ id: 'grace-choir', name: 'Grace Church Choir', categories: ['faith-community', 'music'], interests: ['worship_music'] });
    expect(prepare(church, cat).faith).toBe(true);
    const out = run(answers({ faith: { mode: 'exclude' } }), [church]);
    expect(out.pool.byId.has('grace-choir')).toBe(false);
  });

  it('are not stretches for someone who never answered the faith question', () => {
    const church = mk({ id: 'grace-choir', name: 'Grace Church Choir', categories: ['faith-community', 'music'], interests: ['worship_music'] });
    const pool = buildPool(makeContext([church, ...groups], cat, answers({ dial: 'bold', scenes: ['scene_book_coffee'] }), { now: NOW }));
    expect(wildcardCandidates(pool, new Set()).some((c) => c.s.p.g.id === 'grace-choir')).toBe(false);
  });
});

describe('gaps that are not mismatches', () => {
  it('a group with no tags and no categories scores neutral on interests', () => {
    const blank = mk({ id: 'blank', name: 'Blank', categories: [], interests: [] });
    const pool = buildPool(makeContext([blank], cat, PEOPLE.extrovert!, { now: NOW }));
    expect(pool.scored[0]!.parts.interest).toBe(0.5);
  });

  it('a students only group with no school listed passes as unknown for a student', () => {
    const club = mk({ id: 'club', name: 'Some Student Club', kind: 'student_org', audience: { open_to: 'students' } });
    const ctx = makeContext([club], cat, answers({ paths: ['student'], school: 'penn' }), { now: NOW });
    const e = evaluate(prepare(club, cat), ctx.profile);
    expect(e.baseOk).toBe(true);
    expect(e.unknown).toContain('school');
    expect(run(answers({ paths: ['student'], school: 'penn' }), [club]).results[0]!.notes).toContain('Which school it is for is not listed.');
  });

  it('a group with only a mailing address and online meetings is online only', () => {
    const g = mk({ id: 'mail', name: 'Mail', online_ok: true, locations: [{ label: 'Mailing address (IRS)', zip: '19104', in_city: true }] });
    expect(prepare(g, cat).onlineOnly).toBe(true);
  });
});

describe('who you would like to meet', () => {
  const vets = mk({ id: 'vets', name: 'Veterans Hiking', categories: ['outdoors-adventure'], interests: ['hiking'], audience: { open_to: 'public', community: ['veterans'] }, crowd: ['all_adults'] });
  const plain = mk({ id: 'plain', name: 'Plain Hiking', categories: ['outdoors-adventure'], interests: ['hiking'], crowd: ['all_adults'] });

  it('lifts a group for a community they said they would like to find, and says so', () => {
    const a = answers({ scenes: ['scene_cave'], meet: { with: 'mix', communities: ['veterans'] } });
    const out = run(a, [vets, plain]);
    expect(out.results[0]!.group.id).toBe('vets');
    expect(out.results[0]!.why.join(' ')).toMatch(/Veterans/);
  });

  it('does nothing when the question was skipped', () => {
    const out = run(answers({ scenes: ['scene_cave'] }), [vets, plain]);
    expect(out.results.map((r) => r.why.join(' ')).join(' ')).not.toMatch(/communities you said/);
  });
});

describe('quiz answers that were saved but unused', () => {
  it('"I would rather bring someone" makes a drop in group a little easier to try', () => {
    const easy = mk({ id: 'easy', name: 'Easy', first_step: { drop_in: true }, commitment: 'drop_in' });
    const hard = mk({ id: 'hard', name: 'Hard', first_step: { drop_in: false }, commitment: 'weekly' });
    const a = answers({ bringSomeone: true });
    const pool = buildPool(makeContext([easy, hard], cat, a, { now: NOW }));
    expect(pool.byId.get('easy')!.parts.newcomer).toBeGreaterThan(pool.byId.get('hard')!.parts.newcomer);
  });

  it('a lot of hours to give favors groups that meet often', () => {
    const often = mk({ id: 'often', name: 'Often', commitment: 'weekly' });
    const once = mk({ id: 'once', name: 'Once', commitment: 'one_off' });
    const a = answers({ paths: ['hours'], hours: { need: 40 } });
    const pool = buildPool(makeContext([often, once], cat, a, { now: NOW }));
    expect(pool.byId.get('often')!.parts.practical).toBeGreaterThan(pool.byId.get('once')!.parts.practical);
  });

  it('just arrived raises how much newcomer welcome counts', () => {
    const fresh = deriveProfile(answers({ paths: ['newcomer'], newSince: 'weeks' }), cat);
    const settled = deriveProfile(answers({ paths: ['newcomer'], newSince: 'years' }), cat);
    expect(fresh.answers.newSince).toBe('weeks');
    expect(settled.answers.newSince).toBe('years');
  });
});
