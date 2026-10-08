import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as strings from '../strings/en';

// The owner's rule: no dashes as punctuation in anything people read. No em dash, no en dash,
// and no hyphen with a space on both sides. Hyphens inside words are fine.

const EM = '—';
const EN = '–';

function* walk(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* walk(value[i], `${path}[${i}]`);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* walk(v, `${path}.${k}`);
  }
}

describe('interface strings', () => {
  const all = [...walk(strings, 'en')];

  it('has strings to check', () => {
    expect(all.length).toBeGreaterThan(200);
  });

  it('uses no em dashes or en dashes', () => {
    const bad = all.filter(([, s]) => s.includes(EM) || s.includes(EN));
    expect(bad).toEqual([]);
  });

  it('uses no spaced hyphens or double hyphens used as dashes', () => {
    const bad = all.filter(([, s]) => / - /.test(s) || / -- /.test(s) || /\s-$/.test(s) || /^-\s/.test(s));
    expect(bad).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(astro|ts|tsx|css)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('site source', () => {
  it('has no em dashes or en dashes anywhere in pages, components or styles', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((f) => {
      const text = readFileSync(f, 'utf8');
      return text.includes(EM) || text.includes(EN);
    });
    expect(offenders).toEqual([]);
  });
});
