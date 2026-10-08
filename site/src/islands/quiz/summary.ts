import type { Catalog } from '../../engine/catalog';
import type { Answers } from '../../engine/types';
import { fill } from '../../lib/inline';
import { languageName } from '../../lib/language';
import type { QuizConfig } from '../../lib/quiz-config';
import { labels, quiz as t, results as r } from '../../strings/en';
import { bandOf, type ScreenId } from './state';

// "Here's what we heard" (DESIGN stage 8): every answer as a short chip the person can take off
// with one tap. Pure, so it can be tested without a screen.

export interface Chip {
  id: string;
  text: string;
  /** a locked deal breaker */
  locked: boolean;
  /** the screen that set it, for "Change my answers" */
  screen: ScreenId;
  /** the answers without this one thing */
  remove: (a: Answers) => Answers;
}

const TIME_PLURAL: Record<string, string> = { morning: 'mornings', afternoon: 'afternoons', evening: 'evenings', night: 'late nights', daytime: 'days' };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function without<T>(list: readonly T[], x: T): T[] {
  return list.filter((y) => y !== x);
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function buildChips(a: Answers, cat: Catalog, cfg: QuizConfig): Chip[] {
  const c = t.heard.chips;
  const out: Chip[] = [];
  const add = (id: string, text: string, screen: ScreenId, remove: (x: Answers) => Answers, locked = false) => {
    if (text) out.push({ id, text, locked, screen, remove });
  };

  // Paths
  if (a.paths.includes('hours')) add('hours', a.hours?.need ? fill(c.hours, { n: a.hours.need }) : t.start.options.hours, 'hours', (x) => ({ ...x, paths: without(x.paths, 'hours'), hours: undefined }));
  if (a.paths.includes('hours') && a.hours?.form) add('hours-form', c.hoursForm, 'hours', (x) => ({ ...x, hours: { ...x.hours, form: undefined } }));
  if (a.paths.includes('court')) {
    add('court', c.court, 'court', (x) => ({ ...x, paths: without(x.paths, 'court'), court: undefined }));
    if (a.court?.noChildren) add('no-children', c.noChildren, 'court', (x) => ({ ...x, court: { ...x.court, noChildren: undefined } }));
  }
  if (a.paths.includes('kids')) add('kids', c.kids, 'kids', (x) => ({ ...x, paths: without(x.paths, 'kids'), kidsAges: undefined }));
  if (a.paths.includes('newcomer')) add('newcomer', c.newcomer, 'newcomer', (x) => ({ ...x, paths: without(x.paths, 'newcomer'), newSince: undefined }));
  if (a.paths.includes('student')) {
    const school = a.school ? (labels.school[a.school] ?? a.school) : null;
    add('student', school ? fill(c.student, { school }) : t.start.options.student, 'student', (x) => ({ ...x, paths: without(x.paths, 'student'), school: undefined }));
  }

  // Why
  const m = a.motives;
  if (m?.m1) add('most', fill(c.most, { reason: lower(cat.motiveLabel.get(m.m1) ?? m.m1) }), 'motives1', (x) => ({ ...x, motives: { ...x.motives, m1: undefined, m2: undefined, l2: undefined } }));
  if (m?.l1) add('least', fill(c.least, { reason: lower(cat.motiveLabel.get(m.l1) ?? m.l1) }), 'motives1', (x) => ({ ...x, motives: { ...x.motives, l1: undefined, m2: undefined, l2: undefined } }));

  // What you are into
  for (const f of a.starred) {
    const fam = cat.familyById.get(f);
    if (!fam) continue;
    add(`star-${f}`, fill(c.starred, { name: fam.label }), 'stars', (x) => ({ ...x, starred: without(x.starred, f), picked: without(x.picked, f), tags: x.tags.filter((tag) => cat.tagFamily.get(tag) !== f) }));
  }
  for (const f of a.picked) {
    if (a.starred.includes(f)) continue;
    const fam = cat.familyById.get(f);
    if (!fam) continue;
    add(`pick-${f}`, fill(c.picked, { name: fam.label }), 'interests', (x) => ({ ...x, picked: without(x.picked, f) }));
  }
  for (const tag of a.tags) add(`tag-${tag}`, fill(c.tag, { name: cat.tagLabel.get(tag) ?? tag }), 'tags', (x) => ({ ...x, tags: without(x.tags, tag) }));
  const sceneCount = a.scenes.length + a.moments.length;
  if (sceneCount > 0) add('scenes', fill(c.scenes, { n: sceneCount }), 'scenes', (x) => ({ ...x, scenes: [], moments: [] }));
  if (a.words?.trim()) add('words', fill(c.words, { words: a.words.trim() }), 'moments', (x) => ({ ...x, words: undefined }));

  // When, how far, how much
  const w = a.when;
  if (w?.flexible) add('flexible', c.flexible, 'when', (x) => ({ ...x, when: undefined }));
  else if (w && (w.days.length > 0 || w.times.length > 0)) {
    const days = listWords(w.days.map((d) => labels.dayShort[d] ?? d));
    const times = listWords(w.times.map((x) => TIME_PLURAL[x] ?? lower(labels.time[x] ?? x)));
    add('when', fill(c.when, { when: [days, times].filter(Boolean).join(' ') }), 'when', (x) => ({ ...x, when: undefined }), w.locked);
  }
  if (a.often && a.often.value !== 'any') add('often', fill(c.often, { how: lower(t.often.options[a.often.value]) }), 'often', (x) => ({ ...x, often: undefined }), a.often.locked);
  if (a.far) {
    if (a.far.mode === 'anywhere') add('far', c.anywhere, 'far', (x) => ({ ...x, far: undefined, place: undefined }));
    else {
      const how = a.far.mode === 'walk' ? r.mode.walk : a.far.mode === 'drive' ? r.mode.drive : r.mode.septa;
      add('far', fill(c.far, { n: a.far.minutes, how }), 'far', (x) => ({ ...x, far: undefined, place: undefined }), a.far.locked);
    }
  }
  if (a.budget && a.budget.value !== 'any') add('budget', c.budget[a.budget.value], 'budget', (x) => ({ ...x, budget: undefined }), a.budget.locked);

  // Rules
  if (a.age) {
    const band = bandOf(a.age);
    const range = (band ? t.rulesA.bands[band] : undefined) ?? (a.age.lo === a.age.hi ? String(a.age.lo) : `${a.age.lo} to ${a.age.hi}`);
    add('age', fill(c.age, { range: lower(range) }), 'rules_a', (x) => ({ ...x, age: undefined }));
  }
  if (a.wheelchair?.value) add('wheelchair', c.wheelchair, 'rules_a', (x) => ({ ...x, wheelchair: undefined }), a.wheelchair.locked);
  if (a.languages && a.languages.codes.length > 0) {
    add('languages', fill(c.languages, { languages: listWords(a.languages.codes.map(languageName)) }), 'rules_a', (x) => ({ ...x, languages: undefined }), a.languages.locked);
  }
  if (a.faith) {
    if (a.faith.mode === 'exclude') add('faith', c.faithExclude, 'rules_b', (x) => ({ ...x, faith: undefined }));
    else if (a.faith.mode === 'only') add('faith', fill(c.faithOnly, { tradition: lower(cfg.faith.find((f) => f.id === a.faith?.tradition)?.label ?? 'not picked') }), 'rules_b', (x) => ({ ...x, faith: undefined }));
    else add('faith', c.faithInclude, 'rules_b', (x) => ({ ...x, faith: undefined }));
  }
  if (a.noBackgroundCheck?.value) add('background', c.background, 'rules_b', (x) => ({ ...x, noBackgroundCheck: undefined }), a.noBackgroundCheck.locked);

  // Who
  if (a.meet) {
    add('meet', c.meet[a.meet.with], 'meet', (x) => ({ ...x, meet: undefined }));
    if (a.meet.sameAge) add('same-age', c.sameAge, 'meet', (x) => ({ ...x, meet: x.meet ? { ...x.meet, sameAge: undefined } : undefined }));
    if (a.meet.communities.length > 0) add('communities', fill(c.communities, { n: a.meet.communities.length }), 'meet', (x) => ({ ...x, meet: x.meet ? { ...x.meet, communities: [] } : undefined }));
  }
  if (a.strangers !== undefined && a.strangers !== 3) add('strangers', c.strangers[a.strangers] ?? '', 'strangers', (x) => ({ ...x, strangers: undefined }));
  if (a.bringSomeone) add('bring', c.bring, 'strangers', (x) => ({ ...x, bringSomeone: undefined }));
  if (a.size && a.size !== 'any') add('size', c.size[a.size] ?? '', 'strangers', (x) => ({ ...x, size: undefined }));
  if ((a.newness !== undefined && a.newness <= 2) || a.lastNew === 'hard') add('newness', c.newness.low, 'newness', (x) => ({ ...x, newness: undefined, lastNew: undefined }));
  else if ((a.newness !== undefined && a.newness >= 4) || a.lastNew === 'great') add('newness', c.newness.high, 'newness', (x) => ({ ...x, newness: undefined, lastNew: undefined }));

  // Your future self
  for (const id of a.future) {
    const f = cat.futureById.get(id);
    if (f) add(`future-${id}`, fill(c.future, { future: f.text }), 'future', (x) => ({ ...x, future: without(x.future, id) }));
  }

  // The taste test and follow ups
  const reacted = Object.keys(a.taste).length;
  if (reacted > 0) add('taste', fill(c.taste, { n: reacted }), 'taste', (x) => ({ ...x, taste: {} }));
  for (const [key, value] of Object.entries(a.follow)) {
    const q = t.follow.questions[key];
    const text = q?.options[value as string];
    if (text) add(`follow-${key}`, text, 'follow', (x) => ({ ...x, follow: { ...x.follow, [key]: undefined } }));
  }
  return out;
}
