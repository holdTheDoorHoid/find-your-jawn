import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Catalog } from '../../engine/catalog';
import type { FollowId, NotWhy, Reaction } from '../../engine/types';
import { groupBadges } from '../../lib/badges';
import { fill } from '../../lib/inline';
import { placeLine } from '../../lib/place';
import type { QuizConfig } from '../../lib/quiz-config';
import { groupPath, withBase } from '../../lib/site';
import type { Group } from '../../lib/types';
import { card, labels, quiz as t } from '../../strings/en';
import { buildChips, type Chip } from './summary';
import type { ScreenProps } from './screens';
import { Frame, Nav, PickCard } from './widgets';

// The taste test, the follow up questions, and "Here's what we heard".

// ---------------------------------------------------------------- the taste test

export interface TasteProps extends ScreenProps {
  /** the cards chosen for this person, in the order to show */
  cards: { group: Group; probe: boolean }[];
  loading: boolean;
  places: Record<string, string>;
}

const WHYS: NotWhy[] = ['far', 'time', 'not_my_thing', 'intense', 'crowded', 'cost'];

export function TasteScreen(p: TasteProps) {
  const { a, cards } = p;
  const firstOpen = cards.findIndex((c) => a.taste[c.group.id] === undefined);
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [askWhy, setAskWhy] = useState(false);
  const current = cards[index];

  // When the cards arrive after the data loads, start at the first one not answered yet.
  useEffect(() => {
    const i = cards.findIndex((c) => a.taste[c.group.id] === undefined);
    setIndex(i === -1 ? 0 : i);
    setAskWhy(false);
    // only when the set of cards changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.map((c) => c.group.id).join(',')]);

  const advance = (from: number) => {
    setAskWhy(false);
    if (from + 1 >= cards.length) p.onNext();
    else setIndex(from + 1);
  };

  const react = (r: Reaction, why?: NotWhy) => {
    if (!current) return;
    p.set({ taste: { ...a.taste, [current.group.id]: { r, why, probe: current.probe || undefined } } });
    if (r === 'not' && why === undefined && !askWhy) {
      setAskWhy(true);
      return;
    }
    advance(index);
  };

  const back = () => {
    if (askWhy) setAskWhy(false);
    else if (index > 0) setIndex(index - 1);
    else p.onBack();
  };

  if (p.loading) {
    return (
      <Frame title={t.taste.title} focusKey="taste" grabFocus={p.grabFocus}>
        <p role="status">{t.taste.loadingGroups}</p>
      </Frame>
    );
  }
  if (cards.length === 0 || !current) {
    return (
      <Frame title={t.taste.title} focusKey="taste" grabFocus={p.grabFocus}>
        <p>{t.taste.none}</p>
        <Nav onBack={p.onBack} onNext={p.onNext} answered={false} canBack={p.canBack} />
      </Frame>
    );
  }

  const g = current.group;
  const kind = labels.kind[g.kind] ?? g.kind;
  const place = placeLine(g, p.places);
  const badges = groupBadges(g, { max: 4 });
  const reaction = a.taste[g.id];

  return (
    <Frame title={t.taste.title} help={t.taste.help} focusKey={`taste-${index}`} grabFocus={p.grabFocus}>
      <p class="taste__count" aria-live="polite">
        {fill(t.taste.progress, { n: index + 1, total: cards.length })}
      </p>
      <article class="taste" aria-labelledby="taste-name">
        {current.probe && <p class="taste__probe">{t.taste.probe}</p>}
        <p class="kind">{place ? `${kind} · ${place}` : kind}</p>
        <h3 id="taste-name">{g.name}</h3>
        {g.summary && <p class="taste__summary">{g.summary}</p>}
        {badges.length > 0 && (
          <ul class="badges" aria-label={card.quickFacts}>
            {badges.map((b) => (
              <li key={b.id}>
                <span class={`badge badge--${b.tone}`}>{b.text}</span>
              </li>
            ))}
          </ul>
        )}
        <p class="taste__more">
          <a href={withBase(groupPath(g.id))} target="_blank" rel="noopener noreferrer">
            {card.viewGroup}
            <span class="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </article>
      {!askWhy ? (
        <div class="taste__buttons" role="group" aria-label={g.name}>
          <button type="button" class={`btn taste__btn${reaction?.r === 'into' ? ' is-chosen' : ''}`} onClick={() => react('into')}>
            <span aria-hidden="true">{'👍 '}</span>
            {t.taste.into}
          </button>
          <button type="button" class={`btn btn--secondary taste__btn${reaction?.r === 'maybe' ? ' is-chosen' : ''}`} onClick={() => react('maybe')}>
            <span aria-hidden="true">{'🤔 '}</span>
            {t.taste.maybe}
          </button>
          <button type="button" class={`btn btn--quiet taste__btn${reaction?.r === 'not' ? ' is-chosen' : ''}`} onClick={() => react('not')}>
            <span aria-hidden="true">{'👎 '}</span>
            {t.taste.not}
          </button>
        </div>
      ) : (
        <fieldset class="qgroup taste__why">
          <legend>{t.taste.why}</legend>
          <div class="check-row">
            {WHYS.map((w) => (
              <button key={w} type="button" class="btn btn--quiet btn--small" onClick={() => react('not', w)}>
                {t.taste.whyReasons[w]}
              </button>
            ))}
            <button type="button" class="btn btn--secondary btn--small" onClick={() => advance(index)}>
              {t.taste.noReason}
            </button>
          </div>
        </fieldset>
      )}
      <div class="qnav">
        <button type="button" class="btn btn--quiet" onClick={back}>
          {t.back}
        </button>
        <button type="button" class="btn btn--secondary" onClick={p.onNext}>
          {t.skip}
        </button>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- follow up questions

export function FollowScreen(p: ScreenProps & { ids: FollowId[] }) {
  const { a, ids } = p;
  const answered = ids.some((id) => a.follow[id] !== undefined);
  return (
    <Frame title={ids.length > 1 ? t.follow.titlePlural : t.follow.title} focusKey="follow" grabFocus={p.grabFocus}>
      {ids.map((id) => {
        const q = t.follow.questions[id];
        if (!q) return null;
        return (
          <fieldset class="qgroup" key={id}>
            <legend>{q.title}</legend>
            <div class="pick-grid pick-grid--one">
              {Object.entries(q.options).map(([value, label]) => (
                <PickCard key={value} type="radio" name={`follow-${id}`} label={label} checked={a.follow[id] === value} onChange={(on) => on && p.set({ follow: { ...a.follow, [id]: value } })} />
              ))}
            </div>
          </fieldset>
        );
      })}
      <Nav onBack={p.onBack} onNext={p.onNext} answered={answered} canBack={p.canBack} />
    </Frame>
  );
}

// ---------------------------------------------------------------- here's what we heard

export function HeardScreen(p: ScreenProps & { cat: Catalog; cfg: QuizConfig; goTo: (id: string) => void }) {
  const { a, cat, cfg } = p;
  const chips = useMemo(() => buildChips(a, cat, cfg), [a, cat, cfg]);
  const [undo, setUndo] = useState<{ text: string; before: typeof a } | null>(null);

  const remove = (c: Chip) => {
    setUndo({ text: c.text, before: a });
    p.set(c.remove(a));
  };

  return (
    <Frame title={t.heard.title} help={t.heard.help} focusKey="heard" grabFocus={p.grabFocus}>
      {chips.length === 0 ? (
        <p>{t.heard.empty}</p>
      ) : (
        <ul class="chips" aria-label={t.heard.title}>
          {chips.map((c) => (
            <li key={c.id}>
              <button type="button" class={`chip${c.locked ? ' chip--locked' : ''}`} aria-label={fill(t.heard.removeLabel, { text: c.text })} onClick={() => remove(c)}>
                {c.locked && <span aria-hidden="true">{'🔒 '}</span>}
                <span>{c.text}</span>
                <span class="chip__x" aria-hidden="true">
                  {'×'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="status" role="status">
        {undo ? (
          <>
            {fill(t.heard.removed, {})}{' '}
            <button
              type="button"
              class="linkish"
              onClick={() => {
                p.set(undo.before);
                setUndo(null);
              }}
            >
              {fill(t.heard.restoreLabel, { text: undo.text })}
            </button>
          </>
        ) : (
          ''
        )}
      </p>
      <p>
        <button type="button" class="linkish" onClick={() => p.goTo('start')}>
          {t.heard.change}
        </button>
      </p>
      <div class="qnav">
        <button type="button" class="btn btn--quiet" onClick={p.onBack}>
          {t.back}
        </button>
        <button type="button" class="btn" onClick={p.onNext}>
          {t.heard.go}
        </button>
      </div>
    </Frame>
  );
}
