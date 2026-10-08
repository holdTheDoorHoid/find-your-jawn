import { emptyAnswers, type Answers, type BlockerKey, type Dial, type FollowId, type NotWhy, type PathId, type Reaction } from './types';

// Reading answers back from the browser's storage. Whatever is there might be from an older
// version of the quiz, half written, or edited by hand, so every field is checked and anything
// that does not fit is dropped. Never throws.

type Obj = Record<string, unknown>;

const obj = (x: unknown): Obj => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {});
const strs = (x: unknown, max = 200): string[] =>
  Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length < 80))].slice(0, max) : [];
const bool = (x: unknown): boolean | undefined => (typeof x === 'boolean' ? x : undefined);
const int = (x: unknown, lo: number, hi: number): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : undefined;
function one<T extends string>(x: unknown, allowed: readonly T[]): T | undefined {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : undefined;
}

const PATHS = ['explore', 'hours', 'court', 'newcomer', 'student', 'kids', 'support'] as const satisfies readonly PathId[];
const DIALS = ['gentle', 'balanced', 'bold'] as const satisfies readonly Dial[];
const MODES = ['walk', 'septa', 'drive', 'anywhere'] as const;
const BUDGETS = ['free', 'low', 'any'] as const;
const FREQS = ['once', 'monthly', 'weekly', 'any'] as const;
const FAITH = ['include', 'exclude', 'only'] as const;
const MEET = ['similar', 'different', 'mix'] as const;
const SIZES = ['small', 'medium', 'large', 'any'] as const;
const REACTIONS = ['into', 'maybe', 'not'] as const satisfies readonly Reaction[];
const WHYS = ['far', 'time', 'not_my_thing', 'intense', 'crowded', 'cost', 'already'] as const satisfies readonly NotWhy[];
const DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_IDS = ['morning', 'daytime', 'afternoon', 'evening', 'night'];
const FOLLOW_IDS = ['setting', 'competition', 'online', 'cadence', 'kids_along'] as const satisfies readonly FollowId[];
const SINCE = ['weeks', 'months', 'year', 'years'] as const;
const LAST_NEW = ['great', 'ok', 'hard'] as const;
const BLOCKERS = ['age', 'budget', 'when', 'often', 'far', 'wheelchair', 'languages', 'faith', 'background', 'path', 'form', 'kids', 'newcomer', 'open_to', 'online'] as const satisfies readonly BlockerKey[];

function locked<T>(x: unknown, read: (v: unknown) => T | undefined): { value: T; locked: boolean } | undefined {
  const o = obj(x);
  const value = read(o.value);
  return value === undefined ? undefined : { value, locked: o.locked === true };
}

export function sanitizeAnswers(raw: unknown): Answers {
  const o = obj(raw);
  const a = emptyAnswers();

  a.paths = strs(o.paths, 10).filter((p): p is PathId => (PATHS as readonly string[]).includes(p));
  const hours = obj(o.hours);
  if (Object.keys(hours).length) a.hours = { need: int(hours.need, 1, 1000), form: bool(hours.form) };
  const court = obj(o.court);
  if (Object.keys(court).length) a.court = { need: int(court.need, 1, 2000), noChildren: bool(court.noChildren) };
  if (Array.isArray(o.kidsAges)) a.kidsAges = o.kidsAges.map((v) => int(v, 0, 17)).filter((v): v is number => v !== undefined).slice(0, 8);
  a.newSince = one(o.newSince, SINCE);
  if (typeof o.school === 'string' && o.school.length < 40) a.school = o.school;
  if (o.includeSupport === true) a.includeSupport = true;

  a.scenes = strs(o.scenes, 40);
  a.moments = strs(o.moments, 40);
  if (typeof o.words === 'string') a.words = o.words.slice(0, 200);

  const when = obj(o.when);
  if (Object.keys(when).length) {
    a.when = {
      days: strs(when.days, 7).filter((d) => DAY_IDS.includes(d)),
      times: strs(when.times, 6).filter((t) => TIME_IDS.includes(t)),
      flexible: when.flexible === true,
      locked: when.locked === true,
    };
  }
  a.often = locked(o.often, (v) => one(v, FREQS));
  const place = obj(o.place);
  if (typeof place.hood === 'string' || typeof place.zip === 'string') {
    a.place = {
      hood: typeof place.hood === 'string' && place.hood.length < 60 ? place.hood : undefined,
      zip: typeof place.zip === 'string' && /^\d{5}$/.test(place.zip) ? place.zip : undefined,
    };
  }
  const far = obj(o.far);
  const mode = one(far.mode, MODES);
  if (mode) a.far = { mode, minutes: int(far.minutes, 5, 180) ?? 30, locked: far.locked === true };
  a.budget = locked(o.budget, (v) => one(v, BUDGETS));
  const age = obj(o.age);
  const lo = int(age.lo, 5, 110);
  const hi = int(age.hi, 5, 110);
  if (lo !== undefined && hi !== undefined && hi >= lo) a.age = { lo, hi };
  a.wheelchair = locked(o.wheelchair, bool);
  const langs = obj(o.languages);
  if (Array.isArray(langs.codes)) a.languages = { codes: strs(langs.codes, 10), locked: langs.locked === true };
  const faith = obj(o.faith);
  const faithMode = one(faith.mode, FAITH);
  if (faithMode) a.faith = { mode: faithMode, tradition: typeof faith.tradition === 'string' ? faith.tradition : undefined };
  a.noBackgroundCheck = locked(o.noBackgroundCheck, bool);

  a.picked = strs(o.picked, 40);
  a.starred = strs(o.starred, 3);
  a.tags = strs(o.tags, 80);

  const m = obj(o.motives);
  if (Object.keys(m).length) {
    const s = (v: unknown) => (typeof v === 'string' && v.length < 40 ? v : undefined);
    a.motives = { m1: s(m.m1), l1: s(m.l1), m2: s(m.m2), l2: s(m.l2) };
  }
  const meet = obj(o.meet);
  const meetWith = one(meet.with, MEET);
  if (meetWith) a.meet = { with: meetWith, sameAge: bool(meet.sameAge), communities: strs(meet.communities, 20) };
  a.strangers = int(o.strangers, 1, 5);
  a.bringSomeone = bool(o.bringSomeone);
  a.size = one(o.size, SIZES);
  a.newness = int(o.newness, 1, 5);
  a.lastNew = one(o.lastNew, LAST_NEW);

  a.future = strs(o.future, 2);

  for (const [id, v] of Object.entries(obj(o.taste))) {
    const t = obj(v);
    const r = one(t.r, REACTIONS);
    if (r && id.length < 130) a.taste[id] = { r, why: one(t.why, WHYS), probe: t.probe === true ? true : undefined };
  }
  for (const id of FOLLOW_IDS) {
    const v = obj(o.follow)[id];
    if (typeof v === 'string' && v.length < 20) a.follow[id] = v;
  }

  a.dial = one(o.dial, DIALS) ?? 'balanced';
  if (Array.isArray(o.notForMe)) {
    a.notForMe = o.notForMe
      .map((n) => {
        const x = obj(n);
        return typeof x.id === 'string' && x.id.length < 130 ? { id: x.id, why: one(x.why, WHYS) } : null;
      })
      .filter((n): n is { id: string; why: NotWhy | undefined } => n !== null)
      .slice(0, 100);
  }
  if (Array.isArray(o.loose)) a.loose = strs(o.loose, 20).filter((k): k is BlockerKey => (BLOCKERS as readonly string[]).includes(k));
  return a;
}
