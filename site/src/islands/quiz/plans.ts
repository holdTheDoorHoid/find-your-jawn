import type { Store } from '../../lib/storage';
import { parseDate, parseTime } from '../../lib/plan-dates';

// Planned visits and check ins. Kept only in this browser, under the key "plans". The group's name
// is kept with the plan so the "Did you go?" card never needs to download the list of groups.

export const PLANS_KEY = 'plans';
export const PLANS_EVENT = 'fyj:plans-changed';

export type CheckInStatus = 'planned' | 'went' | 'not_yet' | 'dismissed';
export type Outcome = 'loved' | 'okay' | 'not_for_me';
export type Obstacle = 'time' | 'nerves' | 'cost' | 'no_reply';

export interface PlannedVisit {
  /** the group's id */
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  /** when the plan was made, YYYY-MM-DD */
  made: string;
  status: CheckInStatus;
  outcome?: Outcome;
  obstacle?: Obstacle;
}

interface PlansFile {
  v: 1;
  items: PlannedVisit[];
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;

function one<T extends string>(x: unknown, allowed: readonly T[]): T | undefined {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : undefined;
}

/** Read the plans, ignoring anything malformed. Newest plan last. */
export function readPlans(store: Store): PlannedVisit[] {
  const raw = store.getJSON<unknown>(PLANS_KEY, null);
  const list: unknown = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(list)) return [];
  const out: PlannedVisit[] = [];
  for (const e of list) {
    const o = e as Partial<PlannedVisit> | null;
    if (!o || typeof o !== 'object') continue;
    if (typeof o.id !== 'string' || !ID_RE.test(o.id)) continue;
    if (typeof o.name !== 'string' || o.name.length === 0 || o.name.length > 200) continue;
    if (typeof o.date !== 'string' || !parseDate(o.date)) continue;
    const time = typeof o.time === 'string' && parseTime(o.time) ? o.time : '10:00';
    out.push({
      id: o.id,
      name: o.name,
      date: o.date,
      time,
      made: typeof o.made === 'string' && parseDate(o.made) ? o.made : o.date,
      status: one(o.status, ['planned', 'went', 'not_yet', 'dismissed'] as const) ?? 'planned',
      outcome: one(o.outcome, ['loved', 'okay', 'not_for_me'] as const),
      obstacle: one(o.obstacle, ['time', 'nerves', 'cost', 'no_reply'] as const),
    });
  }
  return out.slice(-100);
}

export function writePlans(store: Store, items: PlannedVisit[]): boolean {
  const file: PlansFile = { v: 1, items: items.slice(-100) };
  const ok = store.setJSON(PLANS_KEY, file);
  try {
    window.dispatchEvent(new Event(PLANS_EVENT));
  } catch {
    // not in a browser, or an old one: the plan is still saved
  }
  return ok;
}

/** Add a plan. A second plan for the same group and day replaces the first. */
export function addPlan(store: Store, plan: PlannedVisit): boolean {
  const rest = readPlans(store).filter((p) => !(p.id === plan.id && p.date === plan.date));
  return writePlans(store, [...rest, plan]);
}

export function updatePlan(store: Store, id: string, date: string, patch: Partial<PlannedVisit>): void {
  writePlans(
    store,
    readPlans(store).map((p) => (p.id === id && p.date === date ? { ...p, ...patch } : p)),
  );
}

/**
 * Plans whose day has passed and that nobody has answered yet. The most recent is first, because
 * that is the visit the person is most likely to remember. Today does not count: the card appears on
 * a later visit.
 */
export function dueCheckIns(plans: PlannedVisit[], today: string): PlannedVisit[] {
  return plans
    .filter((p) => p.status === 'planned' && p.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Plans still ahead of the person (today or later). */
export function upcoming(plans: PlannedVisit[], today: string): PlannedVisit[] {
  return plans.filter((p) => p.status === 'planned' && p.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
}
