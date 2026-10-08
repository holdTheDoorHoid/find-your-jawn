import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { GroupCard } from '../components/GroupCard';
import type { BrowseConfig } from '../lib/browse-config';
import { fetchGroups } from '../lib/client-data';
import { formatDate } from '../lib/dates';
import {
  activeFilterCount,
  applyFilters,
  buildIndex,
  defaultDistrictLookup,
  emptyFilters,
  filtersFromParams,
  filtersToParams,
  hasAnyFilter,
  kindsInUse,
  languagesInUse,
  sortGroups,
  timesInUse,
  type FaithMode,
  type Filters,
  type IndexedGroup,
  type SortKey,
} from '../lib/filters';
import { fill } from '../lib/inline';
import { suggestGroupUrl } from '../lib/issues';
import { languageName } from '../lib/language';
import { withBase } from '../lib/site';
import { prettify, titleCase } from '../lib/text';
import { DAYS, type CostLevel, type Group } from '../lib/types';
import { browse as t, labels } from '../strings/en';

const PAGE = 30;

type Status = 'loading' | 'ready' | 'error';

interface Props {
  config: BrowseConfig;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: ComponentChildren }) {
  return (
    <label class="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <span>{children}</span>
    </label>
  );
}

function Switch({ checked, onChange, label, help }: { checked: boolean; onChange: (on: boolean) => void; label: string; help?: string }) {
  return (
    <label class="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <span>
        {label}
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ComponentChildren }) {
  return (
    <details open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

function readUrl(): { filters: Filters; sort: SortKey | null } {
  try {
    return filtersFromParams(new URLSearchParams(window.location.search));
  } catch {
    return { filters: emptyFilters(), sort: null };
  }
}

export default function BrowseApp({ config }: Props) {
  const initial = useMemo(readUrl, []);
  const [status, setStatus] = useState<Status>('loading');
  const [groups, setGroups] = useState<Group[]>([]);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [sort, setSort] = useState<SortKey | null>(initial.sort);
  const [qInput, setQInput] = useState(initial.filters.q);
  const [shown, setShown] = useState(PAGE);
  const [panelOpen, setPanelOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const focusFrom = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load the data once (and again when the visitor presses Try again).
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchGroups(config.dataVersion)
      .then((res) => {
        if (cancelled) return;
        setGroups(res.groups);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [config.dataVersion, attempt]);

  // Search box: wait a moment after typing before filtering.
  useEffect(() => {
    if (qInput === filters.q) return;
    const id = window.setTimeout(() => setFilters((f) => ({ ...f, q: qInput })), 160);
    return () => window.clearTimeout(id);
  }, [qInput, filters.q]);

  // Keep the address in step with the filters so a view can be shared.
  useEffect(() => {
    try {
      const params = filtersToParams(filters, sort);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // address bar updates are a nicety
    }
  }, [filters, sort]);

  // Go back to the first page of results whenever the list changes.
  useEffect(() => {
    setShown(PAGE);
  }, [filters, sort]);

  const regionOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of config.regions) for (const d of r.districts) m.set(d.id, r.id);
    return m;
  }, [config]);

  const index = useMemo<IndexedGroup[]>(
    () =>
      buildIndex(groups, {
        labelOf: (id) => config.labels[id] ?? prettify(id),
        district: defaultDistrictLookup(regionOf),
      }),
    [groups, config, regionOf],
  );

  const options = useMemo(
    () => ({
      languages: languagesInUse(groups),
      times: timesInUse(groups),
      kinds: kindsInUse(groups),
    }),
    [groups],
  );

  const effectiveSort: SortKey = sort ?? (filters.q.trim() ? 'best' : 'az');

  const results = useMemo(() => sortGroups(applyFilters(index, filters), effectiveSort, filters.q), [index, filters, effectiveSort]);

  const familyLabel = (id: string) => config.families.find((f) => f.id === id)?.label ?? prettify(id);
  const areaLabel = (): string | null => {
    if (filters.district) {
      for (const r of config.regions) {
        const d = r.districts.find((x) => x.id === filters.district);
        if (d) return d.label;
      }
      return titleCase(filters.district);
    }
    if (filters.region) return config.regions.find((r) => r.id === filters.region)?.label ?? titleCase(filters.region);
    return null;
  };

  // Active filter chips, each one removes itself.
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (filters.q.trim()) chips.push({ key: 'q', label: fill(t.chips.q, { value: filters.q.trim() }), remove: () => { setQInput(''); setFilters((f) => ({ ...f, q: '' })); } });
  for (const id of filters.families) chips.push({ key: `fam-${id}`, label: familyLabel(id), remove: () => setFilters((f) => ({ ...f, families: f.families.filter((x) => x !== id) })) });
  for (const id of filters.kinds) chips.push({ key: `kind-${id}`, label: labels.kind[id] ?? prettify(id), remove: () => setFilters((f) => ({ ...f, kinds: f.kinds.filter((x) => x !== id) })) });
  const area = areaLabel();
  if (area) chips.push({ key: 'area', label: fill(t.chips.area, { value: area }), remove: () => setFilters((f) => ({ ...f, region: '', district: '' })) });
  for (const c of filters.costs) chips.push({ key: `cost-${c}`, label: labels.cost[c] ?? c, remove: () => setFilters((f) => ({ ...f, costs: f.costs.filter((x) => x !== c) })) });
  for (const d of filters.days) chips.push({ key: `day-${d}`, label: labels.dayLong[d] ?? d, remove: () => setFilters((f) => ({ ...f, days: f.days.filter((x) => x !== d) })) });
  for (const x of filters.times) chips.push({ key: `time-${x}`, label: labels.time[x] ?? titleCase(x), remove: () => setFilters((f) => ({ ...f, times: f.times.filter((y) => y !== x) })) });
  const flagChips: [keyof Filters, string][] = [
    ['newcomers', t.chips.newcomers],
    ['kids', t.chips.kids],
    ['wheelchair', t.chips.wheelchair],
    ['online', t.chips.online],
    ['open', t.chips.open],
    ['hours', t.chips.hours],
    ['court', t.chips.court],
  ];
  for (const [k, label] of flagChips) if (filters[k] === true) chips.push({ key: k, label, remove: () => setFilters((f) => ({ ...f, [k]: false })) });
  if (filters.language) chips.push({ key: 'lang', label: fill(t.chips.language, { value: languageName(filters.language) }), remove: () => setFilters((f) => ({ ...f, language: '' })) });
  if (filters.faith === 'exclude') chips.push({ key: 'faith', label: t.chips.faithExclude, remove: () => setFilters((f) => ({ ...f, faith: 'include' })) });
  if (filters.faith === 'only') chips.push({ key: 'faith', label: t.chips.faithOnly, remove: () => setFilters((f) => ({ ...f, faith: 'include' })) });

  const activeCount = activeFilterCount(filters);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  function clearAll() {
    setQInput('');
    setFilters(emptyFilters());
    setSort(null);
  }

  function showMore() {
    focusFrom.current = shown;
    setShown((n) => n + PAGE);
  }

  useEffect(() => {
    if (focusFrom.current === null) return;
    const start = focusFrom.current;
    focusFrom.current = null;
    const el = listRef.current?.querySelectorAll(':scope > li')[start]?.querySelector('a');
    if (el instanceof HTMLElement) el.focus();
  }, [shown]);

  const areaValue = filters.district ? `d:${filters.district}` : filters.region ? `r:${filters.region}` : '';

  const visible = results.slice(0, shown);
  const remaining = results.length - visible.length;

  return (
    <div class="browse">
      <div class="browse__search search-row">
        <div class="grow">
          <label for="browse-q">{t.searchLabel}</label>
          <input
            id="browse-q"
            type="search"
            value={qInput}
            placeholder={t.searchPlaceholder}
            autocomplete="off"
            spellcheck={false}
            enterkeyhint="search"
            onInput={(e) => setQInput((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="sort">
          <label for="browse-sort">{t.sort}</label>
          <select id="browse-sort" value={effectiveSort} onChange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortKey)}>
            {filters.q.trim() && <option value="best">{t.sortBest}</option>}
            <option value="az">{t.sortAZ}</option>
            <option value="recent">{t.sortRecent}</option>
          </select>
        </div>
      </div>

      <div class="browse__filters">
        <button
          type="button"
          class="btn btn--quiet filters-toggle"
          aria-expanded={panelOpen}
          aria-controls="filters"
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? t.filtersHide : t.filtersShow}
          {activeCount > 0 ? ` (${fill(t.activeCount, { n: activeCount })})` : ''}
        </button>

        <form class={panelOpen ? 'filters is-open' : 'filters'} id="filters" aria-label={t.filters} onSubmit={(e) => e.preventDefault()}>
          <Section title={t.f.interest} open={true}>
            <fieldset>
              <legend class="sr-only">{t.f.interest}</legend>
              <div class="check-row">
                {config.families.map((f) => (
                  <Check key={f.id} checked={filters.families.includes(f.id)} onChange={() => set({ families: toggle(filters.families, f.id) })}>
                    {f.icon && <span aria-hidden="true">{f.icon}</span>}
                    {f.label}
                  </Check>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>{t.f.kind}</legend>
              <div class="check-row">
                {options.kinds.map((k) => (
                  <Check key={k} checked={filters.kinds.includes(k)} onChange={() => set({ kinds: toggle(filters.kinds, k) })}>
                    {labels.kind[k] ?? prettify(k)}
                  </Check>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section title={t.f.area} open={Boolean(filters.region || filters.district)}>
            <label for="f-area" class="sr-only">{t.f.area}</label>
            <select
              id="f-area"
              value={areaValue}
              onChange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value;
                if (v.startsWith('d:')) set({ district: v.slice(2), region: '' });
                else if (v.startsWith('r:')) set({ region: v.slice(2), district: '' });
                else set({ region: '', district: '' });
              }}
            >
              <option value="">{t.f.areaAll}</option>
              {config.regions.map((r) => (
                <optgroup key={r.id} label={r.label}>
                  <option value={`r:${r.id}`}>{fill(t.f.areaRegion, { region: r.label })}</option>
                  {r.districts.map((d) => (
                    <option key={d.id} value={`d:${d.id}`}>{d.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p class="help">{t.f.areaNote}</p>
          </Section>

          <Section title={t.f.cost} open={filters.costs.length > 0}>
            <fieldset>
              <legend class="sr-only">{t.f.cost}</legend>
              <div class="check-row">
                {(['free', 'low', 'paid'] as CostLevel[]).map((c) => (
                  <Check key={c} checked={filters.costs.includes(c)} onChange={() => set({ costs: toggle(filters.costs, c) })}>
                    {labels.cost[c]}
                  </Check>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section title={t.f.days} open={filters.days.length > 0 || filters.times.length > 0}>
            <fieldset>
              <legend>{t.f.days}</legend>
              <div class="check-row">
                {DAYS.map((d) => (
                  <Check key={d} checked={filters.days.includes(d)} onChange={() => set({ days: toggle(filters.days, d) })}>
                    <span class="sr-only">{labels.dayLong[d]}</span>
                    <span aria-hidden="true">{labels.dayShort[d]}</span>
                  </Check>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>{t.f.times}</legend>
              <div class="check-row">
                {options.times.map((x) => (
                  <Check key={x} checked={filters.times.includes(x)} onChange={() => set({ times: toggle(filters.times, x) })}>
                    {labels.time[x] ?? titleCase(x)}
                  </Check>
                ))}
              </div>
            </fieldset>
            <p class="help">{t.f.scheduleNote}</p>
          </Section>

          <Section title={t.f.people} open={filters.newcomers || filters.kids || filters.wheelchair || filters.online || filters.open || Boolean(filters.language)}>
            <div class="switch-list">
              <Switch checked={filters.newcomers} onChange={(on) => set({ newcomers: on })} label={t.f.newcomers} help={t.f.newcomersHelp} />
              <Switch checked={filters.kids} onChange={(on) => set({ kids: on })} label={t.f.kids} />
              <Switch checked={filters.wheelchair} onChange={(on) => set({ wheelchair: on })} label={t.f.wheelchair} help={t.f.wheelchairHelp} />
              <Switch checked={filters.online} onChange={(on) => set({ online: on })} label={t.f.online} />
              <Switch checked={filters.open} onChange={(on) => set({ open: on })} label={t.f.open} help={t.f.openHelp} />
            </div>
            <div style="margin: 0.75rem 0 1rem">
              <label for="f-lang">{t.f.language}</label>
              <select id="f-lang" value={filters.language} onChange={(e) => set({ language: (e.currentTarget as HTMLSelectElement).value })}>
                <option value="">{t.f.languageAll}</option>
                {options.languages.map((l) => (
                  <option key={l} value={l}>{languageName(l)}</option>
                ))}
              </select>
            </div>
          </Section>

          <Section title={t.f.hours} open={filters.hours || filters.court}>
            <div class="switch-list">
              <Switch checked={filters.hours} onChange={(on) => set({ hours: on })} label={t.f.hoursForms} />
              <Switch checked={filters.court} onChange={(on) => set({ court: on })} label={t.f.court} />
            </div>
          </Section>

          <Section title={t.f.faith} open={filters.faith !== 'include'}>
            <fieldset>
              <legend class="sr-only">{t.f.faith}</legend>
              <div class="switch-list">
                {(
                  [
                    ['include', t.f.faithInclude],
                    ['exclude', t.f.faithExclude],
                    ['only', t.f.faithOnly],
                  ] as [FaithMode, string][]
                ).map(([value, label]) => (
                  <label class="switch" key={value}>
                    <input type="radio" name="faith" checked={filters.faith === value} onChange={() => set({ faith: value })} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>

          {hasAnyFilter(filters) && (
            <p>
              <button type="button" class="btn btn--quiet btn--small" onClick={clearAll}>{t.clearAll}</button>
            </p>
          )}
        </form>
      </div>

      <section class="browse__results" aria-labelledby="results-title">
        <h2 id="results-title" class="sr-only">{t.resultsHeading}</h2>

        {chips.length > 0 && (
          <ul class="active-chips">
            {chips.map((c) => (
              <li key={c.key}>
                <button type="button" class="chip-btn" aria-label={fill(t.clearOne, { label: c.label })} onClick={c.remove}>
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {status === 'loading' && <p role="status">{t.loading}</p>}

        {status === 'error' && (
          <div class="empty" role="alert">
            <p>{t.loadError}</p>
            <button type="button" class="btn" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p class="result-count" role="status" aria-live="polite">
              {results.length === 0
                ? t.countNone
                : results.length === 1
                  ? t.countOne
                  : fill(t.count, { shown: visible.length.toLocaleString('en-US'), total: results.length.toLocaleString('en-US') })}
            </p>

            {results.length === 0 ? (
              <div class="empty">
                <p><strong>{t.none}</strong> {t.noneHelp}</p>
                <p>
                  <button type="button" class="btn btn--quiet btn--small" onClick={clearAll}>{t.clearAll}</button>
                </p>
                <p>
                  <a href={suggestGroupUrl()} rel="noopener noreferrer">{t.noneSuggest}</a>
                </p>
              </div>
            ) : (
              <ul class="group-list" ref={listRef}>
                {visible.map((e) => (
                  <li key={e.g.id}>
                    <GroupCard group={e.g} places={config.places} />
                  </li>
                ))}
              </ul>
            )}

            {remaining > 0 && (
              <p class="more">
                <button type="button" class="btn btn--secondary" onClick={showMore}>
                  {fill(t.showMore, { n: Math.min(PAGE, remaining) })}
                </button>
              </p>
            )}

            <p class="help">{t.shareHint}{config.built ? ` ${fill(t.data.updated, { date: formatDate(config.built) ?? config.built })}.` : ''}</p>
            <p class="muted">
              {t.supportNote} <a href={withBase('support/')}>{t.supportLink}</a>.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
