import { DISTRICT_REGION, OTHER_REGION, REGIONS } from './geo';
import { obj, str } from './normalize';
import { prettify, slugify } from './text';
import type { District, InterestFamily, InterestTag, Vocab } from './types';

// vocab.json is every file in data/vocab/ merged and keyed by file name ("interests", "motives",
// "neighborhoods", ...). These readers follow the real layout of those files and also accept the
// simpler shapes that make sense (a list of {id, label}, or an object keyed by id), falling back to
// a readable version of the id. Nothing here throws on odd input.
//
// Real layouts this reads (docs/DATA_MODEL.md section 4, data/vocab/README.md):
//   interests.yaml      families: [{id, label, examples, icon, support_only, tags: [{id, label, aka}]}]
//   audiences.yaml      sections crowd, open_to, community, heritage, languages (code), faith
//   neighborhoods.yaml  regions, planning_districts (id, label, region), neighborhoods (id, label, district)
//   kinds, motives, formats, roles: a list under the file's own name, each {id, label}

type Obj = Record<string, unknown>;

function labelOf(o: Obj, id: string): string {
  return str(o.label) ?? str(o.name) ?? str(o.title) ?? prettify(id);
}

function idOf(it: Obj): string | undefined {
  return str(it.id) ?? str(it.key) ?? str(it.slug) ?? str(it.code);
}

/** Accepts [{id, label}], [{code, label}], {id: "Label"}, {id: {label}} and one level of nesting. */
export function readLabelMap(raw: unknown, nestedKey?: string): Map<string, string> {
  const out = new Map<string, string>();
  let node: unknown = raw;
  const o = obj(node);
  if (nestedKey) {
    for (const key of [nestedKey, 'items', 'values']) {
      if (key in o) {
        node = o[key];
        break;
      }
    }
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      if (typeof item === 'string') {
        out.set(item, prettify(item));
        continue;
      }
      const it = obj(item);
      const id = idOf(it);
      if (id) out.set(id, labelOf(it, id));
    }
    return out;
  }
  for (const [id, value] of Object.entries(obj(node))) {
    if (typeof value === 'string') out.set(id, value);
    else if (value && typeof value === 'object' && !Array.isArray(value)) out.set(id, labelOf(value as Obj, id));
  }
  return out;
}

function readTags(raw: unknown): InterestTag[] {
  const tags: InterestTag[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') tags.push({ id: item, label: prettify(item) });
      else {
        const it = obj(item);
        const id = str(it.id) ?? str(it.slug);
        if (id) tags.push({ id, label: labelOf(it, id) });
      }
    }
  } else {
    for (const [id, value] of Object.entries(obj(raw))) {
      tags.push({ id, label: typeof value === 'string' ? value : labelOf(obj(value), id) });
    }
  }
  return tags;
}

function readFamilies(raw: unknown): InterestFamily[] {
  const o = obj(raw);
  let node: unknown = raw;
  for (const key of ['families', 'categories']) {
    if (key in o) {
      node = o[key];
      break;
    }
  }
  const families: InterestFamily[] = [];
  const push = (id: string, f: Obj) => {
    families.push({
      id,
      label: labelOf(f, id),
      icon: str(f.icon) ?? str(f.emoji),
      blurb: str(f.examples) ?? str(f.blurb) ?? str(f.description),
      supportOnly: f.support_only === true ? true : undefined,
      tags: readTags(f.tags ?? f.interests),
    });
  };
  if (Array.isArray(node)) {
    for (const item of node) {
      const f = obj(item);
      const id = str(f.id) ?? str(f.slug);
      if (id) push(id, f);
    }
  } else {
    for (const [id, value] of Object.entries(obj(node))) {
      if (value && typeof value === 'object') push(id, value as Obj);
    }
  }
  return families;
}

function listOf(x: unknown): unknown[] {
  return Array.isArray(x) ? x : Object.values(obj(x));
}

