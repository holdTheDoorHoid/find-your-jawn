import { badges as t, labels } from '../strings/en';
import { fill } from './inline';
import { languageBase, languageName } from './language';
import { prettify } from './text';
import type { Group } from './types';

export type BadgeTone = 'good' | 'info' | 'note';

export interface Badge {
  id: string;
  text: string;
  tone: BadgeTone;
}

export function isFaithGroup(g: Group): boolean {
  return Boolean(g.audience.faith) || g.kind === 'congregation';
}

export function faithText(g: Group): string {
  const f = g.audience.faith;
  if (!f) return t.faith;
  return `${t.faith}: ${labels.faith[f] ?? prettify(f)}`;
}

export function schoolName(school: string): string {
  return labels.school[school] ?? prettify(school);
}

/** Short facts for a card or group page header, most useful first. */
export function groupBadges(g: Group, opts: { max?: number } = {}): Badge[] {
  const out: Badge[] = [];
  const cost = g.cost.level;
  if (cost === 'free') out.push({ id: 'cost', text: t.free, tone: 'good' });
  else if (cost === 'low') out.push({ id: 'cost', text: t.low, tone: 'info' });
  else if (cost === 'paid') out.push({ id: 'cost', text: t.paid, tone: 'info' });

  const open = g.audience.open_to;
  if (open === 'students') {
    out.push({
      id: 'open',
      text: g.audience.school ? `${t.studentsOnly}: ${schoolName(g.audience.school)}` : t.studentsOnly,
      tone: 'note',
    });
  } else if (open === 'members') out.push({ id: 'open', text: t.membersOnly, tone: 'note' });
  else if (open === 'invite') out.push({ id: 'open', text: t.invite, tone: 'note' });

  if ((g.first_step.newcomer_friendliness ?? 0) >= 4) out.push({ id: 'newcomers', text: t.newcomers, tone: 'good' });
  if (g.requirements.kids_ok) out.push({ id: 'kids', text: t.kids, tone: 'good' });
  if (g.access.wheelchair === 'yes') out.push({ id: 'wheelchair', text: t.wheelchair, tone: 'good' });

  const { min_age: min, max_age: max } = g.audience;
  if (min !== undefined && min >= 12) out.push({ id: 'minage', text: fill(t.minAge, { n: min }), tone: 'note' });
  else if (max !== undefined && max <= 17) out.push({ id: 'maxage', text: fill(t.maxAge, { n: max }), tone: 'note' });

  if (isFaithGroup(g)) out.push({ id: 'faith', text: faithText(g), tone: 'note' });
  if (g.online_ok) out.push({ id: 'online', text: t.online, tone: 'info' });
  if (g.requirements.act153_clearances) out.push({ id: 'clearances', text: t.clearances, tone: 'note' });
  if (g.requirements.background_check) out.push({ id: 'bgcheck', text: t.backgroundCheck, tone: 'note' });

  const langs = [...new Set(g.access.languages.map(languageBase))].filter((l) => l !== 'en');
  for (const l of langs.slice(0, 2)) out.push({ id: `lang-${l}`, text: languageName(l), tone: 'info' });

  return opts.max ? out.slice(0, opts.max) : out;
}
