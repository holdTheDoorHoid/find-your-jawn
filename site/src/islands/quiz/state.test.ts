import { describe, expect, it } from 'vitest';
import { answers, realCatalog } from '../../engine/testing';
import { needsExtraScenes, newState, nextScreen, progressPercent, readState, sequence, shuffle, stepNumber, SCREEN_IDS } from './state';

const cat = realCatalog();

describe('which screens apply', () => {
  it('starts with the start screen and ends with results', () => {
    const seq = sequence(answers(), false);
    expect(seq[0]).toBe('start');
    expect(seq[seq.length - 1]).toBe('results');
  });

  it('follows the stages in DESIGN section 2.2', () => {
    const seq = sequence(answers({ picked: ['books-writing', 'music'], starred: ['music'], motives: { m1: 'social' } }), false);
    const order = ['scenes', 'moments', 'when', 'often', 'far', 'budget', 'rules_a', 'rules_b', 'interests', 'stars', 'tags', 'motives1', 'motives2', 'meet', 'strangers', 'newness', 'future', 'taste', 'follow', 'heard', 'results'];
    expect(seq.filter((s) => order.includes(s))).toEqual(order);
    // warm up first, deal breakers second, optional personal questions last
    expect(seq.indexOf('scenes')).toBeLessThan(seq.indexOf('when'));
    expect(seq.indexOf('budget')).toBeLessThan(seq.indexOf('interests'));
    expect(seq.indexOf('meet')).toBeGreaterThan(seq.indexOf('interests'));
  });

  it('adds the path screens the person asked for, right after the start', () => {
    const seq = sequence(answers({ paths: ['court', 'kids', 'student'] }), false);
    expect(seq.slice(0, 4)).toEqual(['start', 'court', 'kids', 'student']);
    expect(sequence(answers({ paths: ['explore'] }), false)).not.toContain('court');
  });

  it('opens stars only after two picks, and tags only for starred families', () => {
    expect(sequence(answers({ picked: ['music'] }), false)).not.toContain('stars');
    expect(sequence(answers({ picked: ['music', 'books-writing'] }), false)).toContain('stars');
    expect(sequence(answers({ picked: ['music'] }), false)).not.toContain('tags');
    expect(sequence(answers({ picked: ['music'], starred: ['music'] }), false)).toContain('tags');
  });

  it('asks the second round of reasons only after the first', () => {
    expect(sequence(answers(), false)).not.toContain('motives2');
    expect(sequence(answers({ motives: { m1: 'social', l1: 'career' } }), false)).toContain('motives2');
  });

  it('moves to the next screen that applies', () => {
    expect(nextScreen('start', answers({ paths: ['kids'] }), false)).toBe('kids');
    expect(nextScreen('start', answers(), false)).toBe('scenes');
    expect(nextScreen('scenes', answers(), true)).toBe('scenes_more');
    expect(nextScreen('scenes', answers(), false)).toBe('moments');
    expect(nextScreen('heard', answers(), false)).toBe('results');
  });

  it('skips forward when the current screen stopped applying', () => {
    expect(nextScreen('tags', answers({ picked: ['music'] }), false)).toBe('motives1');
  });

  it('can reach every screen from the start', () => {
    const a = answers({ paths: ['hours', 'court', 'kids', 'newcomer', 'student'], picked: ['music', 'books-writing'], starred: ['music'], motives: { m1: 'social' } });
    const seq = sequence(a, true);
    expect(new Set(seq).size).toBe(SCREEN_IDS.length);
  });
});

describe('the second set of scenes', () => {
  it('is offered when the picks are few', () => {
    expect(needsExtraScenes(cat, [])).toBe(false);
    expect(needsExtraScenes(cat, ['scene_cave'])).toBe(true);
    expect(needsExtraScenes(cat, ['scene_cave', 'scene_garden'])).toBe(true);
  });

  it('is offered when the picks are mixed: no two share an interest family', () => {
    expect(needsExtraScenes(cat, ['scene_cave', 'scene_garden', 'scene_play'])).toBe(true);
  });

  it('is not offered when the picks show a clear taste', () => {
    // two of the three share the neighborhood and civic life family
    expect(needsExtraScenes(cat, ['scene_block_meeting', 'scene_safe_streets', 'scene_garden'])).toBe(false);
  });
});

describe('the progress bar', () => {
  const a = answers({ picked: ['music', 'books-writing'], starred: ['music'], motives: { m1: 'social' } });
  const seq = sequence(a, false).filter((s) => s !== 'results');

  it('moves fast at the start and slows near the end', () => {
    const p = seq.map((s) => progressPercent(s, a, false));
    const early = p[4]! - p[0]!;
    const late = p[p.length - 1]! - p[p.length - 5]!;
    expect(early).toBeGreaterThan(late);
  });

  it('never goes backward and only reaches 100 on the results', () => {
    const p = seq.map((s) => progressPercent(s, a, false));
    for (let i = 1; i < p.length; i++) expect(p[i]!).toBeGreaterThanOrEqual(p[i - 1]!);
    expect(Math.max(...p)).toBeLessThan(100);
    expect(progressPercent('results', a, false)).toBe(100);
  });

  it('counts steps for the screen reader', () => {
    expect(stepNumber('start', a, false).n).toBe(1);
    expect(stepNumber('heard', a, false).n).toBe(stepNumber('heard', a, false).total);
  });
});

describe('the shuffled order', () => {
  const items = Array.from({ length: 12 }, (_, i) => i);

  it('is the same every time for the same seed', () => {
    expect(shuffle(items, 42, 'scenes')).toEqual(shuffle(items, 42, 'scenes'));
  });

  it('differs between seeds and between screens', () => {
    expect(shuffle(items, 1, 'scenes')).not.toEqual(shuffle(items, 2, 'scenes'));
    expect(shuffle(items, 1, 'scenes')).not.toEqual(shuffle(items, 1, 'moments'));
  });

  it('keeps every item exactly once and does not touch the original', () => {
    const out = shuffle(items, 7);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
    expect(items).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it('does not favor the first option: each item lands in each place about equally often', () => {
    const counts = new Array(items.length).fill(0) as number[];
    for (let seed = 0; seed < 2400; seed++) counts[shuffle(items, seed, 'x').indexOf(0)]! += 1;
    // 2400 / 12 = 200 per place, give or take
    for (const c of counts) {
      expect(c).toBeGreaterThan(130);
      expect(c).toBeLessThan(270);
    }
  });
});

describe('saved state', () => {
  it('round trips', () => {
    const s = newState(5);
    s.screen = 'moments';
    s.history = ['start', 'scenes'];
    s.answers.scenes = ['scene_cave'];
    s.tasteIds = ['a', 'b'];
    s.tasteProbes = ['b'];
    s.followIds = ['setting'];
    const back = readState(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
  });

  it('rejects anything else', () => {
    expect(readState(null)).toBeNull();
    expect(readState({})).toBeNull();
    expect(readState({ v: 2, screen: 'start' })).toBeNull();
    expect(readState({ v: 1, screen: 'nowhere' })).toBeNull();
  });

  it('cleans up a damaged copy', () => {
    const s = readState({ v: 1, screen: 'when', history: ['start', 'bogus', 5], answers: { scenes: 'oops' }, seed: 'x', tasteIds: [1, 'a'], followIds: ['setting', 'x'] });
    expect(s).not.toBeNull();
    expect(s!.history).toEqual(['start']);
    expect(s!.answers.scenes).toEqual([]);
    expect(s!.tasteIds).toEqual(['a']);
    expect(s!.followIds).toEqual(['setting']);
  });
});
