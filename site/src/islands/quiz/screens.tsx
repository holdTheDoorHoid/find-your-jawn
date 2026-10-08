import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { isKnownZip, type Catalog } from '../../engine/catalog';
import type { Answers, Budget, FaithMode, Frequency, GroupSizePref, MeetWith, PathId, TravelMode } from '../../engine/types';
import { fill } from '../../lib/inline';
import type { QuizConfig } from '../../lib/quiz-config';
import { withBase } from '../../lib/site';
import { DAYS } from '../../lib/types';
import { labels, quiz as t } from '../../strings/en';
import { AGE_BANDS, bandOf, shuffle } from './state';
import { Choices, Frame, Group, LockSwitch, Nav, Pill, PickCard, PrivacyNote, Switch } from './widgets';

// The question screens. Every answer is written to the saved answers the moment it changes, so Back
// and Next never lose anything, and every question can be skipped.

export interface ScreenProps {
  a: Answers;
  set: (patch: Partial<Answers>) => void;
  cfg: QuizConfig;
  cat: Catalog;
  seed: number;
  /** the heading takes focus after the person has moved, not on the first load */
  grabFocus: boolean;
  canBack: boolean;
  onBack: () => void;
  onNext: () => void;
}

function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  const without = list.filter((x) => x !== value);
  return on ? [...without, value] : without;
}

function Screen({
  id,
  title,
  help,
  p,
  answered,
  children,
  nextLabel,
}: {
  id: string;
  title: string;
  help?: string;
  p: ScreenProps;
  answered: boolean;
  children: ComponentChildren;
  nextLabel?: string;
}) {
  return (
    <Frame title={title} help={help} focusKey={id} grabFocus={p.grabFocus}>
      {children}
      <Nav onBack={p.onBack} onNext={p.onNext} answered={answered} canBack={p.canBack} nextLabel={nextLabel} />
    </Frame>
  );
}

// ---------------------------------------------------------------- start and the paths

const START_ICONS: Record<string, string> = { explore: '🔎', hours: '🎓', court: '⚖️', newcomer: '🏙️', student: '📚', kids: '👶', support: '🤝' };
const START_ORDER: (PathId | 'support')[] = ['explore', 'hours', 'court', 'newcomer', 'student', 'kids', 'support'];

export function StartScreen(p: ScreenProps & { support: boolean; setSupport: (on: boolean) => void }) {
  const { a, support, setSupport } = p;
  const only = support && a.paths.filter((x) => x !== 'explore').length === 0;
  const pick = (id: PathId | 'support', on: boolean) => {
    if (id === 'support') {
      setSupport(on);
      return;
    }
    if (id === 'explore') p.set({ paths: on ? ['explore'] : [] });
    else p.set({ paths: toggle(a.paths.filter((x) => x !== 'explore'), id, on) });
  };
  return (
    <Frame title={t.start.title} help={t.start.help} focusKey="start" grabFocus={p.grabFocus}>
      <div class="pick-grid pick-grid--one" role="group" aria-label={t.start.title}>
        {START_ORDER.map((id) => (
          <PickCard
            key={id}
            icon={START_ICONS[id]}
            label={t.start.options[id]}
            checked={id === 'support' ? support : a.paths.includes(id)}
            onChange={(on) => pick(id, on)}
          />
        ))}
      </div>
      {support && (
        <div class="callout" role="status">
          <h3>{t.start.supportTitle}</h3>
          <p>{t.start.supportText}</p>
          <PrivacyNote>{t.start.supportPrivacy}</PrivacyNote>
          <p>
            <a class="btn" href={withBase('support/')}>
              {t.start.supportCta}
            </a>
          </p>
        </div>
      )}
      <div class="qnav qnav--end">
        <button type="button" class={`btn${a.paths.length > 0 || support ? '' : ' btn--secondary'}`} onClick={only ? () => (window.location.href = withBase('support/')) : p.onNext}>
          {only ? t.start.supportCta : a.paths.length > 0 ? t.next : t.skip}
        </button>
      </div>
    </Frame>
  );
}

