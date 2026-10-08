import { describe, expect, it } from 'vitest';
import { applyFilters, buildIndex, defaultDistrictLookup, emptyFilters, sortGroups } from './filters';
import { normalizeGroupsFile } from './normalize';

// "Fast with 5,000 groups on a cheap phone." This is a guard against accidental slowdowns, with a
// wide margin so it passes on a slow CI machine. A phone is roughly 3 to 6 times slower than a
// laptop, so the limits below are about what a phone could take.

const DISTRICTS = ['central', 'river-wards', 'lower-northeast', 'south', 'west', 'lower-north', 'upper-northwest'];
const CATS = ['outdoors-adventure', 'civic-neighborhood', 'arts-culture', 'sports-fitness', 'games-hobbies'];

function raw(i: number) {
  return {
    id: `group-${i}`,
    name: `Example ${['Quiet', 'Sunny', 'Brick', 'River'][i % 4]} ${['Walkers', 'Readers', 'Gardeners', 'Makers'][i % 4]} ${i}`,
    summary: 'A made up group that does a few friendly things in the neighborhood, for testing the browse page speed.',
    kind: 'club',
    categories: [CATS[i % CATS.length]],
    interests: ['hiking', 'walking', 'books'].slice(0, 1 + (i % 3)),
    audience: { open_to: 'public', min_age: i % 5 === 0 ? 18 : undefined },
    schedule: { text: 'Saturday mornings', days: ['sat', 'sun'].slice(0, 1 + (i % 2)), times: ['morning'] },
    locations: [{ neighborhood: 'fishtown', planning_district: DISTRICTS[i % DISTRICTS.length], in_city: true }],
    cost: { level: ['free', 'low', 'paid'][i % 3] },
    access: { wheelchair: 'unknown', languages: i % 4 === 0 ? ['en', 'es'] : ['en'] },
    requirements: { kids_ok: i % 2 === 0 },
    first_step: i % 3 === 0 ? { newcomer_friendliness: 4 } : {},
    status: 'active',
    last_sign_of_life: `2026-0${(i % 9) + 1}`,
    research_tier: 1 + (i % 2),
  };
}

describe('browse speed with 5,000 groups', () => {
  const file = { built: '2026-10-08', count: 5000, groups: Array.from({ length: 5000 }, (_, i) => raw(i)) };

  it('reads, indexes, filters and sorts quickly', () => {
    const t0 = performance.now();
    const { groups } = normalizeGroupsFile(file);
    const t1 = performance.now();
    const index = buildIndex(groups, { labelOf: (id) => id, district: defaultDistrictLookup() });
    const t2 = performance.now();
    const filtered = applyFilters(index, { ...emptyFilters(), q: 'walkers', costs: ['free', 'low'], days: ['sat'] });
    const t3 = performance.now();
    const sorted = sortGroups(filtered, 'best', 'walkers');
    const sortedAll = sortGroups(index, 'az');
    const t4 = performance.now();

    expect(groups).toHaveLength(5000);
    expect(sorted.length).toBeGreaterThan(0);
    expect(sortedAll).toHaveLength(5000);
    console.log(
      `normalize ${Math.round(t1 - t0)} ms, index ${Math.round(t2 - t1)} ms, filter ${Math.round(t3 - t2)} ms, sort ${Math.round(t4 - t3)} ms`,
    );
    expect(t1 - t0).toBeLessThan(1000);
    expect(t2 - t1).toBeLessThan(1000);
    expect(t3 - t2).toBeLessThan(150);
    expect(t4 - t3).toBeLessThan(300);
  });
});
