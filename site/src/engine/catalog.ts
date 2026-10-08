import type { LatLng } from './centroids';
import { DISTRICT_CENTERS, NEIGHBORHOOD_CENTERS, ZIP_CENTERS } from './centroids';
import type { CatalogData, EdgeType, FamilyDef, FutureDef, LabelDef, SceneDef, WayId } from './types';

/** The vocabulary with the lookups the engine needs, built once from CatalogData. */
export interface Catalog {
  data: CatalogData;
  familyById: Map<string, FamilyDef>;
  /** tag id to the family that owns it */
  tagFamily: Map<string, string>;
  tagLabel: Map<string, string>;
  /** families used only by the separate support flow */
  supportFamilies: Set<string>;
  /** tag id to its neighbors in the interest graph (both directions) */
  neighbors: Map<string, { tag: string; type: EdgeType }[]>;
  sceneById: Map<string, SceneDef>;
  futureById: Map<string, FutureDef>;
  motiveLabel: Map<string, string>;
  roleLabel: Map<string, string>;
  formatLabel: Map<string, string>;
  wayLabel: Map<string, string>;
  hoodLabel: Map<string, string>;
  hoodDistrict: Map<string, string>;
  /** tag id to the ways in the vocabulary lists it under, for example literacy_tutoring: teach_it */
  tagWays: Map<string, Set<WayId>>;
}

function labelMap(list: LabelDef[]): Map<string, string> {
  return new Map(list.map((l) => [l.id, l.label]));
}

export function buildCatalog(data: CatalogData): Catalog {
  const familyById = new Map<string, FamilyDef>();
  const tagFamily = new Map<string, string>();
  const tagLabel = new Map<string, string>();
  const supportFamilies = new Set<string>();
  for (const f of data.families) {
    familyById.set(f.id, f);
    if (f.supportOnly) supportFamilies.add(f.id);
    for (const t of f.tags) {
      if (!tagFamily.has(t.id)) tagFamily.set(t.id, f.id);
      if (!tagLabel.has(t.id)) tagLabel.set(t.id, t.label);
    }
  }

  const neighbors = new Map<string, { tag: string; type: EdgeType }[]>();
  const add = (a: string, b: string, type: EdgeType) => {
    const list = neighbors.get(a);
    if (list) list.push({ tag: b, type });
    else neighbors.set(a, [{ tag: b, type }]);
  };
  for (const [a, b, type] of data.edges) {
    add(a, b, type);
    add(b, a, type);
  }

  const tagWays = new Map<string, Set<WayId>>();
  for (const byWay of Object.values(data.waysByFamily)) {
    for (const [way, info] of Object.entries(byWay)) {
      if (!info) continue;
      for (const tag of info.tags) {
        const set = tagWays.get(tag) ?? new Set<WayId>();
        set.add(way as WayId);
        tagWays.set(tag, set);
      }
    }
  }

  return {
    data,
    familyById,
    tagFamily,
    tagLabel,
    supportFamilies,
    neighbors,
    sceneById: new Map([...data.scenes, ...data.extraScenes, ...data.moments].map((s) => [s.id, s])),
    futureById: new Map(data.futureSelves.map((f) => [f.id, f])),
    motiveLabel: labelMap(data.motives),
    roleLabel: labelMap(data.roles),
    formatLabel: labelMap(data.formats),
    wayLabel: labelMap(data.ways),
    hoodLabel: new Map(data.neighborhoods.map((n) => [n.id, n.label])),
    hoodDistrict: new Map(data.neighborhoods.map((n) => [n.id, n.district])),
    tagWays,
  };
}

export function familyLabel(cat: Catalog, id: string): string {
  return cat.familyById.get(id)?.label ?? id.replace(/[-_]+/g, ' ');
}

export function tagName(cat: Catalog, id: string): string {
  return cat.tagLabel.get(id) ?? id.replace(/[-_]+/g, ' ');
}

// ---------------------------------------------------------------- places

function norm(id: string): string {
  return id.toLowerCase().replace(/[-\s]+/g, '_');
}

/** The middle of a neighborhood, by vocabulary id. */
export function neighborhoodCenter(id: string): LatLng | null {
  return NEIGHBORHOOD_CENTERS[norm(id)] ?? null;
}

export function districtCenter(id: string): LatLng | null {
  return DISTRICT_CENTERS[norm(id)] ?? null;
}

/** The middle of a ZIP code. Only the first five characters count. */
export function zipCenter(zip: string): LatLng | null {
  return ZIP_CENTERS[zip.trim().slice(0, 5)] ?? null;
}

export function isKnownZip(zip: string): boolean {
  return zipCenter(zip) !== null;
}
