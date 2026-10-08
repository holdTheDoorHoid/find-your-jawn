import { describe, expect, it } from 'vitest';
import {
  exportSaved,
  isSaved,
  mergeSaved,
  parseImport,
  readSaved,
  removeSaved,
  toggleSaved,
} from './saved';
import { createStore, type Backend } from './storage';

function memoryStore() {
  const data = new Map<string, string>();
  const b: Backend = {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  return createStore(() => b);
}

const NOW = new Date('2026-10-08T15:00:00Z');

describe('saved list', () => {
  it('toggles a group on and off', () => {
    const s = memoryStore();
    expect(toggleSaved(s, 'philadelphia-grotto', NOW)).toBe(true);
    expect(isSaved(s, 'philadelphia-grotto')).toBe(true);
    expect(readSaved(s)).toEqual([{ id: 'philadelphia-grotto', at: '2026-10-08' }]);
    expect(toggleSaved(s, 'philadelphia-grotto', NOW)).toBe(false);
    expect(readSaved(s)).toEqual([]);
  });

  it('refuses ids that are not group slugs', () => {
    const s = memoryStore();
    expect(toggleSaved(s, '<script>', NOW)).toBe(false);
    expect(toggleSaved(s, '', NOW)).toBe(false);
    expect(readSaved(s)).toEqual([]);
  });

  it('removes one group', () => {
    const s = memoryStore();
    toggleSaved(s, 'a-group', NOW);
    toggleSaved(s, 'b-group', NOW);
    removeSaved(s, 'a-group');
    expect(readSaved(s).map((x) => x.id)).toEqual(['b-group']);
  });

  it('ignores a damaged value in storage', () => {
    const s = memoryStore();
    s.set('saved', '{"v":1,"items":[{"id":"ok-one"},{"id":42},"also-ok",null,{"id":"ok-one"}]}');
    expect(readSaved(s).map((x) => x.id)).toEqual(['ok-one', 'also-ok']);
    s.set('saved', 'garbage');
    expect(readSaved(s)).toEqual([]);
  });

  it('exports and imports a round trip', () => {
    const items = [
      { id: 'one', at: '2026-10-01' },
      { id: 'two', at: '' },
    ];
    const back = parseImport(exportSaved(items));
    expect(back?.items).toEqual(items);
    expect(back?.rejected).toBe(0);
  });

  it('imports a bare list of ids and counts bad entries', () => {
    const r = parseImport('["good-one", "BAD ID", 7, "good-two", "good-one"]');
    expect(r?.items.map((x) => x.id)).toEqual(['good-one', 'good-two']);
    expect(r?.rejected).toBe(2);
  });

  it('rejects files that are not lists', () => {
    expect(parseImport('not json')).toBeNull();
    expect(parseImport('{"hello": 1}')).toBeNull();
    expect(parseImport('42')).toBeNull();
  });

  it('merges without duplicates and keeps existing entries first', () => {
    const merged = mergeSaved([{ id: 'a', at: 'x' }], [{ id: 'a', at: 'y' }, { id: 'b', at: '' }]);
    expect(merged).toEqual([
      { id: 'a', at: 'x' },
      { id: 'b', at: '' },
    ]);
  });
});
