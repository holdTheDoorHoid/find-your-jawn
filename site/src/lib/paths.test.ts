import { describe, expect, it } from 'vitest';
import { courtOrdered, families, isNeighborGroup, newToPhilly, PATH_CAP, serviceHours } from './paths';
import { makeGroup } from './testing';

describe('court ordered path', () => {
  it('lists only groups with a yes, never unknown or no', () => {
    const list = [
      makeGroup({ id: 'yes-one', name: 'Yes One', requirements: { court_ordered_ok: 'yes' } }),
      makeGroup({ id: 'unknown-one', name: 'Unknown One', requirements: { court_ordered_ok: 'unknown' } }),
      makeGroup({ id: 'no-one', name: 'No One', requirements: { court_ordered_ok: 'no' } }),
      makeGroup({ id: 'plain', name: 'Plain' }),
    ];
    expect(courtOrdered(list).items.map((g) => g.id)).toEqual(['yes-one']);
  });

  it('leaves out support groups and groups closed to the public', () => {
    const list = [
      makeGroup({ id: 's', requirements: { court_ordered_ok: 'yes' }, audience: { support_group: true } }),
      makeGroup({ id: 'm', requirements: { court_ordered_ok: 'yes' }, audience: { open_to: 'members' } }),
      makeGroup({ id: 'ok', requirements: { court_ordered_ok: 'yes' } }),
    ];
    expect(courtOrdered(list).items.map((g) => g.id)).toEqual(['ok']);
  });

  it('is empty when nothing qualifies', () => {
    expect(courtOrdered([makeGroup()]).items).toEqual([]);
    expect(courtOrdered([makeGroup()]).total).toBe(0);
  });
});

describe('service hours path', () => {
  const list = [
    makeGroup({ id: 'signs-adult', name: 'Signs Adult', requirements: { service_hours_letter: 'yes' }, audience: { min_age: 18 } }),
    makeGroup({ id: 'signs-teen', name: 'Signs Teen', requirements: { service_hours_letter: 'yes' }, audience: { min_age: 14 } }),
    makeGroup({ id: 'teen-ok', name: 'Teen Ok', audience: { min_age: 16 } }),
    makeGroup({ id: 'teen-no', name: 'Teen No', audience: { min_age: 16 }, requirements: { service_hours_letter: 'no' } }),
    makeGroup({ id: 'adults', name: 'Adults', audience: { min_age: 21 } }),
    makeGroup({ id: 'no-min', name: 'No Min' }),
    makeGroup({ id: 'little-kids', name: 'Little Kids', audience: { min_age: 4, max_age: 9 } }),
  ];

  it('puts groups that sign forms first, teen friendly ones before adult only', () => {
    const { forms } = serviceHours(list);
    expect(forms.items.map((g) => g.id)).toEqual(['signs-teen', 'signs-adult']);
  });

  it('lists teen friendly groups that have not said they sign, and skips ones that said no', () => {
    const { teens } = serviceHours(list);
    expect(teens.items.map((g) => g.id)).toEqual(['teen-ok']);
  });
});

describe('families path', () => {
  it('needs kids_ok and a minimum age young kids can meet', () => {
    const list = [
      makeGroup({ id: 'ok', requirements: { kids_ok: true } }),
      makeGroup({ id: 'old', requirements: { kids_ok: true }, audience: { min_age: 18 } }),
      makeGroup({ id: 'no', requirements: { kids_ok: false } }),
    ];
    expect(families(list).items.map((g) => g.id)).toEqual(['ok']);
  });
});

describe('new to Philly path', () => {
  it('lists welcoming groups, then civic, library and walking groups once', () => {
    const list = [
      makeGroup({ id: 'warm', name: 'Warm', first_step: { newcomer_friendliness: 5 } }),
      makeGroup({ id: 'civic', name: 'Civic Assoc', kind: 'civic' }),
      makeGroup({ id: 'lib', name: 'Free Library Knitting', kind: 'program' }),
      makeGroup({ id: 'walk', name: 'Walkers', interests: ['walking-tours'] }),
      makeGroup({ id: 'warm-civic', name: 'Warm Civic', kind: 'civic', first_step: { newcomer_friendliness: 4 } }),
      makeGroup({ id: 'other', name: 'Other', interests: ['pottery'] }),
    ];
    const { welcoming, neighbors } = newToPhilly(list);
    expect(welcoming.items.map((g) => g.id)).toEqual(['warm', 'warm-civic']);
    expect(neighbors.items.map((g) => g.id)).toEqual(['civic', 'lib', 'walk']);
  });

  it('caps long lists and reports the full count', () => {
    const many = Array.from({ length: PATH_CAP + 10 }, (_, i) => makeGroup({ id: `g-${i}`, name: `Group ${String(i).padStart(3, '0')}`, kind: 'civic' }));
    const { neighbors } = newToPhilly(many);
    expect(neighbors.items).toHaveLength(PATH_CAP);
    expect(neighbors.total).toBe(PATH_CAP + 10);
  });

  it('recognizes neighbor groups by kind, name and interest', () => {
    expect(isNeighborGroup(makeGroup({ kind: 'friends_group' }))).toBe(true);
    expect(isNeighborGroup(makeGroup({ name: 'Kensington Library Chess' }))).toBe(true);
    expect(isNeighborGroup(makeGroup({ categories: ['civic-life'] }))).toBe(true);
    expect(isNeighborGroup(makeGroup({ interests: ['pottery'], categories: ['arts'] }))).toBe(false);
  });
});
