import { OTHER_REGION, REGIONS } from './geo';
import { isBrowsable } from './filters';
import { prettify } from './text';
import type { Group, Manifest, Vocab } from './types';
import { districtFor, familyLabel } from './vocab';

// Numbers for the "How complete is this?" page. Counts come from manifest.json when it has them,
// and from groups.json when it does not, so the page is never blank.

export interface CountRow {
  id: string;
  label: string;
  count: number;
}

export interface CoverageSummary {
  total: number;
  byCategory: CountRow[];
  byDistrict: CountRow[];
  byRegion: CountRow[];
  noPlace: number;
  tier0Unchecked: number | null;
  /** true when category and district rows came from the manifest rather than groups.json */
  fromManifest: boolean;
}

function sorted(rows: CountRow[]): CountRow[] {
  return rows.sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : 1));
}

export function summarize(groups: Group[], manifest: Manifest, vocab: Vocab): CoverageSummary {
  const listed = groups.filter(isBrowsable);

  const catCounts = new Map<string, number>();
  const distCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  let noPlace = 0;
  for (const g of listed) {
    for (const c of new Set(g.categories)) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
    const districts = new Set<string>();
    const regions = new Set<string>();
    for (const l of g.locations) {
      if (!l.planning_district) continue;
      const d = districtFor(vocab, l.planning_district);
      districts.add(d.id);
      regions.add(d.region);
    }
    if (districts.size === 0) noPlace += 1;
    for (const d of districts) distCounts.set(d, (distCounts.get(d) ?? 0) + 1);
    for (const r of regions) regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
  }

  const manifestCats = Object.entries(manifest.byCategory);
  const manifestDists = Object.entries(manifest.byDistrict);
  const fromManifest = manifestCats.length > 0 || manifestDists.length > 0;

  const catSource: [string, number][] = manifestCats.length > 0 ? manifestCats : [...catCounts.entries()];
  const byCategory = sorted(catSource.map(([id, count]) => ({ id, label: familyLabel(vocab, id), count })));

  const distSource: [string, number][] = manifestDists.length > 0 ? manifestDists : [...distCounts.entries()];
  const byDistrict = sorted(
    distSource.map(([value, count]) => {
      const d = districtFor(vocab, value);
      return { id: d.id, label: d.label, count };
    }),
  );

  const regionLabels = new Map<string, string>(REGIONS.map((r) => [r.id, r.label]));
  for (const d of vocab.districts) regionLabels.set(d.region, d.regionLabel);
  const byRegion = sorted(
    [...regionCounts.entries()].map(([id, count]) => ({
      id,
      label: regionLabels.get(id) ?? (id === OTHER_REGION.id ? OTHER_REGION.label : prettify(id)),
      count,
    })),
  );

  return {
    total: listed.length,
    byCategory,
    byDistrict,
    byRegion,
    noPlace,
    tier0Unchecked: manifest.tier0Unchecked ?? null,
    fromManifest,
  };
}

