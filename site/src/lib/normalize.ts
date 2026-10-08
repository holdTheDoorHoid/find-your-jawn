import { site } from '../strings/en';
import type {
  CostLevel,
  Group,
  GroupLocation,
  GroupSource,
  Status,
  Tri,
  Wheelchair,
} from './types';

// Raw JSON is untrusted in shape: the pipeline omits nulls, empty lists and empty objects.
// These small readers turn anything into the strict shapes in types.ts.

type Obj = Record<string, unknown>;

export function obj(x: unknown): Obj {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {};
}

export function str(x: unknown): string | undefined {
  if (typeof x === 'string') {
    const t = x.trim();
    return t === '' ? undefined : t;
  }
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  return undefined;
}

export function num(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}

export function bool(x: unknown): boolean | undefined {
  return typeof x === 'boolean' ? x : undefined;
}

export function strList(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  const out: string[] = [];
  for (const item of x) {
    const s = str(item);
    if (s !== undefined) out.push(s);
  }
  return out;
}

function oneOf<T extends string>(x: unknown, allowed: readonly T[], fallback: T): T {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : fallback;
}

const TRI = ['yes', 'no', 'unknown'] as const;
const WHEELCHAIR = ['yes', 'partial', 'no', 'unknown'] as const;
const COST = ['free', 'low', 'paid', 'unknown'] as const;
const STATUS = ['active', 'probably_active', 'dormant', 'defunct', 'unknown'] as const;

function triOf(x: unknown): Tri {
  // Accept real booleans too, in case a writer used true or false.
  if (x === true) return 'yes';
  if (x === false) return 'no';
  return oneOf(x, TRI, 'unknown');
}

function normalizeLocation(raw: unknown): GroupLocation {
  const o = obj(raw);
  return {
    label: str(o.label),
    address: str(o.address),
    neighborhood: str(o.neighborhood),
    zip: str(o.zip),
    lat: num(o.lat),
    lng: num(o.lng),
    in_city: o.in_city === false ? false : true,
    transit: str(o.transit),
    planning_district: str(o.planning_district),
  };
}

function normalizeSource(raw: unknown): GroupSource | null {
  const o = obj(raw);
  const url = str(o.url);
  if (!url) return null;
  return { url, seen: str(o.seen), fields: strList(o.fields) };
}

/** Month and year or a full date as a string, whatever the writer produced. */
function dateStr(x: unknown): string | undefined {
  const s = str(x);
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  return m ? s.slice(0, m[3] ? 10 : 7) : s;
}

export function normalizeGroup(raw: unknown): Group {
  const g = obj(raw);
  const aud = obj(g.audience);
  const sch = obj(g.schedule);
  const cost = obj(g.cost);
  const acc = obj(g.access);
  const req = obj(g.requirements);
  const fs = obj(g.first_step);
  const con = obj(g.contacts);

  const nf = num(fs.newcomer_friendliness);
  const sources: GroupSource[] = [];
  if (Array.isArray(g.sources)) {
    for (const s of g.sources) {
      const n = normalizeSource(s);
      if (n) sources.push(n);
    }
  }
  const locations = Array.isArray(g.locations) ? g.locations.map(normalizeLocation) : [];
  const kind = str(g.kind) ?? 'nonprofit';
  const supportGroup = aud.support_group === true || kind === 'support_group';

  return {
    id: str(g.id) ?? '',
    name: str(g.name) ?? site.unnamedGroup,
    aka: strList(g.aka),
    summary: str(g.summary) ?? '',
    what_you_do: str(g.what_you_do),
    kind,
    categories: strList(g.categories),
    interests: strList(g.interests),
    motives: strList(g.motives),
    formats: strList(g.formats),
    roles: strList(g.roles),
    crowd: strList(g.crowd),
    bridging: g.bridging === true,
    audience: {
      open_to: str(aud.open_to) ?? 'public',
      school: str(aud.school),
      min_age: num(aud.min_age),
      max_age: num(aud.max_age),
      community: strList(aud.community),
      faith: str(aud.faith),
      partisan: aud.partisan === true,
      support_group: supportGroup,
    },
    schedule: {
      text: str(sch.text),
      days: strList(sch.days),
      times: strList(sch.times),
      recurring: bool(sch.recurring),
      season: str(sch.season),
    },
    locations,
    online_ok: g.online_ok === true,
    cost: { level: oneOf<CostLevel>(cost.level, COST, 'unknown'), text: str(cost.text) },
    commitment: str(g.commitment),
    group_size: str(g.group_size),
    access: {
      wheelchair: oneOf<Wheelchair>(acc.wheelchair, WHEELCHAIR, 'unknown'),
      languages: strList(acc.languages),
      notes: str(acc.notes),
    },
    requirements: {
      act153_clearances: req.act153_clearances === true,
      background_check: req.background_check === true,
      court_ordered_ok: triOf(req.court_ordered_ok),
      service_hours_letter: triOf(req.service_hours_letter),
      kids_ok: req.kids_ok === true,
      gear: str(req.gear),
    },
    first_step: {
      how: str(fs.how),
      drop_in: bool(fs.drop_in),
      sign_up_needed: bool(fs.sign_up_needed),
      newcomer_friendliness: nf !== undefined && nf >= 1 && nf <= 5 ? Math.round(nf) : undefined,
      basis: str(fs.basis),
      what_to_expect: str(fs.what_to_expect),
      first_visit_tips: strList(fs.first_visit_tips),
    },
    contacts: {
      website: str(con.website),
      email: str(con.email),
      phone: str(con.phone),
      contact_name: str(con.contact_name),
      social: strList(con.social),
      calendar_feed: str(con.calendar_feed),
    },
    status: oneOf<Status>(g.status, STATUS, 'unknown'),
    last_sign_of_life: dateStr(g.last_sign_of_life),
    sign_of_life_url: str(g.sign_of_life_url),
    sources,
    research_tier: num(g.research_tier) ?? 0,
    confidence: str(g.confidence),
    last_checked: dateStr(g.last_checked),
  };
}

/** Parse the contents of groups.json. Tolerates a bare array as well as the documented object. */
export function normalizeGroupsFile(raw: unknown): { built: string; groups: Group[] } {
  const o = obj(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(o.groups) ? o.groups : [];
  const groups: Group[] = [];
  for (const item of list) {
    const g = normalizeGroup(item);
    if (g.id) groups.push(g);
  }
  return { built: str(o.built) ?? '', groups };
}
