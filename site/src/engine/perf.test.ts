import { describe, expect, it } from 'vitest';
import type { Group } from '../lib/types';
import { NEIGHBORHOOD_CENTERS } from './centroids';
import { pickFollowUps, pickTasteCards } from './taste';
import { computeResults } from './select';
import { testGroups } from './test-groups';
import { NOW, PEOPLE, realCatalog } from './testing';

// "Fast with 5,000 groups on a cheap phone." A guard against accidental slowdowns, with a wide margin
// so it passes on a slow machine. A phone is roughly 3 to 6 times slower than a laptop.

const cat = realCatalog();
const hoods = Object.keys(NEIGHBORHOOD_CENTERS);

/** About five thousand groups made by copying the test groups with new names, places and ratings. */
function many(n: number): Group[] {
  const base = testGroups();
  const out: Group[] = [];
  for (let i = 0; i < n; i++) {
    const g = base[i % base.length]!;
    const hood = hoods[(i * 7) % hoods.length]!;
    const c = NEIGHBORHOOD_CENTERS[hood]!;
    out.push({
      ...g,
      id: `${g.id}-${i}`,
      name: `${g.name} ${i}`,
      locations: g.locations.map((l, k) => (l.lat !== undefined ? { ...l, neighborhood: hood, lat: c[0] + (k + 1) * 0.001, lng: c[1] } : l)),
    });
  }
  return out;
}

describe('matching speed with 5,000 groups', () => {
  const groups = many(5000);

  it('scores every group quickly', () => {
    const t0 = performance.now();
    const out = computeResults(groups, cat, PEOPLE.extrovert!, { now: NOW });
    const ms = performance.now() - t0;
    console.log(`computeResults ${Math.round(ms)} ms, ${out.pool.scored.length} passed`);
    expect(out.results.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1500);
  });

  it('picks the taste test cards quickly', () => {
    const t0 = performance.now();
    const cards = pickTasteCards(groups, cat, PEOPLE.shy!, { now: NOW });
    const ms = performance.now() - t0;
    console.log(`pickTasteCards ${Math.round(ms)} ms`);
    expect(cards.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1500);
  });

  it('chooses the follow up questions quickly', () => {
    const t0 = performance.now();
    pickFollowUps(groups, cat, PEOPLE.extrovert!, { now: NOW });
    const ms = performance.now() - t0;
    console.log(`pickFollowUps ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(2500);
  });
});
