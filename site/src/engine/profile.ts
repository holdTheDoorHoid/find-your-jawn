import type { Group } from '../lib/types';
import { districtCenter, neighborhoodCenter, zipCenter, type Catalog } from './catalog';
import type { LatLng } from './centroids';
import type { Answers, NotWhy, WayId } from './types';

// Turns the answers into numbers the rest of the engine can use: how much the person likes each
// interest, role and format, what they want from a group, how they feel about strangers, where
// they start from, and what the taste test and "Not for me" taps taught us.
//
// Everything here is plain arithmetic on the answers, so every number can be explained.

// ---------------------------------------------------------------- knobs (the simulation can tune these)

/** Weights for how strongly each kind of interest answer counts, 0 to 1. DESIGN section 3. */
export const INTEREST = {
  starred: 1.0,
  /** a starred family when the person opened it and chose specific tags: the rest of the family */
  starredRest: 0.7,
  picked: 0.6,
  /** a tag chosen inside a starred family */
  chosenTag: 1.0,
  scene: 0.9,
  moment: 0.75,
  words: 0.85,
  /** neighbors in the interest graph count this fraction of the source's weight */
  edge: 0.4,
  /** a scene gives its family this fraction of the tag's weight */
  sceneFamily: 0.7,
} as const;

/** At or above this a tag or family counts as "familiar" for the stretch rules. */
export const LIKED = 0.5;
export const LIKED_FAMILY = 0.6;

/** MOST and LEAST: where each motive lands. Round one picks m1 and l1, round two m2 and l2. */
export const MOTIVE_WEIGHT = { m1: 1.0, m2: 0.75, middle: 0.45, l2: 0.2, l1: 0.0 } as const;

// ---------------------------------------------------------------- types

export interface Evidence {
  kind: 'starred' | 'picked' | 'tag' | 'scene' | 'moment' | 'words' | 'edge' | 'taste';
  /** words to show: a family or interest name, a scene sentence, a typed word */
  label: string;
  /** for edges: the interest the person picked that this one sits next to */
  via?: string;
}

export interface Feedback {
  /** groups marked Into it, Maybe or Not for me (taste test) */
  into: Group[];
  maybe: Group[];
  not: { g: Group; why?: NotWhy }[];
  /** groups the person is already in: shown never, but they count as a vote for the topic */
  already: Group[];
  /** every group the person said no to, in the taste test or on a result: never shown again */
  hidden: Set<string>;
  /** multiplier on the travel limit, 1 means no change, 0.8 per "too far" */
  travelScale: number;
  /** multipliers on how much each practical part counts, 1 means no change */
  boost: { schedule: number; travel: number; cost: number; size: number };
  /** how many steps harder strangers feel after "too intense" taps */
  harder: number;
  /** a leaning toward small groups from "too many people" taps */
  smallBias: number;
  /** one step cheaper from "cost" taps */
  cheaper: number;
  /** day and time slots of groups rejected as "wrong time" */
  avoidSlots: Map<string, number>;
  /** interests and families of "not my thing" groups, 0 to 1 */
  avoidTags: Map<string, number>;
  avoidFamilies: Map<string, number>;
}

export interface Profile {
  answers: Answers;
  cat: Catalog;

  /** how much each interest tag is liked, 0 to 1 */
  tagW: Map<string, number>;
  tagEv: Map<string, Evidence>;
  famW: Map<string, number>;
  famEv: Map<string, Evidence>;
  /** tags the person asked for directly (not neighbors in the graph) */
  likedTags: Set<string>;
  likedFamilies: Set<string>;
  hasInterest: boolean;

  /** 0 to 1, top pick is 1. Empty when no scenes were picked. */
  roleW: Map<string, number>;
  formatW: Map<string, number>;
  /** the scene or moment sentences that carried each role and format, for explanations */
  roleScene: Map<string, string>;
  formatScene: Map<string, string>;
  /** ways in the person already uses */
  ways: Set<WayId>;

  motiveW: Map<string, number>;
  hasMotive: boolean;

  /** what the chosen future selves push toward, 0 to 1 */
  future: {
    ids: string[];
    tags: Map<string, number>;
    roles: Map<string, number>;
    formats: Map<string, number>;
    ways: Map<string, number>;
  };

  /** 1 exciting to 5 really hard, 3 when not asked, then nudged by "too intense" taps */
  strangers: number;
  /** strangers feel hard: newcomer welcome counts double and known low ratings are ruled out */
  hardStrangers: boolean;
  /** 0 to 1: how much the person likes new things */
  comfort: number;
  wantsMix: boolean;
  likesLeading: boolean;

  home: LatLng | null;
  homeLabel: string | null;
  homeDistrict: string | null;

