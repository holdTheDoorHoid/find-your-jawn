import type { Store } from './storage';

// The "My list" data: which groups a visitor saved in this browser. Nothing here leaves the
// device. Shared links carry group ids only, never anything from this list.

export const SAVED_KEY = 'saved';
export const SAVED_EVENT = 'fyj:saved-changed';

export interface SavedItem {
  id: string;
  /** Date saved, as YYYY-MM-DD */
  at: string;
}

interface SavedFile {
  v: 1;
  items: SavedItem[];
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Read the saved list, ignoring anything malformed. Oldest first. */
export function readSaved(store: Store): SavedItem[] {
  const raw = store.getJSON<unknown>(SAVED_KEY, null);
  const list: unknown =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { items?: unknown }).items : raw;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: SavedItem[] = [];
  for (const entry of list) {
    const o = entry as Partial<SavedItem> | string | null;
    const id = typeof o === 'string' ? o : o && typeof o === 'object' ? o.id : undefined;
    if (!isValidId(id) || seen.has(id)) continue;
    seen.add(id);
    const at = typeof o === 'object' && o && typeof o.at === 'string' ? o.at : '';
    out.push({ id, at });
  }
  return out;
}

export function writeSaved(store: Store, items: SavedItem[]): boolean {
  const file: SavedFile = { v: 1, items };
  return store.setJSON(SAVED_KEY, file);
}

export function isSaved(store: Store, id: string): boolean {
  return readSaved(store).some((s) => s.id === id);
}

/** Add the group if it is not saved, remove it if it is. Returns true when it is now saved. */
export function toggleSaved(store: Store, id: string, now: Date = new Date()): boolean {
  if (!isValidId(id)) return false;
  const items = readSaved(store);
  const has = items.some((s) => s.id === id);
  const next = has ? items.filter((s) => s.id !== id) : [...items, { id, at: today(now) }];
  writeSaved(store, next);
  return !has;
}

export function removeSaved(store: Store, id: string): void {
  writeSaved(
    store,
    readSaved(store).filter((s) => s.id !== id),
  );
}

/** Text for the export file. */
export function exportSaved(items: SavedItem[]): string {
  const file = { app: 'find-your-jawn', kind: 'my-list', v: 1, items };
  return JSON.stringify(file, null, 2) + '\n';
}

export interface ImportResult {
  items: SavedItem[];
  /** Entries that were not valid group ids */
  rejected: number;
}

/** Read an exported file. Accepts our file, a bare array of ids, or an array of {id, at}. */
export function parseImport(text: string): ImportResult | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const list: unknown = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? (data as { items?: unknown }).items
      : undefined;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const items: SavedItem[] = [];
  let rejected = 0;
  for (const entry of list) {
    const id =
      typeof entry === 'string' ? entry : entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : null;
    if (!isValidId(id)) {
      rejected += 1;
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const at = entry && typeof entry === 'object' ? (entry as { at?: unknown }).at : undefined;
    items.push({ id, at: typeof at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : '' });
  }
  return { items, rejected };
}

/** Merge imported items into the current list. Existing entries win; order is kept. */
export function mergeSaved(current: SavedItem[], incoming: SavedItem[]): SavedItem[] {
  const have = new Set(current.map((s) => s.id));
  return [...current, ...incoming.filter((s) => !have.has(s.id))];
}
