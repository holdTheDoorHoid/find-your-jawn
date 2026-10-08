import type { Prepared } from './prepare';

// How alike two groups are, from 0 to 1. Used by the taste test (similar to what you liked),
// the check in "more like it" suggestion, and the taste test card picker (cards that differ).

const FEATURE_WEIGHTS = {
  tags: 0.3,
  families: 0.15,
  roles: 0.1,
  formats: 0.1,
  motives: 0.1,
  crowd: 0.05,
  kind: 0.1,
  size: 0.05,
  commitment: 0.05,
} as const;

function jaccard(a: readonly string[], b: readonly string[]): number | null {
  if (a.length === 0 || b.length === 0) return null;
  const sa = new Set(a);
  let both = 0;
  for (const x of new Set(b)) if (sa.has(x)) both += 1;
  const union = sa.size + new Set(b).size - both;
  return union === 0 ? null : both / union;
}

/** Features that are missing on either side are left out, and the rest count for more. */
export function similarity(a: Prepared, b: Prepared): number {
  let sum = 0;
  let weight = 0;
  const add = (w: number, v: number | null) => {
    if (v === null) return;
    sum += w * v;
    weight += w;
  };
  add(FEATURE_WEIGHTS.tags, jaccard(a.tags, b.tags));
  add(FEATURE_WEIGHTS.families, jaccard(a.families, b.families));
  add(FEATURE_WEIGHTS.roles, jaccard(a.g.roles, b.g.roles));
  add(FEATURE_WEIGHTS.formats, jaccard(a.g.formats, b.g.formats));
  add(FEATURE_WEIGHTS.motives, jaccard(a.g.motives, b.g.motives));
  add(FEATURE_WEIGHTS.crowd, jaccard(a.g.crowd, b.g.crowd));
  add(FEATURE_WEIGHTS.kind, a.g.kind === b.g.kind ? 1 : 0);
  if (a.g.group_size && b.g.group_size) add(FEATURE_WEIGHTS.size, a.g.group_size === b.g.group_size ? 1 : 0);
  if (a.g.commitment && b.g.commitment) add(FEATURE_WEIGHTS.commitment, a.g.commitment === b.g.commitment ? 1 : 0);
  return weight === 0 ? 0 : sum / weight;
}
