import type { ComponentChildren } from 'preact';
import { groupBadges } from '../lib/badges';
import { lastSeenActive } from '../lib/dates';
import { placeLine } from '../lib/place';
import { groupPath, withBase } from '../lib/site';
import type { Group } from '../lib/types';
import { card, labels } from '../strings/en';

interface Props {
  group: Group;
  places?: Record<string, string>;
  /** how many badges to show; the rest are on the group page */
  maxBadges?: number;
  headingLevel?: 2 | 3;
  /** a small label above the name, for example "Close fit" on the match results */
  label?: ComponentChildren;
  /** extra content between the summary and the badges, for example why a group fits */
  body?: ComponentChildren;
  /** extra content at the bottom of the card, for example action buttons */
  footer?: ComponentChildren;
}

/** One result card. Used as plain HTML on static pages and inside the browse island. */
export function GroupCard({ group, places, maxBadges = 6, headingLevel = 3, label, body, footer }: Props) {
  const badges = groupBadges(group, { max: maxBadges });
  const kind = labels.kind[group.kind] ?? group.kind;
  const place = placeLine(group, places);
  const seen = lastSeenActive(group.last_sign_of_life) ?? card.noDate;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article class={footer || body ? 'gcard gcard--rich' : 'gcard'}>
      {label}
      <p class="kind">{place ? `${kind} · ${place}` : kind}</p>
      <Heading>
        <a href={withBase(groupPath(group.id))}>{group.name}</a>
      </Heading>
      {group.summary && <p class="summary">{group.summary}</p>}
      {body}
      {badges.length > 0 && (
        <ul class="badges" aria-label={card.quickFacts}>
          {badges.map((b) => (
            <li key={b.id}>
              <span class={`badge badge--${b.tone}`}>{b.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p class="seen">{seen}</p>
      {footer}
    </article>
  );
}

export function GroupList({
  groups,
  places,
  two = false,
  headingLevel = 3,
}: {
  groups: Group[];
  places?: Record<string, string>;
  two?: boolean;
  headingLevel?: 2 | 3;
}) {
  return (
    <ul class={two ? 'group-list group-list--two' : 'group-list'}>
      {groups.map((g) => (
        <li key={g.id}>
          <GroupCard group={g} places={places} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
