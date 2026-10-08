import { fill } from '../lib/inline';
import { languageName } from '../lib/language';
import { plainName } from '../lib/text';
import { labels, results as t } from '../strings/en';
import { familyLabel, tagName } from './catalog';
import { roundMinutes } from './travel';
import type { Context } from './match';
import type { Scored } from './score';
import { lifts } from './score';
import type { StretchCandidate, WildcardCandidate, WildLink } from './stretch';
import type { NoteKey, PartName, Result, ResultKind, TravelMode } from './types';

// Explanations (DESIGN section 3): built from the two or three parts that contributed most, in the
// person's own terms, in plain words. No scores, no mystery.

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function modePhrase(mode: TravelMode | undefined): string {
  return mode === 'walk' ? t.mode.walk : mode === 'drive' ? t.mode.drive : t.mode.septa;
}

function dayList(days: string[]): string {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return listWords(sorted.map((d) => (labels.dayLong[d] ?? d) + 's'));
}

function timeWords(times: string[]): string {
  return listWords(times.map((x) => t.timeIn[x] ?? lower(labels.time[x] ?? x)));
}

/** "Meets Saturday mornings" from the matched days and times. */
function scheduleBit(s: Scored): string | null {
  const sch = s.evidence.practical.schedule;
  if (!sch) return null;
  const days = sch.days.length ? dayList(sch.days) : '';
  const times = sch.times.length ? timeWords(sch.times) : '';
  if (!days && !times) return null;
  return fill(t.bit.meets, { when: [days, times].filter(Boolean).join(' ') });
}

function travelBit(s: Scored, ctx: Context): string | null {
  const tr = s.evidence.practical.travel;
  if (!tr) return null;
  const mode = ctx.profile.answers.far?.mode;
  const home = ctx.profile.homeLabel;
  return fill(home ? t.bit.travelFrom : t.bit.travel, { n: roundMinutes(tr.minutes), home: home ?? '', how: modePhrase(mode) });
}

function costBit(s: Scored): string | null {
  const c = s.evidence.practical.cost;
  return c === 'free' ? t.bit.free : c === 'low' ? t.bit.low : null;
}

/** The practical facts that fit the person's answers, as short phrases. */
function practicalBits(s: Scored, ctx: Context): string[] {
  const bits = [scheduleBit(s), travelBit(s, ctx), costBit(s)].filter((x): x is string => x !== null);
  const ev = s.evidence.practical;
  if (ev.language) bits.push(fill(t.bit.language, { language: languageName(ev.language) }));
  if (ev.access) bits.push(t.bit.wheelchair);
  for (const f of ev.follow) bits.push(t.bit.follow[f] ?? '');
  return bits.filter(Boolean);
}

function interestLine(s: Scored, ctx: Context): string | null {
  const e = s.evidence.interest;
  if (!e) return null;
  const { cat } = ctx;
  const matched = cat.tagLabel.has(e.matched) ? tagName(cat, e.matched) : familyLabel(cat, e.matched);
  const ev = e.ev;
  switch (ev.kind) {
    case 'starred':
      return fill(t.why.starred, { family: ev.label, matched: lower(matched) });
    case 'picked':
      return fill(t.why.picked, { family: ev.label, matched: lower(matched) });
    case 'tag':
      return fill(t.why.tag, { tag: lower(ev.label) });
    case 'scene':
    case 'moment':
      return fill(cat.tagLabel.has(e.matched) ? t.why.sceneTag : t.why.sceneFamily, { scene: ev.label, matched: lower(matched) });
    case 'words':
      return fill(t.why.words, { word: ev.label, matched: lower(matched) });
    case 'edge':
      return fill(t.why.edge, { via: lower(ev.via ?? ''), matched: lower(matched) });
    default:
      return null;
  }
}

function motiveLine(s: Scored, ctx: Context): string | null {
  const id = s.evidence.motive;
  if (!id) return null;
  const label = ctx.cat.motiveLabel.get(id);
  return label ? fill(t.why.motive, { motive: label }) : null;
}

function roleFormatLine(s: Scored, ctx: Context): string | null {
  const comm = s.evidence.community;
  if (comm) {
    const label = ctx.cat.communityLabel.get(comm);
    if (label) return fill(t.why.community, { community: label });
  }
  const f = s.evidence.format;
  const r = s.evidence.role;
  if (f) {
    const phrase = t.formatPhrase[f.id] ?? lower(ctx.cat.formatLabel.get(f.id) ?? '');
    if (phrase) return fill(t.why.format, { format: phrase });
  }
  if (r) {
    const phrase = t.rolePhrase[r.id] ?? lower(ctx.cat.roleLabel.get(r.id) ?? '');
    if (phrase) return fill(t.why.role, { role: phrase });
  }
  return null;
}

