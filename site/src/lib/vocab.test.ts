import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeManifest } from './manifest';
import { communityLabel } from './group-view';
import { browsableFamilies, districtFor, normalizeVocab } from './vocab';
import { summarize } from './coverage';
import { makeGroup } from './testing';

// The fixture vocab.json is laid out like the real data/vocab/ files, so these tests read it.
const vocabRaw = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/data/vocab.json'), 'utf8'));
const manifestRaw = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/data/manifest.json'), 'utf8'));
const vocab = normalizeVocab(vocabRaw);

describe('vocabulary in the real layout', () => {
  it('reads interest families with icons, examples and tags', () => {
    const f = vocab.familyById.get('outdoors-adventure');
    expect(f?.label).toBe('Outdoors and adventure');
    expect(f?.icon).toBe('🥾');
    expect(f?.blurb).toMatch(/caving/);
    expect(vocab.tagLabels.get('caving')).toBe('Caving');
  });

  it('keeps support and recovery out of the browsable families', () => {
    expect(vocab.familyById.get('support-recovery')?.supportOnly).toBe(true);
    expect(browsableFamilies(vocab).some((f) => f.id === 'support-recovery')).toBe(false);
    expect(browsableFamilies(vocab).length).toBe(vocab.families.length - 1);
  });

  it('reads planning districts with their regions and labels', () => {
    const d = districtFor(vocab, 'north_delaware');
    expect(d).toMatchObject({ id: 'north-delaware', label: 'North Delaware', region: 'northeast', regionLabel: 'Northeast' });
    expect(districtFor(vocab, 'center_city_x').region).toBe('other');
    // River Wards sits in North in the real file
    expect(districtFor(vocab, 'river_wards').region).toBe('north');
    expect(districtFor(vocab, 'River Wards').id).toBe('river-wards');
  });

  it('reads the sectioned audiences file', () => {
    expect(vocab.labels.crowd?.get('families')).toBe('Families with children');
    expect(vocab.labels.community?.get('lgbtq')).toBe('LGBTQ+');
    expect(vocab.labels.faith?.get('interfaith')).toBe('Interfaith');
    expect(vocab.labels.languages?.get('es')).toBe('Spanish');
    expect(vocab.labels.kinds?.get('civic')).toBe('Neighborhood or civic group');
    expect(vocab.labels.neighborhoods?.get('mayfair')).toBe('Mayfair');
  });

  it('does not throw on empty or odd input', () => {
    expect(normalizeVocab(null).families).toEqual([]);
    expect(normalizeVocab({ interests: 'nope', audiences: 5, neighborhoods: [1, 2] }).districts).toEqual([]);
  });

  it('labels community values, including heritage and language prefixes', () => {
    const lookup = (section: string, id: string) => vocab.labels[section]?.get(id);
    expect(communityLabel('lgbtq', lookup)).toBe('LGBTQ+');
    expect(communityLabel('heritage:irish', lookup)).toBe('Irish heritage');
    expect(communityLabel('heritage:west_african')).toBe('West african heritage');
    expect(communityLabel('language:es', lookup)).toBe('Spanish speakers');
    expect(communityLabel('veterans')).toBe('Veterans');
  });
});

describe('manifest in the pipeline layout', () => {
  const m = normalizeManifest(manifestRaw);
  it('reads the counts fyj build writes', () => {
    expect(m.fixture).toBe(true);
    expect(m.total).toBe(32);
    expect(m.tier0Unchecked).toBe(4212);
    expect(m.byCategory['outdoors-adventure']).toBeGreaterThan(0);
    expect(m.byDistrict['north_delaware']).toBeGreaterThan(0);
    expect(m.byTier['2']).toBeGreaterThan(0);
    expect(m.coverage.length).toBeGreaterThan(0);
  });
  it('copes with a missing coverage section and odd values', () => {
    const empty = normalizeManifest({ built: '2026-10-08', published: 3, coverage: null, by_category: { a: 'x' } });
    expect(empty.coverage).toEqual([]);
    expect(empty.byCategory).toEqual({});
    expect(normalizeManifest(null).tier0Unchecked).toBeUndefined();
  });
  it('reads coverage given as a plain slice map', () => {
    const c = normalizeManifest({ coverage: { 'sports, south': { found: 5, estimate: 9 } } }).coverage;
    expect(c).toEqual([{ slice: 'sports, south', found: 5, estimate: 9, low: undefined, high: undefined, note: undefined }]);
  });
});

describe('coverage summary', () => {
  it('counts from groups when the manifest has no counts, and skips support groups', () => {
    const groups = [
      makeGroup({ id: 'a', categories: ['outdoors-adventure'], locations: [{ planning_district: 'river_wards' }] }),
      makeGroup({ id: 'b', categories: ['outdoors-adventure', 'music'], locations: [] }),
      makeGroup({ id: 'c', categories: ['support-recovery'], audience: { support_group: true } }),
    ];
    const s = summarize(groups, normalizeManifest({ tier0_unchecked: 10 }), vocab);
    expect(s.total).toBe(2);
    expect(s.fromManifest).toBe(false);
    expect(s.byCategory.find((r) => r.id === 'outdoors-adventure')?.count).toBe(2);
    expect(s.byRegion.find((r) => r.id === 'north')?.count).toBe(1);
    expect(s.noPlace).toBe(1);
    expect(s.tier0Unchecked).toBe(10);
  });

  it('uses manifest counts when it has them', () => {
    const s = summarize([makeGroup()], normalizeManifest(manifestRaw), vocab);
    expect(s.fromManifest).toBe(true);
    expect(s.byCategory.length).toBeGreaterThan(5);
  });
});
