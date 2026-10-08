import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../engine/catalog';
import { realRawVocab } from '../engine/testing';
import { makeQuizConfig, QUIZ_LANGUAGES } from './quiz-config';

// The quiz configuration is built from the real vocabulary files, so these tests catch a scene that
// points at an interest that was renamed, or a vocabulary file whose layout changed.

const config = makeQuizConfig(realRawVocab(), '2026-10-08');
const catalog = buildCatalog(config);

describe('the quiz configuration', () => {
  it('has the twelve Saturday scenes, eight extras and ten moments', () => {
    expect(config.scenes).toHaveLength(12);
    expect(config.extraScenes).toHaveLength(8);
    expect(config.moments).toHaveLength(10);
  });

  it('has the ten future selves, six motives, six roles and the formats', () => {
    expect(config.futureSelves).toHaveLength(10);
    expect(config.motives.map((m) => m.id)).toEqual(['values', 'understanding', 'social', 'career', 'protective', 'enhancement']);
    expect(config.roles).toHaveLength(6);
    expect(config.formats.length).toBeGreaterThanOrEqual(8);
    expect(config.ways.map((w) => w.id)).toEqual(['do_it', 'learn_it', 'teach_it', 'serve_it', 'lead_it']);
  });

  it('points every scene, moment and future self at interests that exist', () => {
    for (const s of [...config.scenes, ...config.extraScenes, ...config.moments]) {
      for (const tag of Object.keys(s.interests)) expect(catalog.tagFamily.has(tag), `${s.id}: ${tag}`).toBe(true);
      for (const r of s.roles) expect(catalog.roleLabel.has(r), `${s.id}: ${r}`).toBe(true);
      for (const f of s.formats) expect(catalog.formatLabel.has(f), `${s.id}: ${f}`).toBe(true);
      expect(s.icon).not.toBe('');
    }
    for (const f of config.futureSelves) {
      for (const tag of Object.keys(f.interests)) expect(catalog.tagFamily.has(tag), `${f.id}: ${tag}`).toBe(true);
      for (const w of f.ways) expect(catalog.wayLabel.has(w), `${f.id}: ${w}`).toBe(true);
      expect(f.because).not.toBe('');
    }
  });

  it('has the interest graph with typed edges that all point at real interests', () => {
    expect(config.edges.length).toBeGreaterThan(500);
    for (const [a, b] of config.edges) {
      expect(catalog.tagFamily.has(a), a).toBe(true);
      expect(catalog.tagFamily.has(b), b).toBe(true);
    }
    expect(catalog.neighbors.get('hiking')?.some((n) => n.tag === 'trail_building' && n.type === 'same_place')).toBe(true);
  });

  it('marks the support family so the quiz never shows it', () => {
    expect(catalog.supportFamilies.has('support-recovery')).toBe(true);
    expect(config.families.filter((f) => !f.supportOnly)).toHaveLength(28);
  });

  it('lists the ways in for every family that has them', () => {
    expect(config.waysByFamily['books-writing']?.teach_it?.example).toMatch(/Tutor/);
    expect(catalog.tagWays.get('literacy_tutoring')?.has('teach_it')).toBe(true);
  });

  it('has all 159 neighborhoods with their planning districts, and the languages the quiz offers', () => {
    expect(config.neighborhoods).toHaveLength(159);
    expect(config.neighborhoods.every((n) => n.district !== '')).toBe(true);
    expect(config.languages.map((l) => l.code)).toEqual(QUIZ_LANGUAGES);
    expect(config.faith.length).toBeGreaterThan(8);
    expect(config.communities.length).toBeGreaterThan(10);
  });

  it('stays small enough to download quickly', () => {
    expect(JSON.stringify(config).length).toBeLessThan(120_000);
  });

  it('survives a vocabulary with nothing in it', () => {
    const empty = makeQuizConfig({}, 'x');
    expect(empty.scenes).toEqual([]);
    expect(empty.families).toEqual([]);
    expect(() => buildCatalog(empty)).not.toThrow();
  });
});
