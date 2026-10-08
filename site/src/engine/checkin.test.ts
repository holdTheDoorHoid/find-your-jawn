import { describe, expect, it } from 'vitest';
import { answersFromGroup, nextRung, similarTo } from './checkin';
import { testGroups } from './test-groups';
import { answers, NOW, PEOPLE, realCatalog } from './testing';

const cat = realCatalog();
const groups = testGroups();
const visited = groups.find((g) => g.id === 'philly-hiking-club')!;

describe('the next rung after a visit', () => {
  const rungs = nextRung(groups, cat, visited, undefined, { now: NOW });

  it('suggests more groups like the one visited, but not that group', () => {
    expect(rungs.more.length).toBeGreaterThan(0);
    for (const r of rungs.more) expect(r.group.id).not.toBe(visited.id);
  });

  it('can suggest a bigger role and a stretch, each labeled as one', () => {
    for (const r of [rungs.bigger, rungs.stretch]) {
      if (!r) continue;
      expect(r.kind).toBe('stretch');
      expect(r.group.id).not.toBe(visited.id);
      expect(r.stretchLine).toMatch(/^This is a stretch:/);
    }
    if (rungs.bigger) expect(rungs.bigger.stretch).toBe('depth');
    if (rungs.stretch) expect(rungs.stretch.stretch).not.toBe('depth');
  });

  it('uses the answers the person gave, when there are any', () => {
    const mine = nextRung(groups, cat, visited, { ...PEOPLE.extrovert!, budget: { value: 'free', locked: true } }, { now: NOW });
    for (const r of [...mine.more, mine.bigger, mine.stretch]) if (r) expect(r.group.cost.level).not.toBe('paid');
  });

  it('works for someone who never took the quiz: the visited group is the starting point', () => {
    const a = answersFromGroup(visited);
    expect(a.starred).toEqual([visited.categories[0]]);
    expect(a.tags).toEqual(visited.interests);
  });
});

describe('what to do when a visit did not happen', () => {
  it('finds cheaper groups when cost was the problem', () => {
    const paid = groups.find((g) => g.id === 'fishtown-improv-night')!;
    const out = similarTo(groups, cat, paid, undefined, { now: NOW, cheaper: true });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(['free', 'unknown']).toContain(r.group.cost.level);
  });

  it('favors drop in groups when nobody replied', () => {
    const out = similarTo(groups, cat, visited, undefined, { now: NOW, dropIn: true });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(r.group.first_step.drop_in === true || r.group.commitment === 'drop_in').toBe(true);
  });

  it('never suggests the group itself', () => {
    for (const opts of [{}, { cheaper: true }, { dropIn: true }]) {
      for (const r of similarTo(groups, cat, visited, answers(), { now: NOW, ...opts })) expect(r.group.id).not.toBe(visited.id);
    }
  });
});