  /** the age range the filters use; 21 when the person did not say */
  age: { lo: number; hi: number };
  ageKnown: boolean;

  feedback: Feedback;
}

// ---------------------------------------------------------------- helpers

function bump(map: Map<string, number>, key: string, w: number): void {
  // Two independent signals for the same thing: 1 minus the chance that neither counts.
  const old = map.get(key) ?? 0;
  map.set(key, 1 - (1 - old) * (1 - Math.min(1, Math.max(0, w))));
}

function setMax(map: Map<string, number>, key: string, w: number): boolean {
  if (w > (map.get(key) ?? 0)) {
    map.set(key, w);
    return true;
  }
  return false;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const STOP = new Set(['and', 'the', 'for', 'with', 'club', 'group', 'groups', 'people', 'love', 'like', 'into', 'about', 'some']);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/** Words of the person's own matched to interest names. "chess and knitting" finds two tags. */
export function matchWords(text: string, cat: Catalog): { tag: string; word: string }[] {
  const tokens = words(text);
  if (tokens.length === 0) return [];
  const out: { tag: string; word: string }[] = [];
  for (const f of cat.data.families) {
    if (f.supportOnly) continue;
    for (const t of f.tags) {
      const label = words(t.label);
      const hit = tokens.find((tok) => label.some((l) => l === tok || (tok.length >= 4 && (l.startsWith(tok) || tok.startsWith(l)))));
      if (hit) out.push({ tag: t.id, word: hit });
    }
  }
  return out;
}

export function emptyFeedback(): Feedback {
  return {
    into: [],
    maybe: [],
    not: [],
    already: [],
    hidden: new Set(),
    travelScale: 1,
    boost: { schedule: 1, travel: 1, cost: 1, size: 1 },
    harder: 0,
    smallBias: 0,
    cheaper: 0,
    avoidSlots: new Map(),
    avoidTags: new Map(),
    avoidFamilies: new Map(),
  };
}

/** What the taste test and "Not for me" taps teach, in this visit's weights. */
export function deriveFeedback(a: Answers, lookup: (id: string) => Group | undefined, cat: Catalog): Feedback {
  const fb = emptyFeedback();
  const learn = (g: Group, why: NotWhy | undefined) => {
    if (why === 'far') {
      fb.travelScale = Math.max(0.5, fb.travelScale * 0.8);
      fb.boost.travel = Math.min(2, fb.boost.travel * 1.25);
    } else if (why === 'time') {
      fb.boost.schedule = Math.min(2.5, fb.boost.schedule * 1.4);
      for (const d of g.schedule.days) for (const t of g.schedule.times.length ? g.schedule.times : ['any']) fb.avoidSlots.set(`${d}|${t}`, (fb.avoidSlots.get(`${d}|${t}`) ?? 0) + 1);
    } else if (why === 'intense') {
      fb.harder = Math.min(2, fb.harder + 1);
    } else if (why === 'crowded') {
      fb.smallBias = Math.min(2, fb.smallBias + 1);
      fb.boost.size = Math.min(2.5, fb.boost.size * 1.4);
    } else if (why === 'cost') {
      fb.cheaper = Math.min(2, fb.cheaper + 1);
      fb.boost.cost = Math.min(2.5, fb.boost.cost * 1.4);
    } else if (why === 'already') {
      fb.already.push(g);
    } else {
      // not my thing, or no reason given: push away from what this group is about
      for (const t of g.interests) fb.avoidTags.set(t, Math.min(1, (fb.avoidTags.get(t) ?? 0) + 0.5));
      for (const f of groupFamilies(g, cat)) fb.avoidFamilies.set(f, Math.min(1, (fb.avoidFamilies.get(f) ?? 0) + 0.25));
    }
  };
  for (const [id, t] of Object.entries(a.taste)) {
    const g = lookup(id);
    if (!g) continue;
    if (t.r === 'into') fb.into.push(g);
    else if (t.r === 'maybe') fb.maybe.push(g);
    else {
      // Said no: never shown again, and what the reason teaches is kept for this visit.
      fb.hidden.add(id);
      fb.not.push({ g, why: t.why });
      learn(g, t.why);
    }
  }
  for (const n of a.notForMe) {
    fb.hidden.add(n.id);
    const g = lookup(n.id);
    if (!g) continue;
    fb.not.push({ g, why: n.why });
    learn(g, n.why);
  }
  return fb;
}

/** The interest families of a group: its categories plus the families of its tags. */
export function groupFamilies(g: Group, cat: Catalog): string[] {
  const out: string[] = [];
  for (const c of g.categories) if (!out.includes(c)) out.push(c);
  for (const t of g.interests) {
    const f = cat.tagFamily.get(t);
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

// ---------------------------------------------------------------- the profile

export function deriveProfile(a: Answers, cat: Catalog, lookup: (id: string) => Group | undefined = () => undefined): Profile {
  const tagW = new Map<string, number>();
  const tagEv = new Map<string, Evidence>();
  const famW = new Map<string, number>();
  const famEv = new Map<string, Evidence>();

  const direct = (tag: string, w: number, ev: Evidence) => {
    const before = tagW.get(tag) ?? 0;
    bump(tagW, tag, w);
    if (w >= before) tagEv.set(tag, ev);
  };
  const family = (fam: string, w: number, ev: Evidence) => {
    if (setMax(famW, fam, w)) famEv.set(fam, ev);
  };

  // Tiles. Support families are never offered, and never counted if one sneaks in.
  const usable = (fam: string) => !cat.supportFamilies.has(fam);
  for (const fam of a.picked) {
    if (!usable(fam)) continue;
    family(fam, INTEREST.picked, { kind: 'picked', label: cat.familyById.get(fam)?.label ?? fam });
  }
  const chosenIn = new Map<string, string[]>();
  for (const t of a.tags) {
    const fam = cat.tagFamily.get(t);
    if (!fam || !usable(fam)) continue;
    chosenIn.set(fam, [...(chosenIn.get(fam) ?? []), t]);
  }
  for (const fam of a.starred) {
    if (!usable(fam)) continue;
    const label = cat.familyById.get(fam)?.label ?? fam;
    const chosen = chosenIn.get(fam) ?? [];
    family(fam, chosen.length > 0 ? INTEREST.starredRest : INTEREST.starred, { kind: 'starred', label });
  }
  for (const [fam, tags] of chosenIn) {
    if (!a.starred.includes(fam)) family(fam, INTEREST.picked, { kind: 'picked', label: cat.familyById.get(fam)?.label ?? fam });
    for (const t of tags) direct(t, INTEREST.chosenTag, { kind: 'tag', label: cat.tagLabel.get(t) ?? t });
  }

  // Scenes and moments.
  const roleRaw = new Map<string, number>();
  const formatRaw = new Map<string, number>();
  const roleScene = new Map<string, string>();
  const formatScene = new Map<string, string>();
  const RANK = [1, 0.6, 0.4];
  const usePick = (id: string, scale: number, kind: 'scene' | 'moment') => {
    const s = cat.sceneById.get(id);
    if (!s) return;
    const text = lowerFirst(s.text);
    for (const [tag, w] of Object.entries(s.interests)) {
      direct(tag, scale * w, { kind, label: text });
      const fam = cat.tagFamily.get(tag);
      if (fam && usable(fam) && w >= 0.5) family(fam, INTEREST.sceneFamily * w * (scale / INTEREST.scene), { kind, label: text });
    }
    s.roles.forEach((r, i) => {
      roleRaw.set(r, (roleRaw.get(r) ?? 0) + (RANK[i] ?? 0.3));
      if (i === 0 && !roleScene.has(r)) roleScene.set(r, text);
    });
    s.formats.forEach((f, i) => {
      formatRaw.set(f, (formatRaw.get(f) ?? 0) + (RANK[i] ?? 0.3));
      if (i === 0 && !formatScene.has(f)) formatScene.set(f, text);
    });
  };
  for (const id of a.scenes) usePick(id, INTEREST.scene, 'scene');
  for (const id of a.moments) usePick(id, INTEREST.moment, 'moment');

  // Words of their own.
  if (a.words) {
    for (const m of matchWords(a.words, cat)) direct(m.tag, INTEREST.words, { kind: 'words', label: m.word });
  }

  // Neighbors in the interest graph (0.4 of the source). Only from interests asked for directly.
  const likedTags = new Set<string>();
  for (const [t, w] of tagW) if (w >= LIKED) likedTags.add(t);
  for (const t of likedTags) {
    const w = tagW.get(t) ?? 0;
    for (const n of cat.neighbors.get(t) ?? []) {
      if (likedTags.has(n.tag)) continue;
      if (setMax(tagW, n.tag, INTEREST.edge * w)) {
        tagEv.set(n.tag, { kind: 'edge', label: cat.tagLabel.get(n.tag) ?? n.tag, via: cat.tagLabel.get(t) ?? t });
      }
    }
  }
  const likedFamilies = new Set<string>();
  for (const [f, w] of famW) if (w >= LIKED_FAMILY) likedFamilies.add(f);
  for (const t of likedTags) {
    const f = cat.tagFamily.get(t);
    if (f && usable(f) && (tagW.get(t) ?? 0) >= 0.8) likedFamilies.add(f);
  }
  const hasInterest = likedTags.size > 0 || likedFamilies.size > 0;

  // Roles and formats: top pick is 1.
  const norm = (raw: Map<string, number>) => {
    const max = Math.max(0, ...raw.values());
    const out = new Map<string, number>();
    if (max > 0) for (const [k, v] of raw) out.set(k, v / max);
    return out;
  };
  const roleW = norm(roleRaw);
  const formatW = norm(formatRaw);

  // Ways in the person already uses. Doing it is the baseline for everyone.
  const ways = new Set<WayId>(['do_it']);
  if ((formatW.get('learn_skill') ?? 0) >= 0.6) ways.add('learn_it');
  if ((roleW.get('help_teach') ?? 0) >= 0.6) ways.add('teach_it');
  if ((formatW.get('behind_the_scenes') ?? 0) >= 0.6) ways.add('serve_it');
  for (const t of likedTags) for (const w of cat.tagWays.get(t) ?? []) if (w !== 'lead_it' && (tagW.get(t) ?? 0) >= 0.8) ways.add(w);

  // Motives: two rounds of MOST and LEAST.
  const motiveW = new Map<string, number>();
  const m = a.motives;
  let hasMotive = false;
  if (m && (m.m1 || m.l1 || m.m2 || m.l2)) {
    hasMotive = true;
    for (const mo of cat.data.motives) motiveW.set(mo.id, MOTIVE_WEIGHT.middle);
    if (m.m1) motiveW.set(m.m1, MOTIVE_WEIGHT.m1);
    if (m.m2 && m.m2 !== m.m1) motiveW.set(m.m2, MOTIVE_WEIGHT.m2);
    if (m.l2 && m.l2 !== m.m1 && m.l2 !== m.m2) motiveW.set(m.l2, MOTIVE_WEIGHT.l2);
    if (m.l1 && m.l1 !== m.m1 && m.l1 !== m.m2) motiveW.set(m.l1, MOTIVE_WEIGHT.l1);
  }

  // Future selves.
  const future = { ids: a.future.filter((id) => cat.futureById.has(id)).slice(0, 2), tags: new Map<string, number>(), roles: new Map<string, number>(), formats: new Map<string, number>(), ways: new Map<string, number>() };
  for (const id of future.ids) {
    const f = cat.futureById.get(id);
    if (!f) continue;
    for (const [t, w] of Object.entries(f.interests)) setMax(future.tags, t, w);
    f.roles.forEach((r, i) => setMax(future.roles, r, RANK[i] ?? 0.3));
    f.formats.forEach((r, i) => setMax(future.formats, r, RANK[i] ?? 0.3));
    f.ways.forEach((r, i) => setMax(future.ways, r, RANK[i] ?? 0.4));
  }

  // Feelings about strangers and new things.
  const feedback = deriveFeedback(a, lookup, cat);
  const baseStrangers = a.strangers ?? 3;
  const strangers = Math.min(5, baseStrangers + feedback.harder);
  let comfort = a.newness !== undefined ? (Math.min(5, Math.max(1, a.newness)) - 1) / 4 : 0.5;
  if (a.lastNew === 'great') comfort += 0.15;
  else if (a.lastNew === 'hard') comfort -= 0.15;
  comfort = Math.min(1, Math.max(0, comfort));

  // Where they start from.
  let home: LatLng | null = null;
  let homeLabel: string | null = null;
  let homeDistrict: string | null = null;
  if (a.place?.hood) {
    home = neighborhoodCenter(a.place.hood);
    homeLabel = cat.hoodLabel.get(a.place.hood) ?? null;
    homeDistrict = cat.hoodDistrict.get(a.place.hood) ?? null;
  }
  if (!home && a.place?.zip) {
    home = zipCenter(a.place.zip);
    homeLabel = a.place.zip;
  }
  if (!home && homeDistrict) home = districtCenter(homeDistrict);

  const age = a.age ?? { lo: 21, hi: 21 };

  return {
    answers: a,
    cat,
    tagW,
    tagEv,
    famW,
    famEv,
    likedTags,
    likedFamilies,
    hasInterest,
    roleW,
    formatW,
    roleScene,
    formatScene,
    ways,
    motiveW,
    hasMotive,
    future,
    strangers,
    hardStrangers: strangers >= 4,
    comfort,
    wantsMix: a.meet?.with === 'mix' || a.meet?.with === 'different',
    likesLeading: (roleW.get('lead') ?? 0) >= 0.5 || (roleW.get('organize') ?? 0) >= 0.5,
    home,
    homeLabel,
    homeDistrict,
    age,
    ageKnown: a.age !== undefined,
    feedback,
  };
}
