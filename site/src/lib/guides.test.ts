import { describe, expect, it } from 'vitest';
import {
  byDay,
  costLabel,
  formatStart,
  leadHosts,
  listSeparator,
  normalizeGuide,
  pickSource,
  placeLine,
  regionIdOf,
  regionOptions,
  showQuizzoLine,
  visibleCounts,
  type GuideEntry,
} from './guides';
import { normalizeVocab } from './vocab';

function entry(over: Partial<GuideEntry> = {}): GuideEntry {
  return {
    id: 'johnnys-tavern-tue',
    venue: "Johnny's Tavern",
    day: 'tue',
    start: '20:00',
    cost: 'unknown',
    age: 'unknown',
    sources: [{ url: 'https://examplequizzo.com/schedule', seen: '2026-10-08', fields: [] }],
    ...over,
  };
}

const vocab = normalizeVocab({
  neighborhoods: {
    planning_districts: [
      { id: 'central', label: 'Central', region: 'center_city' },
      { id: 'river_wards', label: 'River Wards', region: 'north' },
      { id: 'south', label: 'South', region: 'south' },
    ],
    regions: [
      { id: 'center_city', label: 'Center City' },
      { id: 'north', label: 'North' },
      { id: 'south', label: 'South' },
    ],
  },
});

describe('reading a guide file', () => {
  it('reads the published shape', () => {
    const g = normalizeGuide({
      guide: 'quizzo',
      title: 'Quizzo nights',
      updated: '2026-10-08',
      lead_sources: [{ name: 'Billy Penn: Philly quizzo guide (August 2026)', url: 'https://billypenn.com/x/' }],
      entries: [
        {
          id: 'a-tue',
          venue: 'A',
          day: 'tue',
          start: '19:30',
          planning_district: 'river_wards',
          cost: 'free',
          cost_text: 'Free to play',
          team_size: 'Up to 6 players',
          age: '21_plus',
          notes: 'A note.',
          sources: [{ url: 'https://a.example/events', seen: '2026-10-08', fields: ['day'] }],
          last_checked: '2026-10-08',
        },
      ],
    });
    expect(g.guide).toBe('quizzo');
    expect(g.leadSources).toEqual([{ name: 'Billy Penn: Philly quizzo guide (August 2026)', url: 'https://billypenn.com/x/' }]);
    expect(g.entries).toHaveLength(1);
    expect(g.entries[0]).toMatchObject({ venue: 'A', day: 'tue', cost: 'free', age: '21_plus', costText: 'Free to play', planningDistrict: 'river_wards' });
  });

  it('never throws and drops what it cannot use', () => {
    expect(normalizeGuide(null, 'quizzo')).toEqual({ guide: 'quizzo', title: undefined, updated: undefined, built: undefined, leadSources: [], entries: [] });
    const g = normalizeGuide({
      lead_sources: [{ name: 'Bad', url: 'javascript:alert(1)' }, { url: 'https://ok.example/page' }],
      entries: [
        { venue: 'No day' },
        { day: 'tue' },
        { venue: 'Odd day', day: 'someday' },
        { venue: 'Fine', day: 'mon', start: 'soon', cost: 'cheap', age: '18 plus', sources: [{ url: 'javascript:alert(1)' }, { url: 'https://ok.example/e' }] },
        'not an object',
      ],
    });
    expect(g.leadSources).toEqual([{ name: 'ok.example', url: 'https://ok.example/page' }]);
    expect(g.entries).toHaveLength(1);
    expect(g.entries[0]).toMatchObject({ venue: 'Fine', start: undefined, cost: 'unknown', age: 'unknown', id: 'fine-mon' });
    expect(g.entries[0]!.sources.map((s) => s.url)).toEqual(['https://ok.example/e']);
  });
});

describe('start times', () => {
  it.each([
    ['20:00', '8 pm'],
    ['19:30', '7:30 pm'],
    ['09:05', '9:05 am'],
    ['12:00', 'noon'],
    ['12:30', '12:30 pm'],
    ['00:00', 'midnight'],
    ['00:30', '12:30 am'],
  ])('%s reads as %s', (hhmm, words) => {
    expect(formatStart(hhmm)).toBe(words);
  });

  it('gives nothing for a missing or unreadable time', () => {
    expect(formatStart(undefined)).toBeUndefined();
    expect(formatStart('late')).toBeUndefined();
    expect(formatStart('25:00')).toBeUndefined();
  });
});

