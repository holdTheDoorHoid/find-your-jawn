import { describe, expect, it } from 'vitest';
import { makeQuizConfig } from '../../lib/quiz-config';
import { buildCatalog } from '../../engine/catalog';
import { answers, PEOPLE, realRawVocab } from '../../engine/testing';
import { buildChips } from './summary';
import { SCREEN_IDS } from './state';

const cfg = makeQuizConfig(realRawVocab(), 'x');
const cat = buildCatalog(cfg);

const full = answers({
  paths: ['hours', 'court', 'kids', 'newcomer', 'student'],
  hours: { need: 40, form: true },
  court: { need: 80, noChildren: true },
  kidsAges: [2],
  school: 'penn',
  age: { lo: 16, hi: 17 },
  scenes: ['scene_cave'],
  moments: ['moment_make'],
  words: 'chess',
  when: { days: ['sat', 'sun'], times: ['morning'], flexible: false, locked: true },
  often: { value: 'weekly', locked: true },
  place: { hood: 'fishtown' },
  far: { mode: 'septa', minutes: 30, locked: true },
  budget: { value: 'free', locked: true },
  wheelchair: { value: true, locked: true },
  languages: { codes: ['es'], locked: false },
  faith: { mode: 'only', tradition: 'catholic' },
  noBackgroundCheck: { value: true, locked: false },
  picked: ['music', 'books-writing'],
  starred: ['music'],
  tags: ['choir_singing'],
  motives: { m1: 'social', l1: 'career', m2: 'values', l2: 'protective' },
  meet: { with: 'mix', sameAge: true, communities: ['veterans'] },
  strangers: 5,
  bringSomeone: true,
  size: 'small',
  newness: 1,
  future: ['spoke_up'],
  taste: { 'some-group': { r: 'into' } },
  follow: { setting: 'outdoors' },
});

describe('here’s what we heard', () => {
  const chips = buildChips(full, cat, cfg);
  const text = chips.map((c) => c.text);

  it('says every answer in plain words', () => {
    expect(text).toContain('Service hours: 40 needed');
    expect(text).toContain('Court ordered service');
    expect(text).toContain('Bringing kids');
    expect(text).toContain('Student at Penn');
    expect(text).toContain('Most like you: meet people');
    expect(text).toContain('Least like you: build skills for work');
    expect(text).toContain('Music, starred');
    expect(text).toContain('Books and writing');
    expect(text).toContain('Up to 30 minutes by SEPTA');
    expect(text).toContain('Free only');
    expect(text).toContain('Age 16 or 17');
    expect(text).toContain('Wheelchair accessible');
    expect(text).toContain('Only my tradition: catholic');
    expect(text).toContain('Strangers feel really hard');
    expect(text).toContain('Small groups');
    expect(text).toContain('Stretch toward: "I spoke up in front of a group"');
    expect(text).toContain('Free: Sat and Sun mornings');
  });

  it('marks locked deal breakers', () => {
    const locked = chips.filter((c) => c.locked).map((c) => c.id);
    expect(locked).toEqual(expect.arrayContaining(['when', 'often', 'far', 'budget', 'wheelchair']));
    expect(locked).not.toContain('languages');
    expect(locked).not.toContain('background');
  });

  it('can take any one thing off with one tap, and only that thing', () => {
    // Answers that live inside another one go away with it.
    const inside: Record<string, string[]> = {
      hours: ['hours-form'],
      court: ['no-children'],
      meet: ['same-age', 'communities'],
      'star-music': ['tag-choir_singing'],
      most: ['least'].slice(0, 0),
    };
    for (const chip of chips) {
      const after = chip.remove(full);
      expect(after, chip.id).not.toEqual(full);
      const left = buildChips(after, cat, cfg).map((c) => c.id);
      expect(left, chip.id).not.toContain(chip.id);
      const gone = new Set([chip.id, ...(inside[chip.id] ?? [])]);
      for (const other of chips) if (!gone.has(other.id)) expect(left, `${other.id} after removing ${chip.id}`).toContain(other.id);
    }
  });

  it('removing a starred family also removes its specific interests', () => {
    const star = chips.find((c) => c.id === 'star-music')!;
    const after = star.remove(full);
    expect(after.starred).toEqual([]);
    expect(after.tags).toEqual([]);
    expect(after.picked).toEqual(['books-writing']);
  });

  it('removing the first reason clears the second round, which depends on it', () => {
    const after = chips.find((c) => c.id === 'most')!.remove(full);
    expect(after.motives?.m1).toBeUndefined();
    expect(after.motives?.m2).toBeUndefined();
  });

  it('points every chip at a real screen', () => {
    for (const c of chips) expect(SCREEN_IDS).toContain(c.screen);
  });

  it('has unique ids and no dashes used as punctuation', () => {
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length);
    for (const t of text) {
      expect(t).not.toMatch(/[–—]/);
      expect(t).not.toMatch(/ - /);
      expect(t).not.toMatch(/\{\w+\}/);
      expect(t).not.toMatch(/undefined/);
    }
  });

  it('has nothing to say for someone who skipped everything', () => {
    expect(buildChips(answers(), cat, cfg)).toEqual([]);
  });

  it('works for every fixture person', () => {
    for (const [name, p] of Object.entries(PEOPLE)) {
      const c = buildChips(p, cat, cfg);
      expect(c.length, name).toBeGreaterThan(0);
      for (const chip of c) expect(chip.text.length).toBeGreaterThan(0);
    }
  });
});