const HOURS = [10, 20, 30, 40, 50, 60, 100];
const COURT_HOURS = [20, 40, 60, 80, 100, 200];

export function HoursScreen(p: ScreenProps) {
  const { a } = p;
  const hours = a.hours ?? {};
  const age = a.age && a.age.lo === a.age.hi && a.age.lo <= 17 ? a.age.lo : undefined;
  const ageChoice: number | 'adult' | undefined = age ?? (a.age && a.age.lo >= 18 ? 'adult' : undefined);
  const form = hours.form === true ? 'yes' : hours.form === false ? 'no' : undefined;
  return (
    <Screen id="hours" title={t.hours.title} help={t.hours.help} p={p} answered={age !== undefined || hours.need !== undefined || hours.form !== undefined}>
      <Choices
        legend={t.hours.age}
        name="hours-age"
        value={ageChoice}
        options={[...[13, 14, 15, 16, 17].map((n) => ({ value: n as number | 'adult', label: String(n) })), { value: 'adult' as const, label: t.hours.age18 }]}
        onChange={(v) => p.set({ age: v === 'adult' ? undefined : { lo: v, hi: v } })}
      />
      <Choices
        legend={t.hours.need}
        name="hours-need"
        value={hours.need ?? (hours.need === undefined && 'form' in hours && hours.form === undefined ? undefined : undefined)}
        options={HOURS.map((n) => ({ value: n, label: String(n) }))}
        onChange={(v) => p.set({ hours: { ...hours, need: v } })}
      />
      <Choices
        legend={t.hours.form}
        help={t.hours.tip}
        name="hours-form"
        value={form}
        options={[
          { value: 'yes', label: t.hours.formYes },
          { value: 'no', label: t.hours.formNo },
        ]}
        onChange={(v) => p.set({ hours: { ...hours, form: v === 'yes' } })}
      />
    </Screen>
  );
}

export function CourtScreen(p: ScreenProps) {
  const { a } = p;
  const court = a.court ?? {};
  return (
    <Screen id="court" title={t.court.title} help={t.court.help} p={p} answered={court.need !== undefined || court.noChildren !== undefined}>
      <Choices
        legend={t.court.need}
        name="court-need"
        value={court.need}
        options={COURT_HOURS.map((n) => ({ value: n, label: String(n) }))}
        onChange={(v) => p.set({ court: { ...court, need: v } })}
      />
      <Choices
        legend={t.court.restrictions}
        name="court-restrict"
        value={court.noChildren === true ? 'children' : court.noChildren === false ? 'none' : undefined}
        options={[
          { value: 'children', label: t.court.noChildren },
          { value: 'none', label: t.court.nothing },
        ]}
        onChange={(v) => p.set({ court: { ...court, noChildren: v === 'children' } })}
      />
      <p class="help">{t.court.confirm}</p>
      <p>
        <a href={withBase('paths/court-ordered/')}>{t.court.guide}</a>
      </p>
    </Screen>
  );
}

const KID_AGES = [0, 1, 3, 5, 8, 13];

export function KidsScreen(p: ScreenProps) {
  const ages = p.a.kidsAges ?? [];
  return (
    <Screen id="kids" title={t.kids.title} help={t.kids.help} p={p} answered={ages.length > 0}>
      <Group legend={t.kids.title}>
        {KID_AGES.map((n) => (
          <Pill key={n} checked={ages.includes(n)} onChange={(on) => p.set({ kidsAges: toggle(ages, n, on).sort((x, y) => x - y) })}>
            {t.kids.ages[n]}
          </Pill>
        ))}
      </Group>
    </Screen>
  );
}

export function NewcomerScreen(p: ScreenProps) {
  return (
    <Screen id="newcomer" title={t.newcomer.title} help={t.newcomer.help} p={p} answered={p.a.newSince !== undefined}>
      <Choices
        legend={t.newcomer.title}
        name="since"
        value={p.a.newSince}
        options={(['weeks', 'months', 'year', 'years'] as const).map((v) => ({ value: v, label: t.newcomer.options[v] }))}
        onChange={(v) => p.set({ newSince: v })}
      />
    </Screen>
  );
}

