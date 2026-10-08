import { num, obj, str } from './normalize';
import type { CoverageRow, Manifest } from './types';

// manifest.json is written by `fyj build` (DATA_MODEL section 5): build date, counts by status,
// tier, category and planning district, the number of tier 0 groups not yet checked, and the
// coverage estimates. The exact key names are the pipeline's, so this reader looks in the places
// those numbers would sensibly live and returns empty values rather than failing. The "How
// complete is this?" page also counts groups straight from groups.json, so it never depends on
// this file for its main numbers.

function numMap(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(x)) {
    for (const item of x) {
      const it = obj(item);
      const k = str(it.id) ?? str(it.key) ?? str(it.name) ?? str(it.label);
      const v = num(it.count) ?? num(it.n) ?? num(it.total);
      if (k && v !== undefined) out[k] = v;
    }
    return out;
  }
  for (const [k, v] of Object.entries(obj(x))) {
    const n = num(v);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  for (const v of values) if (v !== undefined) return v;
  return undefined;
}

function coverageRows(x: unknown): CoverageRow[] {
  const o = obj(x);
  let list: unknown = x;
  if (!Array.isArray(x)) {
    if (Array.isArray(o.estimates)) list = o.estimates;
    else if (Array.isArray(o.slices)) list = o.slices;
    else list = Object.entries(o).map(([slice, v]) => ({ slice, ...obj(v) }));
  }
  if (!Array.isArray(list)) return [];
  const rows: CoverageRow[] = [];
  for (const item of list) {
    const it = obj(item);
    const slice = str(it.slice) ?? str(it.name) ?? str(it.label) ?? str(it.id);
    if (!slice) continue;
    rows.push({
      slice,
      found: num(it.found) ?? num(it.count) ?? num(it.observed),
      estimate: num(it.estimate) ?? num(it.estimated) ?? num(it.estimated_total) ?? num(it.total),
      low: num(it.low) ?? num(it.ci_low),
      high: num(it.high) ?? num(it.ci_high),
      note: str(it.note) ?? str(it.notes),
    });
  }
  return rows;
}

export function emptyManifest(): Manifest {
  return { fixture: false, byStatus: {}, byTier: {}, byCategory: {}, byDistrict: {}, coverage: [] };
}

export function normalizeManifest(raw: unknown): Manifest {
  const o = obj(raw);
  const counts = obj(o.counts);
  const pickMap = (...keys: string[]) => {
    for (const k of keys) {
      if (k in counts) return numMap(counts[k]);
      if (k in o) return numMap(o[k]);
    }
    return {};
  };
  const tier0 = obj(o.tier0);
  return {
    built: str(o.built) ?? str(o.built_at) ?? str(o.date),
    fixture: o.fixture === true,
    total: firstDefined(num(o.total), num(o.count), num(counts.total), num(counts.groups)),
    byStatus: pickMap('by_status', 'status'),
    byTier: pickMap('by_tier', 'tier', 'tiers'),
    byCategory: pickMap('by_category', 'category', 'categories'),
    byDistrict: pickMap('by_planning_district', 'by_district', 'planning_district', 'planning_districts'),
    tier0Unchecked: firstDefined(
      num(o.tier0_unchecked),
      num(o.tier0_not_checked),
      num(o.tier0_count),
      num(counts.tier0_unchecked),
      num(tier0.unchecked),
      num(tier0.count),
      num(obj(counts.by_tier)['0']),
      num(obj(o.by_tier)['0']),
    ),
    coverage: coverageRows(o.coverage ?? o.coverage_estimates ?? o.estimates),
  };
}
