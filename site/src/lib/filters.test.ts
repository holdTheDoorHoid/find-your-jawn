import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  applyFilters,
  buildIndex,
  defaultDistrictLookup,
  emptyFilters,
  filtersFromParams,
  filtersToParams,
  isBrowsable,
  languagesInUse,
  sortGroups,
  timesMatch,
  type Filters,
} from './filters';
import { makeGroup } from './testing';

const ctx = {
  labelOf: (id: string) => ({ outdoors: 'Outdoors and adventure', hiking: 'Hiking', books: 'Books and writing' })[id] ?? id,
  district: defaultDistrictLookup(),
};

const groups = [
  makeGroup({ id: 'grotto', name: 'Example Caving Club', summary: 'Trips to caves.', interests: ['caving'], categories: ['outdoors'] }),
  makeGroup({
    id: 'tree-tenders',
    name: 'The Example Street Tree Tenders',
    summary: 'Neighbors who care for street trees.',
    categories: ['civic'],
    interests: ['trees'],
    kind: 'civic',
    schedule: { days: ['sat'], times: ['daytime'] },
    requirements: { kids_ok: true },
    first_step: { newcomer_friendliness: 5 },
    locations: [{ planning_district: 'Lower Northeast', neighborhood: 'mayfair' }],
    cost: { level: 'free' },
    last_sign_of_life: '2026-10',
  }),
  makeGroup({
    id: 'book-circle',
    name: 'Example Book Circle',
    summary: 'Talk about books over coffee.',
    categories: ['books'],
    interests: ['books'],
    schedule: { days: ['tue', 'thu'], times: ['evening'] },
    cost: { level: 'low' },
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    online_ok: true,
    first_step: { newcomer_friendliness: 3 },
    last_sign_of_life: '2025-12',
    locations: [{ planning_district: 'central' }],
  }),
  makeGroup({
    id: 'penn-chess',
    name: 'Penn Chess Club',
    summary: 'Chess for Penn students.',
    kind: 'student_org',
    audience: { open_to: 'students', school: 'penn' },
    cost: { level: 'free' },
    categories: ['games'],
    interests: ['chess'],
  }),
  makeGroup({
    id: 'grace-church',
    name: 'Grace Church Food Pantry',
    summary: 'A food pantry run by a congregation.',
    kind: 'congregation',
    audience: { faith: 'catholic' },
    categories: ['helping'],
    interests: ['food'],
    cost: { level: 'free' },
    requirements: { court_ordered_ok: 'yes', service_hours_letter: 'yes' },
  }),
  makeGroup({
    id: 'grief-circle',
    name: 'Example Grief Circle',
    summary: 'A support group for people who lost someone.',
    kind: 'support_group',
    audience: { support_group: true },
    categories: ['support'],
  }),
  makeGroup({ id: 'paid-class', name: 'Example Pottery Studio', cost: { level: 'paid' }, categories: ['arts'], interests: ['pottery'], locations: [] }),
];

const index = buildIndex(groups, ctx);
const ids = (f: Partial<Filters>) => applyFilters(index, { ...emptyFilters(), ...f }).map((e) => e.g.id).sort();

describe('browse index', () => {
  it('never includes support groups', () => {
    expect(index.some((e) => e.g.id === 'grief-circle')).toBe(false);
    expect(isBrowsable(groups[5]!)).toBe(false);
    expect(ids({ q: 'grief' })).toEqual([]);
  });

  it('shows everything else when no filter is on', () => {
    expect(ids({})).toHaveLength(6);
  });
});

describe('search', () => {
  it('matches name, summary and interests, ignoring case and accents', () => {
    expect(ids({ q: 'CAVING' })).toEqual(['grotto']);
    expect(ids({ q: 'street trees' })).toEqual(['tree-tenders']);
    expect(ids({ q: 'coffee' })).toEqual(['book-circle']);
    expect(ids({ q: 'books and writing' })).toEqual(['book-circle']);
  });

  it('matches vocabulary labels and neighborhoods', () => {
    expect(ids({ q: 'outdoors and adventure' })).toContain('grotto');
    expect(ids({ q: 'mayfair' })).toEqual(['tree-tenders']);
  });

  it('needs every word to match', () => {
    expect(ids({ q: 'caving coffee' })).toEqual([]);
  });

  it('ranks name matches first for the best match sort', () => {
    const two = buildIndex(
      [makeGroup({ id: 'alpha', name: 'Alpha Club', summary: 'Weekend garden work.' }), makeGroup({ id: 'zed', name: 'Zed Garden' })],
      ctx,
    );
    const list = applyFilters(two, { ...emptyFilters(), q: 'garden' });
    expect(sortGroups(list, 'az', 'garden').map((e) => e.g.id)).toEqual(['alpha', 'zed']);
    expect(sortGroups(list, 'best', 'garden').map((e) => e.g.id)).toEqual(['zed', 'alpha']);
  });
});