describe('what a card shows', () => {
  it('uses the venue words for cost when short, else Free or Paid, else nothing', () => {
    expect(costLabel(entry({ cost: 'free' }))).toEqual({ text: 'Free', tone: 'good' });
    expect(costLabel(entry({ cost: 'free', costText: 'Free to play' }))).toEqual({ text: 'Free to play', tone: 'good' });
    expect(costLabel(entry({ cost: 'paid', costText: '$5 per team' }))).toEqual({ text: '$5 per team', tone: 'note' });
    expect(costLabel(entry({ cost: 'paid' }))).toEqual({ text: 'Paid', tone: 'note' });
    expect(costLabel(entry({ cost: 'free', costText: 'x'.repeat(60) }))?.text).toBe('Free');
    expect(costLabel(entry())).toBeUndefined();
  });

  it('puts the neighborhood before the address', () => {
    expect(placeLine(entry({ neighborhood: 'Fishtown', address: '1 A St' }))).toBe('Fishtown · 1 A St');
    expect(placeLine(entry({ address: '1 A St' }))).toBe('1 A St');
    expect(placeLine(entry())).toBe('');
  });

  it('links the venue or host page, not the lead page', () => {
    const hosts = leadHosts(normalizeGuide({ lead_sources: [{ name: 'BP', url: 'https://billypenn.com/guide/' }] }));
    const e = entry({
      sources: [
        { url: 'https://www.billypenn.com/guide/', fields: [] },
        { url: 'https://venue.example/events', fields: [] },
      ],
    });
    expect(pickSource(e, hosts)?.url).toBe('https://venue.example/events');
    const onlyLead = entry({ sources: [{ url: 'https://billypenn.com/guide/', fields: [] }] });
    expect(pickSource(onlyLead, hosts)?.url).toBe('https://billypenn.com/guide/');
    expect(pickSource(entry({ sources: [] }), hosts)).toBeUndefined();
  });

  it('puts "and" before the last credit link', () => {
    const one = [0].map((i) => listSeparator(i, 1));
    const three = [0, 1, 2].map((i) => listSeparator(i, 3));
    expect(one).toEqual(['']);
    expect(three).toEqual(['', ', ', ' and ']);
  });
});

describe('grouping by night', () => {
  it('goes Monday to Sunday, leaves empty days out, and sorts by time then name', () => {
    const list = [
      entry({ id: 'a', venue: 'Zed', day: 'sun', start: '18:00' }),
      entry({ id: 'b', venue: 'The Late One', day: 'tue', start: '21:00' }),
      entry({ id: 'c', venue: 'No Time', day: 'tue', start: undefined }),
      entry({ id: 'd', venue: 'Early', day: 'tue', start: '19:00' }),
      entry({ id: 'e', venue: 'Apple', day: 'tue', start: '19:00' }),
      entry({ id: 'f', venue: 'Monday Place', day: 'mon', start: '20:00' }),
    ];
    const days = byDay(list);
    expect(days.map((d) => d.day)).toEqual(['mon', 'tue', 'sun']);
    expect(days[1]!.entries.map((e) => e.venue)).toEqual(['Apple', 'Early', 'The Late One', 'No Time']);
  });

  it('returns nothing for no entries', () => {
    expect(byDay([])).toEqual([]);
  });
});

describe('parts of the city', () => {
  it('finds the part of the city from the planning district, or says other', () => {
    expect(regionIdOf(entry({ planningDistrict: 'river_wards' }), vocab)).toBe('north');
    expect(regionIdOf(entry({ planningDistrict: 'River Wards' }), vocab)).toBe('north');
    expect(regionIdOf(entry({ planningDistrict: 'unheard_of' }), vocab)).toBe('other');
    expect(regionIdOf(entry(), vocab)).toBe('other');
  });

  it('lists the parts that have nights, in the usual order, with "area not listed" last', () => {
    const list = [
      entry({ planningDistrict: 'south' }),
      entry({ planningDistrict: 'central' }),
      entry({ planningDistrict: 'central' }),
      entry({ planningDistrict: 'river_wards' }),
      entry(),
    ];
    const options = regionOptions(list, vocab);
    expect(options.map((o) => [o.id, o.count])).toEqual([
      ['center-city', 2],
      ['north', 1],
      ['south', 1],
      ['other', 1],
    ]);
    expect(options[0]!.label).toBe('Center City');
    expect(options[3]!.label).toBe('Area not listed');
  });

  it('has no options when nothing is placed and no vocabulary is known', () => {
    expect(regionOptions([], vocab)).toEqual([]);
    expect(regionOptions([entry({ planningDistrict: 'central' })], normalizeVocab({})).map((o) => o.id)).toEqual(['other']);
  });

  it('counts what stays visible for a chosen part of the city', () => {
    const items = [
      { day: 'mon', region: 'north' },
      { day: 'mon', region: 'south' },
      { day: 'tue', region: 'north' },
    ];
    expect(visibleCounts(items, 'all')).toEqual({ total: 3, perDay: { mon: 2, tue: 1 } });
    expect(visibleCounts(items, 'north')).toEqual({ total: 2, perDay: { mon: 1, tue: 1 } });
    expect(visibleCounts(items, 'northeast')).toEqual({ total: 0, perDay: {} });
  });
});

describe('the quiz results line', () => {
  const base = { paths: [] as string[], tags: [] as string[], starred: [] as string[] };
  it('shows for people who are new to Philly, picked trivia, or starred games and puzzles', () => {
    expect(showQuizzoLine({ ...base, paths: ['newcomer'] })).toBe(true);
    expect(showQuizzoLine({ ...base, paths: ['hours', 'newcomer'] })).toBe(true);
    expect(showQuizzoLine({ ...base, tags: ['chess', 'trivia_nights'] })).toBe(true);
    expect(showQuizzoLine({ ...base, starred: ['games-puzzles'] })).toBe(true);
  });
  it('stays away for everyone else', () => {
    expect(showQuizzoLine(base)).toBe(false);
    expect(showQuizzoLine({ paths: ['hours', 'court', 'kids', 'student'], tags: ['board_games'], starred: ['music'] })).toBe(false);
  });
});