function readDistricts(raw: unknown): District[] {
  const o = obj(raw);
  const regionLabels = new Map<string, string>(REGIONS.map((r) => [r.id, r.label]));
  for (const [id, label] of readLabelMap(o.regions, 'regions')) regionLabels.set(slugify(id), label);

  const byId = new Map<string, District>();
  const add = (idOrLabel: string, label?: string, region?: string) => {
    const id = slugify(idOrLabel);
    if (!id || byId.has(id)) return;
    const regionId = region ? slugify(region) : (DISTRICT_REGION[id] ?? OTHER_REGION.id);
    byId.set(id, {
      id,
      label: label ?? prettify(id.replace(/-/g, ' ')),
      region: regionId,
      regionLabel: regionLabels.get(regionId) ?? (regionId === OTHER_REGION.id ? OTHER_REGION.label : prettify(regionId)),
    });
  };

  for (const item of listOf(o.planning_districts ?? o.districts)) {
    if (typeof item === 'string') add(item);
    else {
      const it = obj(item);
      const id = idOf(it) ?? str(it.label) ?? str(it.name);
      if (id) add(id, labelOf(it, id), str(it.region));
    }
  }
  // Districts named only on neighborhood entries (the real file calls the key `district`).
  for (const item of listOf(o.neighborhoods)) {
    const it = obj(item);
    const d = str(it.district) ?? str(it.planning_district);
    if (d) add(d, undefined, str(it.region));
  }
  return [...byId.values()];
}

export function emptyVocab(): Vocab {
  return {
    families: [],
    familyById: new Map(),
    tagLabels: new Map(),
    districts: [],
    labels: {},
  };
}

export function normalizeVocab(raw: unknown): Vocab {
  const o = obj(raw);
  const vocab = emptyVocab();

  vocab.families = readFamilies(o.interests);
  for (const f of vocab.families) {
    vocab.familyById.set(f.id, f);
    for (const t of f.tags) if (!vocab.tagLabels.has(t.id)) vocab.tagLabels.set(t.id, t.label);
  }

  vocab.districts = readDistricts(o.neighborhoods);

  for (const name of ['kinds', 'motives', 'formats', 'roles']) {
    if (name in o) vocab.labels[name] = readLabelMap(o[name], name);
  }

  // audiences.yaml has sections. A plain list is treated as the crowd list.
  if ('audiences' in o) {
    const a = o.audiences;
    if (Array.isArray(a)) vocab.labels.crowd = readLabelMap(a);
    else {
      const ao = obj(a);
      for (const section of ['crowd', 'open_to', 'community', 'heritage', 'languages', 'faith']) {
        if (section in ao) vocab.labels[section] = readLabelMap(ao[section]);
      }
      if (!vocab.labels.crowd && 'audiences' in ao) vocab.labels.crowd = readLabelMap(ao.audiences);
    }
  }

  if ('neighborhoods' in o) {
    const map = new Map<string, string>();
    for (const item of listOf(obj(o.neighborhoods).neighborhoods ?? o.neighborhoods)) {
      const it = obj(item);
      const id = idOf(it);
      if (id && 'label' in it) map.set(id, labelOf(it, id));
    }
    vocab.labels.neighborhoods = map;
  }
  return vocab;
}

/** Districts seen in group data but missing from the vocabulary are added with a readable label. */
export function districtFor(vocab: Vocab, value: string): District {
  const id = slugify(value);
  const found = vocab.districts.find((d) => d.id === id);
  if (found) return found;
  const region = DISTRICT_REGION[id] ?? OTHER_REGION.id;
  const label = /[A-Z\s]/.test(value) ? value : prettify(id.replace(/-/g, ' '));
  const regionLabel = REGIONS.find((r) => r.id === region)?.label ?? OTHER_REGION.label;
  return { id, label, region, regionLabel };
}

export function labelFor(vocab: Vocab, file: string, id: string, fallback?: Record<string, string>): string {
  return vocab.labels[file]?.get(id) ?? fallback?.[id] ?? prettify(id);
}

export function familyLabel(vocab: Vocab, id: string): string {
  return vocab.familyById.get(id)?.label ?? prettify(id);
}

/** Families people can browse: the vocabulary's, minus the ones kept for the support flow. */
export function browsableFamilies(vocab: Vocab): InterestFamily[] {
  return vocab.families.filter((f) => !f.supportOnly);
}
