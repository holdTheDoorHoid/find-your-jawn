import type { CatalogData, EdgeType, FamilyDef, FutureDef, LabelDef, PlaceDef, SceneDef, WayExample, WayId } from '../engine/types';
import { obj, str } from './normalize';
import { normalizeVocab } from './vocab';

// What the quiz needs from the vocabulary files, in a compact plain shape. The site writes this to
// data/quiz-config.json while it builds, and the quiz downloads it, so the match page itself stays
// small. Reads the merged vocab.json (every file in data/vocab/ keyed by file name).

export interface QuizLanguage {
  code: string;
  label: string;
  native?: string;
}

export interface QuizConfig extends CatalogData {
  built: string;
  languages: QuizLanguage[];
  faith: LabelDef[];
  communities: LabelDef[];
}

/** Languages offered on the quiz, in this order. The vocabulary has more; these are the common ones. */
export const QUIZ_LANGUAGES = ['en', 'es', 'zh', 'yue', 'vi', 'ar', 'ht', 'ru', 'fr', 'pt', 'ko', 'km', 'ase'];

const EDGE_TYPES: readonly EdgeType[] = ['same_skill', 'same_crowd', 'same_place', 'same_cause', 'same_topic'];

function list(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function strings(x: unknown): string[] {
  return list(x).filter((v): v is string => typeof v === 'string');
}

function weights(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(x))) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

function scene(raw: unknown): SceneDef | null {
  const o = obj(raw);
  const id = str(o.id);
  const text = str(o.text);
  if (!id || !text) return null;
  return { id, text, icon: str(o.icon) ?? '', interests: weights(o.interests), roles: strings(o.roles), formats: strings(o.formats) };
}

function scenes(x: unknown): SceneDef[] {
  return list(x).map(scene).filter((s): s is SceneDef => s !== null);
}

function future(raw: unknown): FutureDef | null {
  const o = obj(raw);
  const id = str(o.id);
  const text = str(o.text);
  if (!id || !text) return null;
  return {
    id,
    text,
    icon: str(o.icon) ?? '',
    because: str(o.because) ?? '',
    interests: weights(o.interests),
    roles: strings(o.roles),
    formats: strings(o.formats),
    ways: strings(o.ways_in),
  };
}

function labels(x: unknown, key: string): LabelDef[] {
  const out: LabelDef[] = [];
  for (const item of list(obj(x)[key])) {
    const o = obj(item);
    const id = str(o.id);
    if (!id) continue;
    out.push({ id, label: str(o.label) ?? id, icon: str(o.icon), description: str(o.description) });
  }
  return out;
}

export function makeQuizConfig(raw: unknown, built: string): QuizConfig {
  const v = obj(raw);
  const vocab = normalizeVocab(raw);

  const families: FamilyDef[] = vocab.families.map((f) => ({
    id: f.id,
    label: f.label,
    icon: f.icon,
    blurb: f.blurb,
    supportOnly: f.supportOnly,
    tags: f.tags,
  }));

  const edges: [string, string, EdgeType][] = [];
  for (const e of list(obj(v.interests).edges)) {
    const o = obj(e);
    const from = str(o.from);
    const to = str(o.to);
    const type = str(o.type) as EdgeType | undefined;
    if (from && to && type && EDGE_TYPES.includes(type)) edges.push([from, to, type]);
  }

  const sc = obj(v.scenes);

  const waysByFamily: CatalogData['waysByFamily'] = {};
  for (const [fam, byWay] of Object.entries(obj(obj(v.ways_in).by_family))) {
    const entry: Partial<Record<WayId, WayExample>> = {};
    for (const [way, info] of Object.entries(obj(byWay))) {
      const i = obj(info);
      const example = str(i.example);
      if (example) entry[way as WayId] = { tags: strings(i.tags), example };
    }
    waysByFamily[fam] = entry;
  }

  const hoods: PlaceDef[] = [];
  for (const n of list(obj(v.neighborhoods).neighborhoods)) {
    const o = obj(n);
    const id = str(o.id);
    const label = str(o.label);
    if (id && label) hoods.push({ id, label, district: str(o.district) ?? '' });
  }
  hoods.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  const aud = obj(v.audiences);
  const langs: QuizLanguage[] = [];
  const known = new Map<string, QuizLanguage>();
  for (const l of list(aud.languages)) {
    const o = obj(l);
    const code = str(o.code);
    if (code) known.set(code, { code, label: str(o.label) ?? code, native: str(o.native) });
  }
  for (const code of QUIZ_LANGUAGES) {
    const l = known.get(code);
    if (l) langs.push(l);
  }

  return {
    built,
    families,
    edges,
    scenes: scenes(sc.saturday_scenes),
    extraScenes: scenes(sc.extra_scenes),
    moments: scenes(sc.moments),
    futureSelves: list(obj(v.future_selves).future_selves).map(future).filter((f): f is FutureDef => f !== null),
    motives: labels(v.motives, 'motives'),
    roles: labels(v.roles, 'roles'),
    formats: labels(v.formats, 'formats'),
    ways: labels(v.ways_in, 'ways'),
    waysByFamily,
    neighborhoods: hoods,
    languages: langs,
    faith: labels(aud, 'faith'),
    communities: labels(aud, 'community'),
  };
}
