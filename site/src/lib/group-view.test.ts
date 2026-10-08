import { describe, expect, it } from 'vitest';
import { ageLine, freshnessNote, hasFirstVisitGuide, metaDescription, sourcesFor, tierSentence } from './group-view';
import { makeGroup } from './testing';

describe('first visit block', () => {
  it('needs tier 2 or better and something to say', () => {
    expect(hasFirstVisitGuide(makeGroup({ research_tier: 1, first_step: { how: 'Come by' } }))).toBe(false);
    expect(hasFirstVisitGuide(makeGroup({ research_tier: 2 }))).toBe(false);
    expect(hasFirstVisitGuide(makeGroup({ research_tier: 2, first_step: { what_to_expect: 'A chat.' } }))).toBe(true);
    expect(hasFirstVisitGuide(makeGroup({ research_tier: 3, first_step: { newcomer_friendliness: 4 } }))).toBe(true);
  });
});

describe('contact sources', () => {
  const g = makeGroup({
    sources: [
      { url: 'https://example.org/a', seen: '2026-10-05', fields: ['name', 'contacts.website'] },
      { url: 'https://example.org/b', seen: '2026-10-06', fields: ['contacts'] },
      { url: 'https://example.org/c', seen: '2026-10-07', fields: ['contacts.phone'] },
    ],
  });
  it('finds sources by exact field or by parent', () => {
    expect(sourcesFor(g, 'contacts.website').map((s) => s.url)).toEqual(['https://example.org/a', 'https://example.org/b']);
    expect(sourcesFor(g, 'contacts.phone').map((s) => s.url)).toEqual(['https://example.org/b', 'https://example.org/c']);
    expect(sourcesFor(g, 'contacts.email').map((s) => s.url)).toEqual(['https://example.org/b']);
  });
  it('finds none when nothing lists the field', () => {
    expect(sourcesFor(makeGroup(), 'contacts.email')).toEqual([]);
  });
});

describe('research tier in plain words', () => {
  it('says checked by our research team with the date for tiers 1 and 2', () => {
    expect(tierSentence(makeGroup({ research_tier: 1, last_checked: '2026-10-05' }))).toMatch(/^Checked by our research team on October 5, 2026\./);
    expect(tierSentence(makeGroup({ research_tier: 2, last_checked: '2026-10-06' }))).toMatch(/^Checked by our research team on October 6, 2026\./);
  });
  it('says the group confirmed it for tier 3', () => {
    expect(tierSentence(makeGroup({ research_tier: 3, last_checked: '2026-10-06' }))).toMatch(/Confirmed by the group itself/);
  });
  it('still reads well with no date', () => {
    expect(tierSentence(makeGroup({ research_tier: 1, last_checked: undefined }))).toBe('Checked by our research team.');
  });
});

describe('freshness note', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('is quiet for a recently active group', () => {
    expect(freshnessNote(makeGroup({ status: 'active', last_sign_of_life: '2026-09' }), now)).toBeNull();
  });
  it('warns for older signs of life and for probably active groups', () => {
    expect(freshnessNote(makeGroup({ status: 'probably_active' }), now)).toMatch(/probably still active/);
    expect(freshnessNote(makeGroup({ status: 'active', last_sign_of_life: '2025-01' }), now)).toMatch(/more than a year old/);
  });
});

describe('small helpers', () => {
  it('writes age lines', () => {
    expect(ageLine(makeGroup({ audience: { min_age: 16 } }))).toBe('Ages 16 and up');
    expect(ageLine(makeGroup({ audience: { min_age: 6, max_age: 14 } }))).toBe('Ages 6 to 14');
    expect(ageLine(makeGroup({ audience: { max_age: 5 } }))).toBe('Up to age 5');
    expect(ageLine(makeGroup())).toBeNull();
  });
  it('makes a description from the summary, clipped', () => {
    const long = makeGroup({ summary: 'word '.repeat(60) });
    expect(metaDescription(long).length).toBeLessThanOrEqual(156);
    expect(metaDescription(makeGroup({ summary: '' }))).toMatch(/in Philadelphia/);
  });
});
