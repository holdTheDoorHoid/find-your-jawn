import { DISTRICT_REGION, OTHER_REGION, REGIONS, regionLabel } from './geo';
import { obj, str } from './normalize';
import { prettify, slugify } from './text';
import type { District, InterestFamily, InterestTag, Vocab } from './types';

// vocab.json is every file in data/vocab/ merged and keyed by file name ("interests", "motives",
// "neighborhoods", ...). The shape inside each file belongs to the vocabulary files, so these
// readers accept the shapes that make sense (a list of {id, label}, or an object keyed by id)
// and fall back to a readable version of the id. Nothing here throws on odd input.

type Obj = Record<string, unknown>;

function labelOf(o: Obj, id: string): string {
  return str(o.label) ?? str(o.name) ?? str(o.title) ?? prettify(id);
}

/** Accepts [{id, label}], {id: "Label"}, {id: {label}} and one level of nesting under the same name. */
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
      const id = str(it.id) ?? str(it.key) ?? str(it.slug);
      if (id) out.set(id, labelOf(it, id));
    }
    return out;
  }
  const n = obj(node);
  for (const [id, value] of Object.entries(n)) {
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

function readDistricts(raw: unknown): District[] {
  const o = obj(raw);
  const byId = new Map<string, District>();
  const add = (idOrLabel: string, label?: string, region?: string) => {
    const id = slugify(idOrLabel);
    if (!id || byId.has(id)) return;
    const regionId = region ? slugify(region) : (DISTRICT_REGION[id] ?? OTHER_REGION.id);
    const known = REGIONS.find((r) => r.id === regionId);
    byId.set(id, {
      id,
      label: label ?? prettify(id),
      region: regionId,
      regionLabel: known ? known.label : region && regionId !== OTHER_REGION.id ? prettify(region) : OTHER_REGION.label,
    });
  };

  // An explicit list of planning districts, if the file has one.
  const pd = o.planning_districts ?? o.districts;
  if (Array.isArray(pd)) {
    for (const item of pd) {
      if (typeof item === 'string') add(item);
      else {
        const it = obj(item);
        const id = str(it.id) ?? str(it.slug) ?? str(it.label) ?? str(it.name);
        if (id) add(id, labelOf(it, id), str(it.region));
      }
    }
  }
  // Otherwise (and additionally) districts named on the neighborhood entries.
  const list = o.neighborhoods ?? raw;
  const entries = Array.isArray(list) ? list : Object.values(obj(list));
  for (const item of entries) {
    const it = obj(item);
    const d = str(it.planning_district);
    if (d) add(d, undefined, str(it.region));
  }
  return [...byId.values()];
}

const SIMPLE_FILES = [
  'kinds',
  'motives',
  'formats',
  'roles',
  'audiences',
  'scenes',
  'ways_in',
  'future_selves',
  'neighborhoods',
];

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

  for (const name of SIMPLE_FILES) {
    if (name in o && name !== 'neighborhoods' && name !== 'scenes' && name !== 'future_selves' && name !== 'ways_in') {
      vocab.labels[name] = readLabelMap(o[name], name);
    }
  }
  if ('neighborhoods' in o) {
    // neighborhood id to label, for showing a neighborhood name
    const map = new Map<string, string>();
    const n = obj(o.neighborhoods);
    const list = Array.isArray(o.neighborhoods) ? o.neighborhoods : (n.neighborhoods ?? []);
    const entries = Array.isArray(list) ? list : Object.values(obj(list));
    for (const item of entries) {
      const it = obj(item);
      const id = str(it.id) ?? str(it.slug);
      if (id) map.set(id, labelOf(it, id));
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
  const label = /[A-Z\s]/.test(value) ? value : prettify(id);
  return { id, label, region, regionLabel: regionLabel(region) };
}

export function labelFor(vocab: Vocab, file: string, id: string, fallback?: Record<string, string>): string {
  return vocab.labels[file]?.get(id) ?? fallback?.[id] ?? prettify(id);
}

export function familyLabel(vocab: Vocab, id: string): string {
  return vocab.familyById.get(id)?.label ?? prettify(id);
}

