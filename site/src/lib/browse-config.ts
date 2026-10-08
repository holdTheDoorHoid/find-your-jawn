import { OTHER_REGION, REGIONS } from './geo';
import { prettify, titleCase } from './text';
import type { Group, Vocab } from './types';
import { browsableFamilies, districtFor } from './vocab';

// What the browse island needs from the vocabulary, worked out while the site builds so the island
// does not have to download vocab.json. Small, and serialized into the page.

export interface BrowseFamily {
  id: string;
  label: string;
  icon?: string;
}

export interface BrowseDistrict {
  id: string;
  label: string;
  region: string;
}

export interface BrowseRegion {
  id: string;
  label: string;
  districts: BrowseDistrict[];
}

export interface BrowseConfig {
  families: BrowseFamily[];
  regions: BrowseRegion[];
  /** id to label for families and for interest tags that appear in the data, for search */
  labels: Record<string, string>;
  /** neighborhood id to name, for the line under a card's title */
  places: Record<string, string>;
  dataVersion: string;
  built: string;
}

export function makeBrowseConfig(groups: Group[], vocab: Vocab, built: string): BrowseConfig {
  const familyIds = new Set<string>(vocab.families.map((f) => f.id));
  const used = new Set<string>();
  for (const g of groups) for (const c of g.categories) used.add(c);
  const families: BrowseFamily[] = browsableFamilies(vocab).map((f) => ({ id: f.id, label: f.label, icon: f.icon }));
  for (const id of used) if (!familyIds.has(id)) families.push({ id, label: prettify(id) });

  // Districts that appear in the data, grouped by region.
  const byId = new Map<string, BrowseDistrict>();
  for (const g of groups) {
    for (const loc of g.locations) {
      if (!loc.planning_district) continue;
      const d = districtFor(vocab, loc.planning_district);
      if (!byId.has(d.id)) byId.set(d.id, { id: d.id, label: d.label, region: d.region });
    }
  }
  const regionLabels = new Map<string, string>(REGIONS.map((r) => [r.id, r.label]));
  for (const d of vocab.districts) if (!regionLabels.has(d.region)) regionLabels.set(d.region, d.regionLabel);
  const regions: BrowseRegion[] = [];
  const order = [...REGIONS.map((r) => r.id), ...[...regionLabels.keys()].filter((k) => !REGIONS.some((r) => r.id === k))];
  for (const id of order) {
    const districts = [...byId.values()].filter((d) => d.region === id).sort((a, b) => (a.label < b.label ? -1 : 1));
    if (districts.length) regions.push({ id, label: regionLabels.get(id) ?? prettify(id), districts });
  }
  const other = [...byId.values()].filter((d) => !regions.some((r) => r.id === d.region));
  if (other.length) regions.push({ id: OTHER_REGION.id, label: OTHER_REGION.label, districts: other });

  const labels: Record<string, string> = {};
  for (const f of vocab.families) labels[f.id] = f.label;
  for (const f of families) labels[f.id] = f.label;
  for (const g of groups) for (const id of g.interests) if (!labels[id]) labels[id] = vocab.tagLabels.get(id) ?? prettify(id);

  const places: Record<string, string> = {};
  const hoods = vocab.labels.neighborhoods;
  for (const g of groups) {
    for (const loc of g.locations) {
      const n = loc.neighborhood;
      if (n && !places[n]) places[n] = hoods?.get(n) ?? titleCase(n);
    }
  }

  return { families, regions, labels, places, dataVersion: built, built };
}