describe('filters', () => {
  it('filters by interest family and kind', () => {
    expect(ids({ families: ['books'] })).toEqual(['book-circle']);
    expect(ids({ families: ['books', 'civic'] })).toEqual(['book-circle', 'tree-tenders']);
    expect(ids({ kinds: ['congregation'] })).toEqual(['grace-church']);
  });

  it('filters by cost, treating unknown cost as not matching', () => {
    expect(ids({ costs: ['low'] })).toEqual(['book-circle']);
    expect(ids({ costs: ['paid'] })).toEqual(['paid-class']);
    expect(ids({ costs: ['free', 'low'] })).not.toContain('paid-class');
  });

  it('filters by planning district and region', () => {
    expect(ids({ district: 'lower-northeast' })).toEqual(['tree-tenders']);
    expect(ids({ region: 'northeast' })).toEqual(['tree-tenders']);
    expect(ids({ region: 'center-city' })).toEqual(['book-circle']);
  });

  it('filters by days and by time of day', () => {
    expect(ids({ days: ['tue'] })).toEqual(['book-circle']);
    expect(ids({ times: ['evening'] })).toEqual(['book-circle']);
    expect(ids({ days: ['sat'], times: ['morning'] })).toEqual(expect.arrayContaining(['grotto', 'tree-tenders']));
  });

  it('treats daytime as morning or afternoon', () => {
    expect(timesMatch(['daytime'], ['morning'])).toBe(true);
    expect(timesMatch(['afternoon'], ['daytime'])).toBe(true);
    expect(timesMatch(['evening'], ['morning'])).toBe(false);
    expect(timesMatch([], ['evening'])).toBe(false);
    expect(timesMatch([], [])).toBe(true);
  });

  it('newcomers welcome means a rating of 4 or 5', () => {
    expect(ids({ newcomers: true })).toEqual(['tree-tenders']);
  });

  it('kids, wheelchair, online and open to the public', () => {
    expect(ids({ kids: true })).toEqual(['tree-tenders']);
    expect(ids({ wheelchair: true })).toEqual(['book-circle']);
    expect(ids({ online: true })).toEqual(['book-circle']);
    expect(ids({ open: true })).not.toContain('penn-chess');
    expect(ids({})).toContain('penn-chess');
  });

  it('only counts wheelchair access that was confirmed', () => {
    const unknown = buildIndex([makeGroup({ id: 'x', access: { wheelchair: 'partial' } })], ctx);
    expect(applyFilters(unknown, { ...emptyFilters(), wheelchair: true })).toHaveLength(0);
  });

  it('filters by language using the base code', () => {
    expect(ids({ language: 'es' })).toEqual(['book-circle']);
    const mx = buildIndex([makeGroup({ id: 'mx', access: { languages: ['es-MX'] } })], ctx);
    expect(applyFilters(mx, { ...emptyFilters(), language: 'es' })).toHaveLength(1);
  });

  it('includes, excludes or isolates faith groups', () => {
    expect(ids({ faith: 'include' })).toContain('grace-church');
    expect(ids({ faith: 'exclude' })).not.toContain('grace-church');
    expect(ids({ faith: 'only' })).toEqual(['grace-church']);
  });

  it('court ordered and service hour filters need a clear yes', () => {
    expect(ids({ court: true })).toEqual(['grace-church']);
    expect(ids({ hours: true })).toEqual(['grace-church']);
  });

  it('combines filters with and', () => {
    expect(ids({ costs: ['free'], kids: true, newcomers: true })).toEqual(['tree-tenders']);
    expect(ids({ costs: ['paid'], kids: true })).toEqual([]);
  });
});

describe('sorting', () => {
  it('sorts A to Z ignoring a leading The', () => {
    const names = sortGroups(applyFilters(index, emptyFilters()), 'az').map((e) => e.g.name);
    expect(names.indexOf('The Example Street Tree Tenders')).toBeGreaterThan(names.indexOf('Example Pottery Studio'));
    expect(names.indexOf('The Example Street Tree Tenders')).toBeLessThan(names.indexOf('Grace Church Food Pantry'));
  });

  it('sorts recently active first', () => {
    const first = sortGroups(applyFilters(index, emptyFilters()), 'recent')[0];
    expect(first?.g.id).toBe('tree-tenders');
  });
});

describe('URL state', () => {
  it('round trips a busy filter set', () => {
    const f: Filters = {
      ...emptyFilters(),
      q: 'garden club',
      families: ['civic', 'books'],
      costs: ['free'],
      days: ['sat', 'sun'],
      newcomers: true,
      language: 'es',
      faith: 'exclude',
      district: 'river-wards',
    };
    const params = filtersToParams(f, 'recent');
    const back = filtersFromParams(new URLSearchParams(params.toString()));
    expect(back.sort).toBe('recent');
    expect(back.filters).toEqual({ ...f, families: ['books', 'civic'] });
  });

  it('leaves defaults out of the address', () => {
    expect(filtersToParams(emptyFilters(), null).toString()).toBe('');
    expect(filtersToParams({ ...emptyFilters(), faith: 'include' }, null).has('faith')).toBe(false);
  });

  it('ignores junk values', () => {
    const { filters, sort } = filtersFromParams(new URLSearchParams('cost=free,fancy&day=sat,someday&faith=weird&sort=magic&kids=yes'));
    expect(filters.costs).toEqual(['free']);
    expect(filters.days).toEqual(['sat']);
    expect(filters.faith).toBe('include');
    expect(filters.kids).toBe(false);
    expect(sort).toBeNull();
  });

  it('counts active filters without counting the search box', () => {
    expect(activeFilterCount({ ...emptyFilters(), q: 'tree' })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters(), kids: true, costs: ['free', 'low'], district: 'central' })).toBe(4);
  });
});

describe('languagesInUse', () => {
  it('puts English first, then by how common', () => {
    const list = [
      makeGroup({ id: 'a', access: { languages: ['es', 'en'] } }),
      makeGroup({ id: 'b', access: { languages: ['es'] } }),
      makeGroup({ id: 'c', access: { languages: ['zh-Hans', 'en'] } }),
    ];
    expect(languagesInUse(list)).toEqual(['en', 'es', 'zh']);
  });
});
