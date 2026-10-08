import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { GroupCard } from '../../components/GroupCard';
import type { NotWhy, Result } from '../../engine/types';
import { fill } from '../../lib/inline';
import { isSaved, SAVED_EVENT, toggleSaved } from '../../lib/saved';
import { store } from '../../lib/storage';
import { safeHttpUrl } from '../../lib/text';
import { matches as t, results as r } from '../../strings/en';
import { PlanPanel, SharePanel, targetOf } from './panels';

// One match: the group card with its label, why it fits, the first step, what we could not check,
// and the four actions. Only one panel (plan, share, or the reason for "Not for me") is open at a
// time, and closing it puts focus back on the button that opened it.

type Panel = 'plan' | 'share' | 'not' | null;

interface Props {
  result: Result;
  places?: Record<string, string>;
  onNotForMe: (r: Result, why: NotWhy | undefined) => void;
  headingLevel?: 2 | 3;
}

/** Text with web addresses turned into links. Only http and https links; the rest stays plain text. */
export function linkify(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  const re = /https?:\/\/[^\s<>"]+/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    // Trailing punctuation belongs to the sentence, not the address.
    const raw = m[0].replace(/[.,;:!?)\]]+$/, '');
    const href = safeHttpUrl(raw);
    if (!href) continue;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a key={start} href={href} rel="noopener noreferrer">
        {raw}
      </a>,
    );
    last = start + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function kindLabel(r: Result): string {
  if (r.kind === 'stretch' && r.stretch) return t.kind.stretch[r.stretch] ?? t.kind.close;
  if (r.kind === 'wildcard') return t.kind.wildcard;
  return t.kind.close;
}

export function ResultCard({ result, places, onNotForMe, headingLevel = 3 }: Props) {
  const g = result.group;
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const sync = () => setSaved(isSaved(store, g.id));
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [g.id]);

  const open = (which: Panel, el: HTMLButtonElement) => {
    opener.current = el;
    setPanel(panel === which ? null : which);
  };
  const close = () => {
    setPanel(null);
    window.setTimeout(() => opener.current?.focus(), 0);
  };

  const onSave = () => {
    setSaved(toggleSaved(store, g.id));
    try {
      window.dispatchEvent(new Event(SAVED_EVENT));
    } catch {
      // older browsers: the button still works
    }
  };

  const label = (
    <p class={`rlabel rlabel--${result.kind}`}>
      <span>{kindLabel(result)}</span>
    </p>
  );

  const body = (
    <div class="rbody">
      <h4 class="rbody__title">{t.why}</h4>
      <ul class="rwhy">
        {result.why.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {result.stretchLine && <p class="rstretch">{result.stretchLine}</p>}
      <p class="rfirst">
        <strong>{t.firstStep}:</strong> {linkify(result.firstStep)}
      </p>
      {result.minutes !== undefined && result.travelMode && (
        <p class="rnote rnote--fact">{fill(t.travel, { n: result.minutes, how: r.mode[result.travelMode === 'anywhere' ? 'septa' : result.travelMode] })}</p>
      )}
      {result.notes.length > 0 && (
        <ul class="rnotes" aria-label={t.notes}>
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );

  const footer = (
    <div class="ractions" role="group" aria-label={fill(t.actionsLabel, { name: g.name })}>
      <div class="ractions__row">
        <button type="button" class={`btn btn--small ${saved ? '' : 'btn--secondary'}`} aria-pressed={saved} aria-label={fill(saved ? t.savedLabel : t.saveLabel, { name: g.name })} onClick={onSave}>
          {saved ? '✓ ' : ''}
          {saved ? t.saved : t.save}
        </button>
        <button type="button" class="btn btn--small btn--secondary" aria-expanded={panel === 'plan'} onClick={(e) => open('plan', e.currentTarget as HTMLButtonElement)}>
          {t.plan}
        </button>
        <button type="button" class="btn btn--small btn--secondary" aria-expanded={panel === 'share'} onClick={(e) => open('share', e.currentTarget as HTMLButtonElement)}>
          {t.share}
        </button>
        <button type="button" class="btn btn--small btn--quiet" aria-expanded={panel === 'not'} onClick={(e) => open('not', e.currentTarget as HTMLButtonElement)}>
          {t.notForMe}
        </button>
      </div>
      {panel === 'plan' && <PlanPanel target={targetOf(result)} onClose={close} />}
      {panel === 'share' && <SharePanel target={{ id: g.id, name: g.name }} onClose={close} />}
      {panel === 'not' && (
        <div class="rpanel" role="group" aria-label={t.notWhy.title}>
          <p class="rpanel__title">{t.notWhy.title}</p>
          <div class="check-row">
            {(['far', 'time', 'not_my_thing', 'intense', 'already'] as const).map((w) => (
              <button
                key={w}
                type="button"
                class="btn btn--quiet btn--small"
                onClick={() => {
                  setPanel(null);
                  onNotForMe(result, w);
                }}
              >
                {t.notWhy[w]}
              </button>
            ))}
            <button type="button" class="btn btn--secondary btn--small" onClick={close}>
              {t.notWhy.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return <GroupCard group={g} places={places} headingLevel={headingLevel} label={label} body={body} footer={footer} maxBadges={6} />;
}
