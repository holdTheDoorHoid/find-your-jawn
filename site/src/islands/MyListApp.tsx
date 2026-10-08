import { useEffect, useRef, useState } from 'preact/hooks';
import { GroupCard } from '../components/GroupCard';
import { fetchGroups } from '../lib/client-data';
import { formatDate } from '../lib/dates';
import { fill } from '../lib/inline';
import {
  exportSaved,
  mergeSaved,
  parseImport,
  readSaved,
  removeSaved,
  SAVED_EVENT,
  writeSaved,
  type SavedItem,
} from '../lib/saved';
import { withBase } from '../lib/site';
import { store } from '../lib/storage';
import type { Group } from '../lib/types';
import { myList as t } from '../strings/en';
import ForgetPanel from './ForgetPanel';
import PlannedVisits from './PlannedVisits';

interface Props {
  dataVersion: string;
  places?: Record<string, string>;
}

type Load = 'idle' | 'loading' | 'ready' | 'error';

function notify() {
  try {
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {
    // fine
  }
}

export default function MyListApp({ dataVersion, places }: Props) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [byId, setById] = useState<Map<string, Group>>(new Map());
  const [load, setLoad] = useState<Load>('idle');
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Read the list now, and again whenever another tab or button changes it.
  useEffect(() => {
    const sync = () => {
      setItems(readSaved(store));
      setBlocked(!store.persistent);
      setReady(true);
    };
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Only download the group data when there is something to show.
  useEffect(() => {
    if (items.length === 0 || load !== 'idle') return;
    let cancelled = false;
    setLoad('loading');
    fetchGroups(dataVersion)
      .then((res) => {
        if (cancelled) return;
        setById(new Map(res.groups.map((g) => [g.id, g])));
        setLoad('ready');
      })
      .catch(() => {
        if (!cancelled) setLoad('error');
      });
    return () => {
      cancelled = true;
    };
  }, [items.length, load, dataVersion]);

  function remove(id: string) {
    removeSaved(store, id);
    setItems(readSaved(store));
    setBlocked(!store.persistent);
    setMessage('');
    notify();
  }

  function download() {
    try {
      const blob = new Blob([exportSaved(items)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'find-your-jawn-my-list.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setMessage(t.loadError);
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImport(text);
      if (!parsed) {
        setMessage(t.importBad);
      } else {
        const current = readSaved(store);
        const merged = mergeSaved(current, parsed.items);
        const added = merged.length - current.length;
        writeSaved(store, merged);
        setItems(readSaved(store));
        setBlocked(!store.persistent);
        notify();
        const parts: string[] = [];
        parts.push(added > 0 ? fill(t.importDone, { n: added }) : t.importNone);
        if (parsed.rejected > 0) parts.push(fill(t.importSkipped, { n: parsed.rejected }));
        setMessage(parts.join(' '));
      }
    } catch {
      setMessage(t.importBad);
    }
    input.value = '';
  }

  const count = items.length === 1 ? t.countOne : fill(t.count, { n: items.length });

  return (
    <div>
      {blocked && <p class="callout" role="alert">{t.blocked}</p>}

      <PlannedVisits />

      {!ready && <p role="status">{t.loading}</p>}

      {ready && items.length === 0 && (
        <div class="empty">
          <p><strong>{t.empty}</strong></p>
          <p>{t.emptyHelp}</p>
          <p>
            <a class="btn" href={withBase('browse/')}>{t.emptyActions}</a>
          </p>
        </div>
      )}

      {ready && items.length > 0 && (
        <>
          <p class="result-count" role="status">{count}</p>
          {load === 'loading' && <p class="help">{t.loading}</p>}
          {load === 'error' && <p class="callout">{t.loadError}</p>}
          <ul class="saved-list">
            {items.map((s) => {
              const g = byId.get(s.id);
              const saved = formatDate(s.at);
              return (
                <li key={s.id}>
                  <div class="saved-item">
                    {g ? (
                      <GroupCard group={g} places={places} headingLevel={2} />
                    ) : load === 'ready' ? (
                      <div class="gcard">
                        <p class="kind">{s.id}</p>
                        <p>{t.gone}</p>
                      </div>
                    ) : (
                      <div class="gcard">
                        <p class="kind">{s.id}</p>
                      </div>
                    )}
                    <div class="btn-row">
                      <button
                        type="button"
                        class="btn btn--quiet btn--small"
                        aria-label={fill(t.removeLabel, { name: g?.name ?? s.id })}
                        onClick={() => remove(s.id)}
                      >
                        {t.remove}
                      </button>
                      {saved && <span class="help">{fill(t.savedOn, { date: saved })}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <section class="tools" aria-labelledby="tools-title">
        <h2 id="tools-title">{t.export}</h2>
        <p class="help">{t.exportHelp}</p>
        <p>
          <button type="button" class="btn btn--quiet" onClick={download} disabled={items.length === 0}>
            {t.export}
          </button>
        </p>
        <h2>{t.import}</h2>
        <p class="help">{t.importHelp}</p>
        <p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            aria-label={t.import}
            onChange={onFile}
          />
        </p>
        <p class="status" role="status">{message}</p>
      </section>

      <section class="tools">
        <ForgetPanel />
      </section>
    </div>
  );
}