export function StudentScreen(p: ScreenProps) {
  const schools = Object.entries(labels.school);
  return (
    <Screen id="student" title={t.student.title} help={t.student.help} p={p} answered={p.a.school !== undefined}>
      <label for="school-pick">{t.student.label}</label>
      <select id="school-pick" value={p.a.school ?? ''} onChange={(e) => p.set({ school: (e.currentTarget as HTMLSelectElement).value || undefined })}>
        <option value="">{t.student.none}</option>
        {schools.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
        <option value="other">{t.student.other}</option>
      </select>
    </Screen>
  );
}

// ---------------------------------------------------------------- stage 1: picture it

function SceneGrid({ p, ids, field, id, title, help }: { p: ScreenProps; ids: string[]; field: 'scenes' | 'moments'; id: string; title: string; help: string }) {
  const defs = ids.map((x) => p.cat.sceneById.get(x)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const order = shuffle(defs, p.seed, id);
  const picked = p.a[field];
  const otherField = field;
  return (
    <Screen id={id} title={title} help={help} p={p} answered={picked.length > 0}>
      <div class="pick-grid" role="group" aria-label={title}>
        {order.map((s) => (
          <PickCard
            key={s.id}
            icon={s.icon}
            label={s.text}
            checked={picked.includes(s.id)}
            onChange={(on) => p.set({ [otherField]: toggle(picked, s.id, on) } as Partial<Answers>)}
          />
        ))}
      </div>
      <p class="help" aria-live="polite">
        {picked.length > 0 ? fill(t.pickedCount, { n: picked.length }) : ''}
      </p>
    </Screen>
  );
}

export function ScenesScreen(p: ScreenProps) {
  const ids = p.cfg.scenes.map((s) => s.id);
  return <SceneGrid p={p} ids={ids} field="scenes" id="scenes" title={t.scenes.title} help={t.scenes.help} />;
}

export function ScenesMoreScreen(p: ScreenProps) {
  const ids = p.cfg.extraScenes.map((s) => s.id);
  return <SceneGrid p={p} ids={ids} field="scenes" id="scenes_more" title={t.scenes.moreTitle} help={t.scenes.moreHelp} />;
}

export function MomentsScreen(p: ScreenProps) {
  const ids = p.cfg.moments.map((s) => s.id);
  const defs = ids.map((x) => p.cat.sceneById.get(x)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const order = shuffle(defs, p.seed, 'moments');
  const picked = p.a.moments;
  return (
    <Screen id="moments" title={t.moments.title} help={t.moments.help} p={p} answered={picked.length > 0 || Boolean(p.a.words?.trim())}>
      <div class="pick-grid" role="group" aria-label={t.moments.title}>
        {order.map((s) => (
          <PickCard key={s.id} icon={s.icon} label={s.text} checked={picked.includes(s.id)} onChange={(on) => p.set({ moments: toggle(picked, s.id, on) })} />
        ))}
      </div>
      <div class="qfield">
        <label for="moment-words">{t.moments.words}</label>
        <input id="moment-words" type="text" maxLength={120} autocomplete="off" value={p.a.words ?? ''} aria-describedby="moment-words-help" onInput={(e) => p.set({ words: (e.currentTarget as HTMLInputElement).value })} />
        <p class="help" id="moment-words-help">
          {t.moments.wordsHelp}
        </p>
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------- stage 2: deal breakers

const TIMES = ['morning', 'afternoon', 'evening', 'night'];

export function WhenScreen(p: ScreenProps) {
  const w = p.a.when ?? { days: [], times: [], flexible: false, locked: false };
  const upd = (patch: Partial<typeof w>) => p.set({ when: { ...w, ...patch } });
  const answered = w.flexible || w.days.length > 0 || w.times.length > 0;
  return (
    <Screen id="when" title={t.when.title} help={t.when.help} p={p} answered={answered}>
      <Group legend={t.when.days}>
        {DAYS.map((d) => (
          <Pill key={d} disabled={w.flexible} checked={w.days.includes(d)} onChange={(on) => upd({ days: toggle(w.days, d, on) })}>
            {labels.dayLong[d]}
          </Pill>
        ))}
      </Group>
      <Group legend={t.when.times}>
        {TIMES.map((x) => (
          <Pill key={x} disabled={w.flexible} checked={w.times.includes(x)} onChange={(on) => upd({ times: toggle(w.times, x, on) })}>
            {labels.time[x]}
          </Pill>
        ))}
      </Group>
      <Switch id="flexible" checked={w.flexible} onChange={(on) => upd({ flexible: on, locked: on ? false : w.locked })} label={t.when.flexible} help={t.when.flexibleHelp} />
      {answered && !w.flexible && <LockSwitch id="when-lock" locked={w.locked} onChange={(locked) => upd({ locked })} />}
    </Screen>
  );
}

export function OftenScreen(p: ScreenProps) {
  const o = p.a.often;
  return (
    <Screen id="often" title={t.often.title} help={t.often.help} p={p} answered={o !== undefined}>
      <Choices
        legend={t.often.title}
        name="often"
        value={o?.value}
        options={(['once', 'monthly', 'weekly', 'any'] as Frequency[]).map((v) => ({ value: v, label: t.often.options[v] }))}
        onChange={(v) => p.set({ often: { value: v, locked: o?.locked ?? false } })}
      />
      {o && o.value !== 'any' && <LockSwitch id="often-lock" locked={o.locked} onChange={(locked) => p.set({ often: { value: o.value, locked } })} />}
    </Screen>
  );
}

const MINUTES: Record<Exclude<TravelMode, 'anywhere'>, number[]> = { walk: [10, 20, 30], septa: [20, 30, 45, 60], drive: [15, 30, 45] };

export function FarScreen(p: ScreenProps) {
  const far = p.a.far;
  const place = p.a.place ?? {};
  const [zipText, setZipText] = useState(place.zip ?? '');
  const [zipBad, setZipBad] = useState(false);
  const mode = far?.mode;
  const moving = mode !== undefined && mode !== 'anywhere';
  const setMode = (m: TravelMode) => {
    const list = m === 'anywhere' ? [] : MINUTES[m];
    const keep = far && list.includes(far.minutes) ? far.minutes : (list[1] ?? 30);
    p.set({ far: { mode: m, minutes: keep, locked: far?.locked ?? false } });
  };
  const onZip = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 5);
    setZipText(digits);
    if (digits.length < 5) {
      setZipBad(false);
      p.set({ place: { ...place, zip: undefined } });
    } else if (isKnownZip(digits)) {
      setZipBad(false);
      p.set({ place: { zip: digits } });
    } else {
      setZipBad(true);
      p.set({ place: { ...place, zip: undefined } });
    }
  };
  const hasPlace = Boolean(place.hood || place.zip);
  return (
    <Screen id="far" title={t.far.title} help={t.far.help} p={p} answered={far !== undefined}>
      <Choices
        legend={t.far.mode}
        name="far-mode"
        value={mode}
        options={(['walk', 'septa', 'drive', 'anywhere'] as TravelMode[]).map((v) => ({ value: v, label: t.far.modes[v] }))}
        onChange={setMode}
      />
      {moving && far && (
        <>
          <Choices
            legend={t.far.minutes}
            name="far-minutes"
            value={far.minutes}
            options={MINUTES[mode as Exclude<TravelMode, 'anywhere'>].map((n) => ({ value: n, label: fill(t.far.minutesLabel, { n }) }))}
            onChange={(v) => p.set({ far: { ...far, minutes: v } })}
          />
          <fieldset class="qgroup">
            <legend>{t.far.place}</legend>
            <div class="qfield">
              <label for="hood-pick">{t.far.hood}</label>
              <select
                id="hood-pick"
                value={place.hood ?? ''}
                onChange={(e) => {
                  const v = (e.currentTarget as HTMLSelectElement).value;
                  setZipText('');
                  setZipBad(false);
                  p.set({ place: v ? { hood: v } : {} });
                }}
              >
                <option value="">{t.far.hoodPick}</option>
                {p.cfg.neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div class="qfield">
              <label for="zip-pick">{t.far.zip}</label>
              <input
                id="zip-pick"
                type="text"
                inputMode="numeric"
                autocomplete="postal-code"
                maxLength={5}
                value={zipText}
                aria-invalid={zipBad}
                aria-describedby="zip-help"
                onInput={(e) => onZip((e.currentTarget as HTMLInputElement).value)}
              />
              <p class="help" id="zip-help" role={zipBad ? 'alert' : undefined}>
                {zipBad ? t.far.zipBad : t.far.zipHelp}
              </p>
            </div>
          </fieldset>
          {hasPlace && <LockSwitch id="far-lock" locked={far.locked} onChange={(locked) => p.set({ far: { ...far, locked } })} />}
          <p class="help">{t.far.estimate}</p>
        </>
      )}
    </Screen>
  );
}

export function BudgetScreen(p: ScreenProps) {
  const b = p.a.budget;
  return (
    <Screen id="budget" title={t.budget.title} help={t.budget.help} p={p} answered={b !== undefined}>
      <Choices
        legend={t.budget.title}
        name="budget"
        value={b?.value}
        options={(['free', 'low', 'any'] as Budget[]).map((v) => ({ value: v, label: t.budget.options[v] }))}
        onChange={(v) => p.set({ budget: { value: v, locked: b?.locked ?? false } })}
      />
      {b && b.value !== 'any' && <LockSwitch id="budget-lock" locked={b.locked} onChange={(locked) => p.set({ budget: { value: b.value, locked } })} />}
    </Screen>
  );
}

export function RulesAScreen(p: ScreenProps) {
  const { a } = p;
  const langs = a.languages ?? { codes: [], locked: false };
  const wheel = a.wheelchair;
  const answered = a.age !== undefined || Boolean(wheel?.value) || langs.codes.length > 0;
  const teen = a.age && a.age.lo === a.age.hi && a.age.lo <= 17 && a.paths.includes('hours');
  return (
    <Screen id="rules_a" title={t.rulesA.title} help={t.rulesA.help} p={p} answered={answered}>
      {!teen && (
        <Choices
          legend={t.rulesA.age}
          help={t.rulesA.ageHelp}
          name="age"
          value={bandOf(a.age)}
          options={Object.keys(AGE_BANDS).map((k) => ({ value: k, label: t.rulesA.bands[k] ?? k }))}
          onChange={(v) => p.set({ age: AGE_BANDS[v] })}
        />
      )}
      <Switch
        id="wheelchair"
        checked={Boolean(wheel?.value)}
        onChange={(on) => p.set({ wheelchair: on ? { value: true, locked: true } : undefined })}
        label={t.rulesA.wheelchair}
      />
      {wheel?.value && <LockSwitch id="wheel-lock" locked={wheel.locked} onChange={(locked) => p.set({ wheelchair: { value: true, locked } })} />}
      <Group legend={t.rulesA.languages} help={t.rulesA.languagesHelp}>
        {p.cfg.languages.map((l) => (
          <Pill key={l.code} checked={langs.codes.includes(l.code)} onChange={(on) => p.set({ languages: { codes: toggle(langs.codes, l.code, on), locked: langs.locked } })}>
            {l.native && l.native !== l.label ? `${l.label} (${l.native})` : l.label}
          </Pill>
        ))}
      </Group>
      {langs.codes.length > 0 && <LockSwitch id="lang-lock" locked={langs.locked} onChange={(locked) => p.set({ languages: { codes: langs.codes, locked } })} />}
    </Screen>
  );
}

export function RulesBScreen(p: ScreenProps) {
  const { a } = p;
  const faith = a.faith;
  const bg = a.noBackgroundCheck;
  return (
    <Screen id="rules_b" title={t.rulesB.title} help={t.rulesB.help} p={p} answered={faith !== undefined || Boolean(bg?.value)}>
      <Choices
        legend={t.rulesB.faith}
        name="faith"
        value={faith?.mode}
        options={(['include', 'exclude', 'only'] as FaithMode[]).map((v) => ({ value: v, label: t.rulesB.faithOptions[v] }))}
        onChange={(v) => p.set({ faith: { mode: v, tradition: v === 'only' ? faith?.tradition : undefined } })}
      />
      {faith?.mode === 'only' && (
        <div class="qfield">
          <label for="tradition-pick">{t.rulesB.tradition}</label>
          <select id="tradition-pick" value={faith.tradition ?? ''} onChange={(e) => p.set({ faith: { mode: 'only', tradition: (e.currentTarget as HTMLSelectElement).value || undefined } })}>
            <option value="">{t.rulesB.traditionPick}</option>
            {p.cfg.faith.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <Switch id="bgcheck" checked={Boolean(bg?.value)} onChange={(on) => p.set({ noBackgroundCheck: on ? { value: true, locked: false } : undefined })} label={t.rulesB.background} help={t.rulesB.backgroundHelp} />
      {bg?.value && <LockSwitch id="bg-lock" locked={bg.locked} onChange={(locked) => p.set({ noBackgroundCheck: { value: true, locked } })} />}
      <PrivacyNote>{t.rulesB.privacy}</PrivacyNote>
    </Screen>
  );
}

// ---------------------------------------------------------------- stage 3: what you are into

export function InterestsScreen(p: ScreenProps) {
  const { a } = p;
  const families = shuffle(
    p.cfg.families.filter((f) => !f.supportOnly),
    p.seed,
    'families',
  );
  const set = (id: string, on: boolean) => {
    const picked = toggle(a.picked, id, on);
    const starred = a.starred.filter((s) => picked.includes(s));
    const tags = a.tags.filter((tag) => {
      const fam = p.cat.tagFamily.get(tag);
      return fam ? starred.includes(fam) : false;
    });
    p.set({ picked, starred, tags });
  };
  return (
    <Screen id="interests" title={t.interests.title} help={t.interests.help} p={p} answered={a.picked.length > 0}>
      <div class="pick-grid" role="group" aria-label={t.interests.title}>
        {families.map((f) => (
          <PickCard key={f.id} icon={f.icon} label={f.label} sub={f.blurb} checked={a.picked.includes(f.id)} onChange={(on) => set(f.id, on)} />
        ))}
      </div>
      <p class="help" aria-live="polite">
        {a.picked.length > 0 ? fill(t.pickedCount, { n: a.picked.length }) : ''}
      </p>
    </Screen>
  );
}

export function StarsScreen(p: ScreenProps) {
  const { a } = p;
  const picked = a.picked.map((id) => p.cat.familyById.get(id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const full = a.starred.length >= 3;
  const star = (id: string, on: boolean) => {
    const starred = toggle(a.starred, id, on);
    p.set({ starred, tags: a.tags.filter((tag) => starred.includes(p.cat.tagFamily.get(tag) ?? '')) });
  };
  return (
    <Screen id="stars" title={t.stars.title} help={t.stars.help} p={p} answered={a.starred.length > 0}>
      <div class="pick-grid" role="group" aria-label={t.stars.title}>
        {picked.map((f) => {
          const on = a.starred.includes(f.id);
          return (
            <label key={f.id} class={`pick${on ? ' is-on' : ''}${!on && full ? ' is-off' : ''}`}>
              <input type="checkbox" checked={on} disabled={!on && full} aria-label={fill(t.stars.starLabel, { name: f.label })} onChange={(e) => star(f.id, (e.currentTarget as HTMLInputElement).checked)} />
              <span class="pick__icon" aria-hidden="true">
                {f.icon}
              </span>
              <span class="pick__text">
                <span class="pick__label">{f.label}</span>
              </span>
              <span class="pick__star" aria-hidden="true">
                {on ? '★' : '☆'}
              </span>
            </label>
          );
        })}
      </div>
      <p class="help" aria-live="polite">
        {full ? t.stars.max : ''}
      </p>
    </Screen>
  );
}

export function TagsScreen(p: ScreenProps) {
  const { a } = p;
  const fams = a.starred.map((id) => p.cat.familyById.get(id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  return (
    <Screen id="tags" title={t.tags.title} help={t.tags.help} p={p} answered={a.tags.length > 0}>
      {fams.map((f) => (
        <Group key={f.id} legend={`${f.icon ?? ''} ${f.label}`.trim()}>
          {shuffle(f.tags, p.seed, `tags-${f.id}`).map((tag) => (
            <Pill key={tag.id} checked={a.tags.includes(tag.id)} onChange={(on) => p.set({ tags: toggle(a.tags, tag.id, on) })}>
              {tag.label}
            </Pill>
          ))}
        </Group>
      ))}
    </Screen>
  );
}

// ---------------------------------------------------------------- stage 4: why and who

function MotiveRows({ p, ids, most, least, onMost, onLeast, name }: { p: ScreenProps; ids: string[]; most?: string; least?: string; onMost: (id: string) => void; onLeast: (id: string) => void; name: string }) {
  const defs = ids.map((id) => p.cfg.motives.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const order = shuffle(defs, p.seed, name);
  return (
    <div class="motives">
      {order.map((m) => (
        <div class="motive" key={m.id} role="group" aria-label={m.label}>
          <p class="motive__label">{m.label}</p>
          <div class="check-row">
            <Pill type="radio" name={`${name}-most`} checked={most === m.id} onChange={(on) => on && onMost(m.id)}>
              {t.motives.most}
            </Pill>
            <Pill type="radio" name={`${name}-least`} checked={least === m.id} onChange={(on) => on && onLeast(m.id)}>
              {t.motives.least}
            </Pill>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Motives1Screen(p: ScreenProps) {
  const m = p.a.motives ?? {};
  const ids = p.cfg.motives.map((x) => x.id);
  const upd = (patch: Partial<NonNullable<Answers['motives']>>) => {
    const next = { ...m, ...patch };
    // One reason cannot be both most and least. Changing round one clears round two, which depends on it.
    p.set({ motives: { m1: next.m1, l1: next.l1, m2: patch.m1 !== undefined || patch.l1 !== undefined ? undefined : next.m2, l2: patch.m1 !== undefined || patch.l1 !== undefined ? undefined : next.l2 } });
  };
  return (
    <Screen id="motives1" title={t.motives.title} help={t.motives.help} p={p} answered={Boolean(m.m1 && m.l1)}>
      <MotiveRows
        p={p}
        name="motives1"
        ids={ids}
        most={m.m1}
        least={m.l1}
        onMost={(id) => upd({ m1: id, l1: m.l1 === id ? undefined : m.l1 })}
        onLeast={(id) => upd({ l1: id, m1: m.m1 === id ? undefined : m.m1 })}
      />
      <p class="help" aria-live="polite">
        {m.m1 && m.l1 ? '' : t.motives.pickBoth}
      </p>
    </Screen>
  );
}

export function Motives2Screen(p: ScreenProps) {
  const m = p.a.motives ?? {};
  const ids = p.cfg.motives.map((x) => x.id).filter((id) => id !== m.m1 && id !== m.l1);
  const upd = (patch: Partial<NonNullable<Answers['motives']>>) => p.set({ motives: { ...m, ...patch } });
  return (
    <Screen id="motives2" title={t.motives.title2} help={t.motives.help} p={p} answered={Boolean(m.m2 && m.l2)}>
      <MotiveRows
        p={p}
        name="motives2"
        ids={ids}
        most={m.m2}
        least={m.l2}
        onMost={(id) => upd({ m2: id, l2: m.l2 === id ? undefined : m.l2 })}
        onLeast={(id) => upd({ l2: id, m2: m.m2 === id ? undefined : m.m2 })}
      />
      <p class="help" aria-live="polite">
        {m.m2 && m.l2 ? '' : t.motives.pickBoth}
      </p>
    </Screen>
  );
}

export function MeetScreen(p: ScreenProps) {
  const meet = p.a.meet;
  const comm = meet?.communities ?? [];
  const upd = (patch: Partial<NonNullable<Answers['meet']>>) => p.set({ meet: { with: meet?.with ?? 'mix', sameAge: meet?.sameAge, communities: comm, ...patch } });
  const answered = meet !== undefined;
  return (
    <Screen id="meet" title={t.meet.title} p={p} answered={answered}>
      <Choices
        legend={t.meet.with}
        name="meet-with"
        value={meet?.with}
        options={(['similar', 'different', 'mix'] as MeetWith[]).map((v) => ({ value: v, label: t.meet.withOptions[v] }))}
        onChange={(v) => upd({ with: v })}
      />
      <Choices
        legend={t.meet.age}
        name="meet-age"
        value={meet?.sameAge === undefined ? undefined : meet.sameAge ? 'same' : 'all'}
        options={[
          { value: 'same', label: t.meet.ageOptions.same },
          { value: 'all', label: t.meet.ageOptions.all },
        ]}
        onChange={(v) => upd({ sameAge: v === 'same' })}
      />
      <Group legend={t.meet.communities}>
        {p.cfg.communities.map((c) => (
          <Pill key={c.id} checked={comm.includes(c.id)} onChange={(on) => upd({ communities: toggle(comm, c.id, on) })}>
            {c.label}
          </Pill>
        ))}
      </Group>
      <PrivacyNote>{t.meet.privacy}</PrivacyNote>
    </Screen>
  );
}

export function StrangersScreen(p: ScreenProps) {
  const a = p.a;
  return (
    <Screen id="strangers" title={t.strangers.title} p={p} answered={a.strangers !== undefined || a.bringSomeone !== undefined || a.size !== undefined}>
      <fieldset class="qgroup">
        <legend class="sr-only">{t.strangers.title}</legend>
        <div class="pick-grid pick-grid--one">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <PickCard key={n} type="radio" name="strangers" label={t.strangers.options[n] ?? String(n)} checked={a.strangers === n} onChange={(on) => on && p.set({ strangers: n })} />
          ))}
        </div>
      </fieldset>
      <Switch id="bring" checked={a.bringSomeone === true} onChange={(on) => p.set({ bringSomeone: on ? true : undefined })} label={t.strangers.bring} />
      <Choices
        legend={t.strangers.size}
        name="size"
        value={a.size}
        options={(['small', 'medium', 'large', 'any'] as GroupSizePref[]).map((v) => ({ value: v, label: t.strangers.sizes[v] }))}
        onChange={(v) => p.set({ size: v })}
      />
    </Screen>
  );
}

export function NewnessScreen(p: ScreenProps) {
  const a = p.a;
  return (
    <Screen id="newness" title={t.newness.title} p={p} answered={a.newness !== undefined || a.lastNew !== undefined}>
      <Choices
        legend={t.newness.likes}
        name="newness"
        value={a.newness}
        options={([1, 2, 3, 4, 5] as const).map((n) => ({ value: n as number, label: t.newness.likesOptions[n] ?? String(n) }))}
        onChange={(v) => p.set({ newness: v })}
      />
      <Choices
        legend={t.newness.last}
        name="lastnew"
        value={a.lastNew}
        options={(['great', 'ok', 'hard'] as const).map((v) => ({ value: v, label: t.newness.lastOptions[v] }))}
        onChange={(v) => p.set({ lastNew: v })}
      />
      {(a.newness !== undefined && a.newness <= 2) || a.lastNew === 'hard' ? <p class="callout">{t.newness.gentle}</p> : null}
    </Screen>
  );
}

export function FutureScreen(p: ScreenProps) {
  const a = p.a;
  const order = shuffle(p.cfg.futureSelves, p.seed, 'future');
  const full = a.future.length >= 2;
  return (
    <Screen id="future" title={t.future.title} help={t.future.help} p={p} answered={a.future.length > 0}>
      <div class="pick-grid" role="group" aria-label={t.future.title}>
        {order.map((f) => {
          const on = a.future.includes(f.id);
          return <PickCard key={f.id} icon={f.icon} label={f.text} checked={on} disabled={!on && full} onChange={(next) => p.set({ future: toggle(a.future, f.id, next) })} />;
        })}
      </div>
      <p class="help" aria-live="polite">
        {full ? t.future.max : ''}
      </p>
    </Screen>
  );
}
