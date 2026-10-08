import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// WCAG 2.2 AA contrast for the color pairs the stylesheet actually uses, in both themes.
// Text needs 4.5 to 1, and the borders and focus rings of controls need 3 to 1.

const css = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8');

function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
}

const lightBlock = /:root\s*{([\s\S]*?)\n}/.exec(css)![1]!;
const darkBlock = /@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([\s\S]*?)\n  }\n}/.exec(css)![1]!;
const light = vars(lightBlock);
const dark = { ...light, ...vars(darkBlock) };

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT: [string, string][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink', 'surface-2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent-ink', 'accent'],
  ['accent-soft-ink', 'accent-soft'],
  ['notice-ink', 'notice-bg'],
  ['sample-ink', 'sample-bg'],
  ['good-ink', 'good-bg'],
  ['info-ink', 'info-bg'],
  ['note-ink', 'note-bg'],
  ['calm-ink', 'calm-bg'],
  ['calm-accent', 'calm-bg'],
  ['calm-accent', 'bg'],
  ['calm-accent', 'surface'],
  ['calm-bg', 'calm-accent'],
  ['accent-ink', 'calm-accent'],
  ['ink', 'accent-soft'],
];

const UI: [string, string][] = [
  ['line-strong', 'bg'],
  ['line-strong', 'surface'],
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['accent', 'bg'],
  ['note-ink', 'bg'],
];

for (const [name, theme] of [
  ['light', light],
  ['dark', dark],
] as const) {
  describe(`contrast, ${name} theme`, () => {
    it.each(TEXT)('text %s on %s is at least 4.5 to 1', (fg, bg) => {
      expect(theme[fg], `missing --${fg}`).toBeTruthy();
      expect(theme[bg], `missing --${bg}`).toBeTruthy();
      expect(ratio(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(UI)('control color %s on %s is at least 3 to 1', (fg, bg) => {
      expect(ratio(theme[fg]!, theme[bg]!)).toBeGreaterThanOrEqual(3);
    });
  });
}
