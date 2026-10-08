// Browser storage helper. Every key starts with "fyj:". Every read and write is wrapped in
// try/catch, because storage can be blocked, full, or missing (private windows, strict settings,
// previews). When the browser refuses, values live in memory for the visit and `persistent`
// turns false so a page can say so.

export const PREFIX = 'fyj:';

/** The small part of the Storage interface we use. */
export interface Backend {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  /** Keys we know about, without the prefix. */
  keys(): string[];
  getJSON<T>(key: string, fallback: T): T;
  setJSON(key: string, value: unknown): boolean;
  /** Remove every fyj: key, in the browser and in memory. Returns how many were removed. */
  clearAll(): number;
  /** False once the browser has refused a read or a write. */
  readonly persistent: boolean;
}

export function createStore(getBackend: () => Backend | null | undefined): Store {
  const memory = new Map<string, string>();
  let persistent = true;

  function backend(): Backend | null {
    try {
      const b = getBackend();
      if (!b) {
        persistent = false;
        return null;
      }
      return b;
    } catch {
      persistent = false;
      return null;
    }
  }

  function full(key: string): string {
    return PREFIX + key;
  }

  const store: Store = {
    get(key) {
      const b = backend();
      if (b) {
        try {
          const v = b.getItem(full(key));
          if (v !== null) return v;
          // A value missing in storage may still be in memory if an earlier write was refused.
          return memory.get(key) ?? null;
        } catch {
          persistent = false;
        }
      }
      return memory.get(key) ?? null;
    },

    set(key, value) {
      const b = backend();
      if (b) {
        try {
          b.setItem(full(key), value);
          memory.delete(key);
          return true;
        } catch {
          persistent = false;
        }
      }
      memory.set(key, value);
      return false;
    },

    remove(key) {
      memory.delete(key);
      const b = backend();
      if (!b) return;
      try {
        b.removeItem(full(key));
      } catch {
        persistent = false;
      }
    },

    keys() {
      const found = new Set<string>(memory.keys());
      const b = backend();
      if (b) {
        try {
          for (let i = 0; i < b.length; i++) {
            const k = b.key(i);
            if (k && k.startsWith(PREFIX)) found.add(k.slice(PREFIX.length));
          }
        } catch {
          persistent = false;
        }
      }
      return [...found].sort();
    },

    getJSON<T>(key: string, fallback: T): T {
      const raw = store.get(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    setJSON(key, value) {
      let text: string;
      try {
        text = JSON.stringify(value);
      } catch {
        return false;
      }
      return store.set(key, text);
    },

    clearAll() {
      const keys = store.keys();
      for (const k of keys) store.remove(k);
      memory.clear();
      return keys.length;
    },

    get persistent() {
      return persistent;
    },
  };
  return store;
}

/** The store for the running page. Safe to import anywhere: nothing is touched until it is used. */
export const store: Store = createStore(() => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
});
