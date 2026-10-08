import { describe, expect, it } from 'vitest';
import { fill, inline } from './inline';
import { groupIssueLinks, issueUrl, suggestGroupUrl } from './issues';
import { normalizeGroup } from './normalize';
import { absoluteUrl, withBase } from './site';
import { clip, compareNames, hostOf, safeHttpUrl, slugify, telHref } from './text';
import { groupBadges } from './badges';
import { makeGroup } from './testing';

describe('inline markup', () => {
  it('turns links and bold into safe HTML', () => {
    expect(inline('See [browse](/browse/) and **this**.', '/find-your-jawn/')).toBe(
      'See <a href="/find-your-jawn/browse/">browse</a> and <strong>this</strong>.',
    );
  });

  it('escapes HTML in text and drops unsafe links', () => {
    expect(inline('<b>hi</b> [x](javascript:alert(1))')).not.toContain('<b>');
    expect(inline('[x](javascript:alert(1))')).not.toContain('href');
    expect(inline('[ok](https://example.org/?a=1&b=2)')).toContain('href="https://example.org/?a=1&amp;b=2"');
  });

  it('fills placeholders', () => {
    expect(fill('Ages {n} and up', { n: 16 })).toBe('Ages 16 and up');
    expect(fill('{missing}', {})).toBe('{missing}');
  });
});

describe('issue links', () => {
  it('uses the real template file names and fills the title', () => {
    const links = groupIssueLinks('Example Street Tree Tenders', 'https://holdthedoorhoid.github.io/find-your-jawn/g/x/');
    const c = new URL(links.correct);
    expect(c.pathname).toBe('/holdTheDoorHoid/find-your-jawn/issues/new');
    expect(c.searchParams.get('template')).toBe('correct-listing.yml');
    expect(c.searchParams.get('title')).toBe('Correction: Example Street Tree Tenders');
    expect(c.searchParams.get('group')).toContain('/g/x/');
    expect(new URL(links.iRun).searchParams.get('template')).toBe('i-run-this-group.yml');
    expect(new URL(links.iRun).searchParams.get('title')).toBe('Organizer: Example Street Tree Tenders');
    expect(new URL(links.remove).searchParams.get('template')).toBe('remove-details.yml');
    expect(new URL(links.remove).searchParams.get('title')).toBe('Removal: Example Street Tree Tenders');
  });

  it('builds the suggest link', () => {
    expect(new URL(suggestGroupUrl()).searchParams.get('template')).toBe('suggest-group.yml');
    expect(issueUrl('suggest-group.yml', { name: 'X' })).toContain('name=X');
  });
});

describe('site paths', () => {
  it('adds the base', () => {
    expect(withBase('/browse/', '/find-your-jawn/')).toBe('/find-your-jawn/browse/');
    expect(withBase('browse/', '/find-your-jawn/')).toBe('/find-your-jawn/browse/');
    expect(absoluteUrl('g/x/', '/find-your-jawn/')).toBe('https://holdthedoorhoid.github.io/find-your-jawn/g/x/');
  });
});

describe('text helpers', () => {
  it('slugifies', () => {
    expect(slugify('Lower Northeast')).toBe('lower-northeast');
    expect(slugify('Café & Bar')).toBe('cafe-and-bar');
  });
  it('sorts names ignoring The and case', () => {
    expect(compareNames('The Zebra Club', 'apple club')).toBeGreaterThan(0);
    expect(compareNames('The Apple', 'Banana')).toBeLessThan(0);
  });
  it('clips at a word boundary', () => {
    expect(clip('one two three four five six', 15)).toBe('one two three…');
    expect(clip('short', 15)).toBe('short');
  });
  it('only allows web links and builds tel links', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeHttpUrl('example.org')).toBeNull();
    expect(telHref('(215) 686-4420')).toBe('tel:2156864420');
    expect(hostOf('https://www.example.org/x')).toBe('example.org');
  });
});

describe('normalizeGroup', () => {
  it('fills defaults for a record with nulls and empties removed', () => {
    const g = normalizeGroup({ id: 'x', name: 'X', summary: 's', kind: 'club' });
    expect(g.categories).toEqual([]);
    expect(g.audience.open_to).toBe('public');
    expect(g.audience.support_group).toBe(false);
    expect(g.cost.level).toBe('unknown');
    expect(g.requirements.court_ordered_ok).toBe('unknown');
    expect(g.first_step.newcomer_friendliness).toBeUndefined();
    expect(g.locations).toEqual([]);
  });

  it('treats a support_group kind as a support group even without the flag', () => {
    expect(normalizeGroup({ id: 'x', name: 'X', kind: 'support_group' }).audience.support_group).toBe(true);
  });

  it('drops out of range ratings and unknown enum values', () => {
    const g = normalizeGroup({ id: 'x', name: 'X', first_step: { newcomer_friendliness: 9 }, cost: { level: 'cheap' } });
    expect(g.first_step.newcomer_friendliness).toBeUndefined();
    expect(g.cost.level).toBe('unknown');
  });
});

describe('badges', () => {
  it('shows what a visitor needs to know first', () => {
    const g = makeGroup({
      cost: { level: 'free' },
      first_step: { newcomer_friendliness: 5 },
      requirements: { kids_ok: true, act153_clearances: true },
      access: { wheelchair: 'yes', languages: ['en', 'es'] },
      audience: { faith: 'catholic', min_age: 16 },
    });
    const text = groupBadges(g).map((b) => b.text);
    expect(text).toEqual(
      expect.arrayContaining(['Free', 'Newcomers welcome', 'Kids OK', 'Wheelchair accessible', 'Clearances needed', 'Spanish', 'Ages 16 and up', 'Faith community: Catholic']),
    );
  });

  it('does not say wheelchair accessible when unknown', () => {
    expect(groupBadges(makeGroup({ access: { wheelchair: 'unknown' } })).map((b) => b.text)).not.toContain('Wheelchair accessible');
  });

  it('labels student only groups with the school', () => {
    const g = makeGroup({ audience: { open_to: 'students', school: 'penn' } });
    expect(groupBadges(g).map((b) => b.text)).toContain('Students only: Penn');
  });
});
