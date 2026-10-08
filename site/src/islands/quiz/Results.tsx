import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Catalog } from '../../engine/catalog';
import { loosen } from '../../engine/filters';
import { computeResults, moreResults, replacementFor, type Outcome } from '../../engine/select';
import type { Answers, BlockerKey, Dial, NotWhy, Result } from '../../engine/types';
import { fill } from '../../lib/inline';
import { withBase } from '../../lib/site';
import type { Group } from '../../lib/types';
import { matches as t } from '../../strings/en';
import { ResultCard } from './ResultCard';
import { Pill } from './widgets';

// The results page (DESIGN section 5): about eight cards, the adventure dial, "Show me more", and
// an honest account when the locked answers leave too few groups.

interface Props {
  groups: Group[];
  cat: Catalog;
  places: Record<string, string>;
  answers: Answers;
  setAnswers: (patch: Partial<Answers>) => void;
  onEdit: () => void;
  onRestart: () => void;
}

/** Everything that changes the matches except "Not for me", which only swaps one card. */
function matchKey(a: Answers): string {
  return JSON.stringify({ ...a, notForMe: undefined });
}

const FEW = 4;

export function Results({ groups, cat, places, answers, setAnswers, onEdit, onRestart }: Props) {
  const key = matchKey(answers);
  const [outcome, setOutcome] = useState<Outcome>(() => computeResults(groups, cat, answers));
  const [list, setList] = useState<Result[]>(() => outcome.results);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // The dial, a loosened lock or new groups: start again from the top.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const out = computeResults(groups, cat, answers);
    setOutcome(out);
    setList(out.results);
    setMessage(fill(out.results.length === 1 ? t.updatedOne : t.updated, { n: out.results.length }));
    // `answers` is read, but only `key` and `groups` decide when to recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, groups, cat]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    try {
      heading.current?.closest('.quiz')?.scrollIntoView({ block: 'start' });
    } catch {
      // older browsers
    }
  }, []);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`card-${focusId}`)?.focus({ preventScroll: false });
    setFocusId(null);
  }, [focusId, list]);

  const canMore = useMemo(() => moreResults(outcome, list, 1).length > 0, [outcome, list]);

  const notForMe = (r: Result, why: NotWhy | undefined) => {
    const notForMeList = [...answers.notForMe, { id: r.group.id, why }];
    const next = computeResults(groups, cat, { ...answers, notForMe: notForMeList });
    const remaining = list.filter((x) => x.group.id !== r.group.id);
    const fill_ = replacementFor(next, r, remaining);
    setOutcome(next);
    setList(list.flatMap((x) => (x.group.id === r.group.id ? (fill_ ? [fill_] : []) : [x])));
    setAnswers({ notForMe: notForMeList });
    setMessage(fill_ ? fill(t.replaced, { name: r.group.name }) : fill(t.removedOnly, { name: r.group.name }));
    const target = fill_ ?? remaining[0];
    if (target) setFocusId(target.group.id);
  };

  const showMore = () => {
    const extra = moreResults(outcome, list, 4);
    if (extra.length === 0) return;
    setList([...list, ...extra]);
    setMessage('');
    setFocusId(extra[0]!.group.id);
  };

  const setDial = (dial: Dial) => setAnswers({ dial });

  const passed = outcome.diagnosis.passed;
  const thin = list.length < FEW && outcome.diagnosis.pool > 0 ? true : list.length === 0;
  const needsGentle = ((answers.newness !== undefined && answers.newness <= 2) || answers.lastNew === 'hard') && answers.dial !== 'gentle';

  return (
    <section class="results" aria-labelledby="results-title">
      <h2 id="results-title" ref={heading} tabIndex={-1}>
        {t.title}
      </h2>
      <p class="lede">{t.intro}</p>

      {list.length > 0 && (
        <fieldset class="qgroup dial">
          <legend>{t.dial.label}</legend>
          <div class="check-row">
            {(['gentle', 'balanced', 'bold'] as const).map((d) => (
              <Pill key={d} type="radio" name="dial" checked={answers.dial === d} onChange={(on) => on && setDial(d)}>
                {t.dial[d]}
              </Pill>
            ))}
          </div>
          <p class="help" aria-live="polite">
            {t.dial.help[answers.dial]}
          </p>
        </fieldset>
      )}
      {needsGentle && (
        <p class="callout">
          {t.dial.gentleNote}{' '}
          <button type="button" class="linkish" onClick={() => setDial('gentle')}>
            {t.dial.useGentle}
          </button>
        </p>
      )}

      <p class="status" role="status">
        {message}
      </p>

      {list.length > 0 && (
        <ul class="results-list">
          {list.map((r) => (
            <li key={r.group.id} id={`card-${r.group.id}`} tabIndex={-1}>
              <ResultCard result={r} places={places} onNotForMe={notForMe} />
            </li>
          ))}
        </ul>
      )}

      {thin && <FewBox outcome={outcome} answers={answers} shown={list.length} onLoosen={(k) => setAnswers({ loose: loosen(answers, k).loose })} />}

      {list.length > 0 && (
        <div class="more">
          {canMore ? (
            <button type="button" class="btn btn--secondary" onClick={showMore}>
              {t.more}
            </button>
          ) : (
            passed > 0 && <p class="help">{t.moreNone}</p>
          )}
        </div>
      )}

      <div class="results-foot">
        <button type="button" class="btn btn--quiet" onClick={onEdit}>
          {t.edit}
        </button>
        <a class="btn btn--quiet" href={withBase('browse/')}>
          {t.browse}
        </a>
        {!confirm ? (
          <button type="button" class="btn btn--quiet" onClick={() => setConfirm(true)}>
            {t.restart}
          </button>
        ) : (
          <span class="btn-row" role="group" aria-label={t.restartConfirm}>
            <button type="button" class="btn" onClick={onRestart}>
              {t.restartYes}
            </button>
            <button type="button" class="btn btn--quiet" onClick={() => setConfirm(false)}>
              {t.notWhy.cancel}
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- too few groups

function FewBox({ outcome, answers, shown, onLoosen }: { outcome: Outcome; answers: Answers; shown: number; onLoosen: (k: BlockerKey) => void }) {
  const { blockers, passed } = outcome.diagnosis;
  const court = answers.paths.includes('court') && !(answers.loose ?? []).includes('path');
  const loosenable = blockers.filter((b) => b.key !== 'path' && b.key !== 'age' && b.key !== 'open_to' && b.count > 0);
  const head = passed === 0 ? t.few.zero : passed === 1 ? t.few.textOne : fill(t.few.text, { n: passed });
  return (
    <div class="callout few" role="region" aria-labelledby="few-title">
      <h3 id="few-title">{t.few.title}</h3>
      <p>{shown === 0 ? t.few.zero : head}</p>
      {court && passed === 0 && (
        <p>
          {t.few.court}{' '}
          <a href={withBase('paths/court-ordered/')}>{t.few.courtLink}</a>
        </p>
      )}
      {loosenable.length > 0 && (
        <>
          <p>{t.few.blocking}</p>
          <ul class="few__list">
            {loosenable.slice(0, 4).map((b) => (
              <li key={b.key}>
                <span>
                  <strong>{t.blocker[b.key] ?? b.key}</strong>
                  {': '}
                  {b.count === 1 ? t.few.comesBackOne : fill(t.few.comesBack, { n: b.count })}
                </span>
                <button type="button" class="btn btn--small btn--secondary" onClick={() => onLoosen(b.key)}>
                  {fill(t.few.loosen, { what: (t.blocker[b.key] ?? b.key).toLowerCase() })}
                </button>
              </li>
            ))}
          </ul>
          <p class="help">{t.few.loosenHelp}</p>
        </>
      )}
      {loosenable.length === 0 && !court && <p>{t.few.nothing}</p>}
    </div>
  );
}