function newcomerLine(s: Scored, ctx: Context): string | null {
  const nf = s.evidence.newcomer?.nf;
  if (nf === undefined) return null;
  const { profile } = ctx;
  if (profile.hardStrangers) return nf >= 3 ? t.why.newcomerHard : null;
  // Only worth saying to someone who is new, or nervous about new rooms.
  const mattered = profile.answers.paths.includes('newcomer') || (profile.answers.strangers ?? 0) >= 3;
  return nf >= 4 && mattered ? t.why.newcomer : null;
}

/** What a path asked for, said first: court ordered hours, a signed form, kids along. */
function pathLine(s: Scored, ctx: Context): string | null {
  const a = ctx.profile.answers;
  const g = s.p.g;
  if (a.paths.includes('court') && g.requirements.court_ordered_ok === 'yes') return t.why.court;
  if (a.paths.includes('hours') && a.hours?.form && g.requirements.service_hours_letter === 'yes') return t.why.hoursForm;
  if (a.paths.includes('kids') && g.requirements.kids_ok) return t.why.kidsAlong;
  if (s.boosts.includes('student')) return t.why.student;
  return null;
}

/** Why a group fits, two or three lines, biggest lift first. */
export function whyLines(s: Scored, ctx: Context): string[] {
  const l = lifts(s, ctx.profile);
  const options: { part: PartName; text: string | null }[] = [
    { part: 'interest', text: interestLine(s, ctx) },
    { part: 'motive', text: motiveLine(s, ctx) },
    { part: 'roleFormat', text: roleFormatLine(s, ctx) },
    {
      part: 'practical',
      text: (() => {
        const bits = practicalBits(s, ctx);
        return bits.length > 0 ? fill(t.why.practical, { bits: listWords(bits) }) : null;
      })(),
    },
    { part: 'taste', text: s.evidence.taste ? fill(t.why.taste, { name: plainName(s.evidence.taste.liked.name) }) : null },
    { part: 'newcomer', text: newcomerLine(s, ctx) },
    { part: 'regular', text: s.evidence.regular ? t.why.regular : null },
  ];
  const ranked = options
    .filter((o): o is { part: PartName; text: string } => o.text !== null && l[o.part] > 0.004)
    .sort((a, b) => l[b.part] - l[a.part]);
  const path = pathLine(s, ctx);
  const lines = [...(path ? [path] : []), ...ranked.map((o) => o.text)].slice(0, 3);
  // Never leave a card with nothing to say: fall back to plain facts.
  if (lines.length < 2) {
    const g = s.p.g;
    const kind = labels.kind[g.kind] ?? g.kind;
    const extra = practicalBits(s, ctx);
    const practical = extra.length > 0 ? fill(t.why.practical, { bits: listWords(extra) }) : null;
    if (practical && !lines.includes(practical)) lines.push(practical);
    if (lines.length < 2) lines.push(fill(t.why.kind, { kind: lower(kind) }));
  }
  return lines;
}

// ---------------------------------------------------------------- stretches and the wildcard

/** What stays familiar and practical, as short phrases for "It still fits what you asked for". */
function keepsBits(s: Scored, ctx: Context): string[] {
  return practicalBits(s, ctx);
}

export function stretchLine(c: StretchCandidate, ctx: Context): string {
  const { cat, profile } = ctx;
  const s = c.s;
  const bits = keepsBits(s, ctx);
  const fits = bits.length ? fill(t.stretch.stillFits, { bits: listWords(bits) }) : '';
  const fam = s.p.families.find((f) => profile.likedFamilies.has(f)) ?? s.p.primary;
  const famName = lower(familyLabel(cat, fam));
  const out: string[] = [];
  if (c.type === 'topic' && c.edge) {
    out.push(fill(t.stretch.topic, { to: lower(tagName(cat, c.edge.to)), from: lower(tagName(cat, c.edge.from)) }));
    out.push(fill(t.edgeWhy[c.edge.type] ?? '', { from: lower(tagName(cat, c.edge.from)) }));
    out.push(t.stretch.stillWay);
  } else if (c.type === 'way' && c.way) {
    out.push(fill(t.stretch.way, { way: t.wayPhrase[c.way] ?? c.way }));
    out.push(fill(t.stretch.stillTopic, { topic: famName }));
    const example = cat.data.waysByFamily[fam]?.[c.way]?.example;
    if (example) out.push(fill(t.stretch.example, { example }));
  } else if (c.type === 'crowd') {
    out.push(t.stretch.crowd);
    out.push(fill(t.stretch.stillBoth, { topic: famName }));
  } else {
    out.push(t.stretch.depth);
    out.push(fill(t.stretch.stillTopic, { topic: famName }));
    const example = cat.data.waysByFamily[fam]?.lead_it?.example;
    if (example) out.push(fill(t.stretch.example, { example }));
  }
  if (fits) out.push(fits);
  if (c.goalId && c.goal >= 0.3) {
    const f = cat.futureById.get(c.goalId);
    if (f) out.push(fill(t.stretch.future, { future: lower(f.text), because: f.because }));
  }
  return out.filter(Boolean).join(' ');
}

