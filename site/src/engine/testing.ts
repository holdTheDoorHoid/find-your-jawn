// Helpers for engine tests only. Nothing in the site imports this file.
//
// The catalog is built from the REAL vocabulary files in data/vocab/, so a test fails when a scene
// points at an interest that was renamed.

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { makeQuizConfig } from '../lib/quiz-config';
import { buildCatalog, type Catalog } from './catalog';
import { emptyAnswers, type Answers } from './types';

/** A fixed "today" so recency never changes a test. */
export const NOW = new Date('2026-10-08T12:00:00Z');

const VOCAB_DIR = path.resolve(process.cwd(), '../data/vocab');

let raw: Record<string, unknown> | null = null;

/** Every vocabulary file merged and keyed by name, like the site's vocab.json. */
export function realRawVocab(): Record<string, unknown> {
  if (raw) return raw;
  raw = {};
  for (const f of fs.readdirSync(VOCAB_DIR)) {
    if (!f.endsWith('.yaml')) continue;
    raw[f.replace(/\.yaml$/, '')] = parseYaml(fs.readFileSync(path.join(VOCAB_DIR, f), 'utf8'));
  }
  return raw;
}

let catalog: Catalog | null = null;

export function realCatalog(): Catalog {
  if (!catalog) catalog = buildCatalog(makeQuizConfig(realRawVocab(), '2026-10-08'));
  return catalog;
}

/** Answers with a few overrides. */
export function answers(over: Partial<Answers> = {}): Answers {
  return { ...emptyAnswers(), ...over };
}

// ---------------------------------------------------------------- the fixture people (DESIGN section 12)

export const PEOPLE: Record<string, Answers> = {
  /** A 15 year old who needs 40 service hours signed. */
  teen: answers({
    paths: ['hours'],
    hours: { need: 40, form: true },
    age: { lo: 15, hi: 15 },
    scenes: ['scene_fix_bikes', 'scene_shelter_dogs'],
    budget: { value: 'free', locked: true },
    place: { hood: 'cobbs_creek' },
    far: { mode: 'septa', minutes: 40, locked: false },
    when: { days: ['sat', 'sun'], times: [], flexible: false, locked: false },
  }),

  /** A retiree, new to Philly, who likes books and gardens. */
  retiree: answers({
    paths: ['newcomer'],
    newSince: 'months',
    age: { lo: 65, hi: 65 },
    scenes: ['scene_book_coffee', 'scene_garden'],
    moments: ['moment_long_talk'],
    picked: ['books-writing', 'gardening-greening'],
    starred: ['books-writing'],
    motives: { m1: 'social', l1: 'career', m2: 'protective', l2: 'enhancement' },
    place: { hood: 'mount_airy_east' },
    far: { mode: 'septa', minutes: 30, locked: false },
    strangers: 3,
  }),

  /** A night shift nurse: free time changes every week, so no schedule. */
  nurse: answers({
    scenes: ['scene_pottery', 'scene_book_coffee'],
    moments: ['moment_make'],
    when: { days: [], times: [], flexible: true, locked: false },
    often: { value: 'monthly', locked: true },
    place: { hood: 'fishtown' },
    far: { mode: 'septa', minutes: 30, locked: true },
    budget: { value: 'low', locked: false },
    motives: { m1: 'protective', l1: 'career' },
  }),

  /** Someone who uses a wheelchair and cannot go where access is a "no". */
  wheelchair: answers({
    scenes: ['scene_play', 'scene_book_coffee'],
    wheelchair: { value: true, locked: true },
    place: { hood: 'spruce_hill' },
    far: { mode: 'drive', minutes: 30, locked: false },
  }),

  /** A grad student who knows nobody, and walking into a room of strangers is hard. */
  grad: answers({
    paths: ['student', 'newcomer'],
    school: 'penn',
    newSince: 'weeks',
    age: { lo: 25, hi: 34 },
    scenes: ['scene_game_night', 'scene_pickup_soccer', 'scene_book_coffee'],
    strangers: 4,
    bringSomeone: false,
    meet: { with: 'mix', communities: [] },
    place: { hood: 'spruce_hill' },
    far: { mode: 'walk', minutes: 30, locked: false },
    motives: { m1: 'social', l1: 'career' },
  }),

  /** A parent of two toddlers. */
  parent: answers({
    paths: ['kids'],
    kidsAges: [2, 4],
    age: { lo: 35, hi: 54 },
    scenes: ['scene_garden', 'scene_book_coffee'],
    when: { days: ['tue', 'thu', 'sat'], times: ['morning'], flexible: false, locked: false },
    place: { hood: 'spruce_hill' },
    far: { mode: 'walk', minutes: 25, locked: true },
    budget: { value: 'free', locked: false },
  }),

  /** Someone with court ordered hours who cannot work with children. */
  court: answers({
    paths: ['court'],
    court: { need: 80, noChildren: true },
    age: { lo: 25, hi: 34 },
    place: { hood: 'fishtown' },
    far: { mode: 'septa', minutes: 45, locked: false },
  }),

  /** A shy introvert who wants small groups and may bring a friend. */
  shy: answers({
    age: { lo: 25, hi: 34 },
    scenes: ['scene_book_coffee', 'scene_pottery', 'scene_garden'],
    strangers: 5,
    bringSomeone: true,
    size: 'small',
    place: { hood: 'fishtown' },
    far: { mode: 'septa', minutes: 30, locked: false },
    motives: { m1: 'protective', l1: 'career' },
  }),

  /** An extrovert who loves team sports. */
  extrovert: answers({
    age: { lo: 25, hi: 34 },
    scenes: ['scene_pickup_soccer', 'scene_coach_basketball', 'scene_rowing'],
    picked: ['sports-teams', 'water-rowing'],
    starred: ['sports-teams'],
    strangers: 1,
    meet: { with: 'mix', communities: [] },
    place: { hood: 'rittenhouse' },
    far: { mode: 'septa', minutes: 40, locked: false },
    motives: { m1: 'social', l1: 'career' },
    newness: 5,
  }),

  /** Speaks Spanish, some English. */
  spanish: answers({
    age: { lo: 35, hi: 54 },
    scenes: ['scene_pantry', 'scene_congregation_meal'],
    languages: { codes: ['es', 'en'], locked: false },
    faith: { mode: 'include' },
    place: { hood: 'olney' },
    far: { mode: 'septa', minutes: 40, locked: false },
    motives: { m1: 'values', l1: 'career' },
  }),
};

/** Someone who skipped everything. */
export function skipper(): Answers {
  return emptyAnswers();
}
