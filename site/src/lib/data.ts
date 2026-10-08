// Build time data loading (runs in Node while Astro builds pages). Never import this file from an
// island or from anything that ships to the browser.

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { emptyManifest, normalizeManifest } from './manifest';
import { normalizeGroup, normalizeGroupsFile, obj, str } from './normalize';
import { slugify } from './text';
import type { Group, Manifest, Vocab } from './types';
import { emptyVocab, normalizeVocab } from './vocab';

const SITE_ROOT = process.cwd();
const DATA_DIR = path.resolve(SITE_ROOT, 'public/data');
const REGISTRY = path.resolve(SITE_ROOT, '../registry/sources.yaml');

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

let groupsCache: { built: string; groups: Group[] } | null = null;

/** Every group from groups.json, normalized. Throws if the file is missing: a build with no data is a mistake. */
export function loadGroups(): { built: string; groups: Group[] } {
  if (groupsCache) return groupsCache;
  const file = path.join(DATA_DIR, 'groups.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run "npm run prepare-data" (fixtures) or "fyj build" (real data) first.`);
  }
  const raw = readJson(file);
  if (raw === null) throw new Error(`Could not read ${file} as JSON.`);
  const parsed = normalizeGroupsFile(raw);
  parsed.groups.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  groupsCache = parsed;
  return parsed;
}

/** The full record for one group page, from groups/<slug>.json. Falls back to the slim record. */
export function loadFullGroup(slug: string): Group {
  const safe = slugify(slug);
  const file = path.join(DATA_DIR, 'groups', `${safe}.json`);
  const raw = fs.existsSync(file) ? readJson(file) : null;
  if (raw) {
    const g = normalizeGroup(raw);
    if (g.id) return g;
  }
  const slim = loadGroups().groups.find((g) => g.id === slug);
  if (!slim) throw new Error(`No data for group ${slug}`);
  return slim;
}

let countsCache: Record<string, number> | null = null;

/** How many browsable groups each interest family has. Worked out once per build. */
export function loadFamilyCounts(): Record<string, number> {
  if (countsCache) return countsCache;
  const counts: Record<string, number> = {};
  for (const g of loadGroups().groups) {
    if (g.audience.support_group) continue;
    for (const c of new Set(g.categories)) counts[c] = (counts[c] ?? 0) + 1;
  }
  countsCache = counts;
  return counts;
}

let vocabCache: Vocab | null = null;

export function loadVocab(): Vocab {
  if (vocabCache) return vocabCache;
  const raw = readJson(path.join(DATA_DIR, 'vocab.json'));
  vocabCache = raw ? normalizeVocab(raw) : emptyVocab();
  return vocabCache;
}

let manifestCache: Manifest | null = null;

export function loadManifest(): Manifest {
  if (manifestCache) return manifestCache;
  const raw = readJson(path.join(DATA_DIR, 'manifest.json'));
  manifestCache = raw ? normalizeManifest(raw) : emptyManifest();
  return manifestCache;
}

export interface SourceEntry {
  id: string;
  name: string;
  owner: string;
  url: string;
  attribution: string;
  leadOnly: boolean;
}

let sourcesCache: SourceEntry[] | null = null;

/** Sources from registry/sources.yaml: credits on the About page and names on group pages. */
export function loadSources(): SourceEntry[] {
  if (sourcesCache) return sourcesCache;
  sourcesCache = readSources();
  return sourcesCache;
}

function readSources(): SourceEntry[] {
  try {
    const parsed: unknown = parseYaml(fs.readFileSync(REGISTRY, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    const out: SourceEntry[] = [];
    for (const item of parsed) {
      const o = obj(item);
      const id = str(o.id);
      const name = str(o.name);
      if (!id || !name) continue;
      out.push({
        id,
        name,
        owner: str(o.owner) ?? '',
        url: str(o.url) ?? '',
        attribution: str(o.attribution) ?? '',
        leadOnly: o.lead_only === true,
      });
    }
    return out;
  } catch {
    return [];
  }
}
