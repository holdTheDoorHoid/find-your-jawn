import { describe, expect, it } from 'vitest';
import { createStore, PREFIX, type Backend } from './storage';

function fakeBackend(): Backend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('store with working storage', () => {
  it('prefixes every key with fyj:', () => {
    const b = fakeBackend();
    const s = createStore(() => b);
    s.set('saved', 'x');
    expect([...b.data.keys()]).toEqual([PREFIX + 'saved']);
    expect(s.get('saved')).toBe('x');
    expect(s.persistent).toBe(true);
  });

  it('reads and writes JSON, and survives bad JSON', () => {
    const b = fakeBackend();
    const s = createStore(() => b);
    expect(s.setJSON('a', { n: 1 })).toBe(true);
    expect(s.getJSON('a', null)).toEqual({ n: 1 });
    b.data.set(PREFIX + 'broken', '{not json');
    expect(s.getJSON('broken', 'fallback')).toBe('fallback');
    expect(s.getJSON('missing', 7)).toBe(7);
  });

  it('lists only our keys and clears only our keys', () => {
    const b = fakeBackend();
    b.data.set('other-site-key', 'keep me');
    const s = createStore(() => b);
    s.set('one', '1');
    s.set('two', '2');
    expect(s.keys()).toEqual(['one', 'two']);
    expect(s.clearAll()).toBe(2);
    expect(s.keys()).toEqual([]);
    expect(b.data.get('other-site-key')).toBe('keep me');
  });
});

describe('store when storage is blocked', () => {
  const throwing: Backend = {
    get length(): number {
      throw new Error('blocked');
    },
    key() {
      throw new Error('blocked');
    },
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };

  it('keeps values in memory and reports that it is not persistent', () => {
    const s = createStore(() => throwing);
    expect(s.set('a', '1')).toBe(false);
    expect(s.get('a')).toBe('1');
    expect(s.persistent).toBe(false);
    expect(s.keys()).toEqual(['a']);
    s.remove('a');
    expect(s.get('a')).toBeNull();
  });

  it('survives the storage object itself throwing when it is looked up', () => {
    const s = createStore(() => {
      throw new Error('SecurityError');
    });
    expect(s.get('x')).toBeNull();
    expect(s.set('x', 'y')).toBe(false);
    expect(s.get('x')).toBe('y');
    expect(s.clearAll()).toBe(1);
    expect(s.get('x')).toBeNull();
  });

  it('survives a missing storage object', () => {
    const s = createStore(() => null);
    expect(s.setJSON('k', [1, 2])).toBe(false);
    expect(s.getJSON('k', [])).toEqual([1, 2]);
    expect(s.persistent).toBe(false);
  });

  it('falls back to memory when only writes fail (storage full)', () => {
    const data = new Map<string, string>();
    const full: Backend = {
      get length() {
        return data.size;
      },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => data.get(k) ?? null,
      setItem() {
        throw new Error('QuotaExceededError');
      },
      removeItem: (k) => void data.delete(k),
    };
    const s = createStore(() => full);
    expect(s.set('a', '1')).toBe(false);
    expect(s.get('a')).toBe('1');
    expect(s.persistent).toBe(false);
  });
});