function linkClause(link: WildLink, ctx: Context): string {
  const { cat } = ctx;
  switch (link.kind) {
    case 'interest':
      return fill(t.wild.interest, { via: lower(link.via), tag: lower(tagName(cat, link.tag)) });
    case 'motive':
      return t.wild.motivePhrase[link.id] ?? fill(t.wild.motive, { motive: lower(cat.motiveLabel.get(link.id) ?? link.id) });
    case 'format':
      return fill(t.wild.format, { format: t.formatPhrase[link.id] ?? lower(cat.formatLabel.get(link.id) ?? link.id) });
    case 'role':
      return fill(t.wild.role, { role: t.rolePhrase[link.id] ?? lower(cat.roleLabel.get(link.id) ?? link.id) });
    case 'crowd':
      return t.wild.crowd;
    case 'future':
      return fill(t.wild.future, { future: lower(cat.futureById.get(link.id)?.text ?? '') });
  }
}

/** Strongest links first, no two that say nearly the same thing. */
function pickLinks(links: WildLink[]): WildLink[] {
  const order: WildLink['kind'][] = ['interest', 'future', 'motive', 'crowd', 'format', 'role'];
  const sorted = [...links].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const out: WildLink[] = [];
  for (const l of sorted) {
    if (out.length >= 2) break;
    if (l.kind === 'crowd' && out.some((x) => x.kind === 'motive' && x.id === 'social')) continue;
    if (l.kind === 'role' && out.some((x) => x.kind === 'format')) continue;
    out.push(l);
  }
  return out;
}

export function wildcardLine(c: WildcardCandidate, ctx: Context): string {
  const clauses = pickLinks(c.links).map((l) => linkClause(l, ctx));
  const parts = [t.wild.lead, fill(t.wild.connects, { clauses: listWords(clauses) })];
  const g = c.s.p.g;
  const traits: string[] = [t.wild.welcoming];
  traits.push(g.cost.level === 'free' ? t.wild.free : t.wild.cheap);
  traits.push(t.wild.tryOnce);
  parts.push(fill(t.wild.traits, { traits: listWords(traits) }));
  return parts.join(' ');
}

// ---------------------------------------------------------------- notes and the first step

const NOTE_TEXT: Record<NoteKey, string> = t.notes as Record<NoteKey, string>;

export function notesFor(s: Scored, ctx: Context, extraUnknown: NoteKey[] = []): { notes: string[]; noteKeys: NoteKey[] } {
  const keys: NoteKey[] = [...new Set([...s.unknown, ...extraUnknown])];
  const a = ctx.profile.answers;
  // Someone gave a starting point and a way of travelling, but this group has no place we can use.
  if (a.far && a.far.mode !== 'anywhere' && ctx.profile.home && s.ev.minutes === undefined && !s.p.onlineOnly && !keys.includes('distance')) keys.push('distance');
  // Partly accessible: worth a word even when the person did not lock access.
  if (a.wheelchair?.value && s.p.g.access.wheelchair === 'partial' && !keys.includes('access_partial')) keys.push('access_partial');
  if (a.paths.includes('hours') && a.hours?.form && s.p.g.requirements.service_hours_letter === 'unknown' && !keys.includes('hours_form')) keys.push('hours_form');
  return { noteKeys: keys, notes: keys.map((k) => NOTE_TEXT[k]).filter(Boolean) };
}

export function firstStepText(s: Scored): string {
  const f = s.p.g.first_step;
  if (f.how) return f.how;
  if (f.drop_in === true) return t.firstStep.dropIn;
  if (f.sign_up_needed === true) return t.firstStep.signUp;
  return t.firstStep.generic;
}

// ---------------------------------------------------------------- one result

export function buildResult(
  s: Scored,
  kind: ResultKind,
  ctx: Context,
  extra: { stretch?: StretchCandidate; wild?: WildcardCandidate } = {},
): Result {
  const { notes, noteKeys } = notesFor(s, ctx, extra.stretch?.unknown ?? extra.wild?.unknown ?? []);
  const result: Result = {
    group: s.p.g,
    kind,
    score: s.score,
    parts: s.parts,
    why: whyLines(s, ctx),
    notes,
    noteKeys,
    firstStep: firstStepText(s),
  };
  if (extra.stretch) {
    result.stretch = extra.stretch.type;
    result.stretchLine = stretchLine(extra.stretch, ctx);
  }
  if (extra.wild) result.stretchLine = wildcardLine(extra.wild, ctx);
  if (s.ev.minutes !== undefined) {
    result.minutes = roundMinutes(s.ev.minutes);
    result.travelMode = ctx.profile.answers.far?.mode;
  }
  return result;
}
