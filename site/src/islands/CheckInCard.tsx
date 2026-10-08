import { useEffect, useState } from 'preact/hooks';
import { fill } from '../lib/inline';
import { fetchGroups, fetchQuizConfig } from '../lib/client-data';
import { groupPath, withBase } from '../lib/site';
import { store } from '../lib/storage';
import { checkin as t } from '../strings/en';
import { dateWords, todayString } from './quiz/ics';
import { PlanPanel, SharePanel } from './quiz/panels';
import { dueCheckIns, PLANS_EVENT, readPlans, updatePlan, type Obstacle, type Outcome, type PlannedVisit } from './quiz/plans';
import { QUIZ_KEY, readState } from './quiz/state';
import type { Result } from '../engine/types';

// "Did you go to the trail crew?" A small card that appears on the home page and the match page on a
// later visit, when a planned visit date has passed. It is dismissible and keeps its answers only in
// this browser. Nothing here is sent anywhere.

type Step = 'ask' | 'how' | 'next' | 'why' | 'fix';

interface Suggestion {
  label: string;
  result: Result;
}

async function loadSuggestions(plan: PlannedVisit, kind: 'rung' | Obstacle, dataVersion: string): Promise<Suggestion[]> {
  const [{ buildCatalog }, { nextRung, similarTo }, groupsFile, cfg] = await Promise.all([
    import('../engine/catalog'),
    import('../engine/checkin'),
    fetchGroups(dataVersion),
    fetchQuizConfig(dataVersion),
  ]);
  const cat = buildCatalog(cfg);
  const visited = groupsFile.groups.find((g) => g.id === plan.id);
  if (!visited) return [];
  const saved = readState(store.getJSON<unknown>(QUIZ_KEY, null));
  const base = saved && saved.answers.scenes.length + saved.answers.picked.length > 0 ? saved.answers : undefined;
  if (kind === 'rung') {
    const r = nextRung(groupsFile.groups, cat, visited, base);
    const out: Suggestion[] = [];
    for (const x of r.more) out.push({ label: t.nextMore, result: x });
    if (r.bigger) out.push({ label: t.nextBigger, result: r.bigger });
    if (r.stretch) out.push({ label: t.nextStretch, result: r.stretch });
    return out;
  }
  const opts = kind === 'cost' ? { cheaper: true } : kind === 'no_reply' ? { dropIn: true } : {};
  return similarTo(groupsFile.groups, cat, visited, base, opts).map((result) => ({ label: t.similar, result }));
}

export default function CheckInCard({ dataVersion }: { dataVersion: string }) {
  const [active, setActive] = useState<PlannedVisit | null>(null);
  const [step, setStep] = useState<Step>('ask');
  const [chosen, setChosen] = useState<Outcome | null>(null);
  const [obstacle, setObstacle] = useState<Obstacle | null>(null);
  const [ideas, setIdeas] = useState<Suggestion[] | null>(null);
  const [panel, setPanel] = useState<'plan' | 'share' | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Pick the visit to ask about once. After it is answered it is no longer "due", but the card stays
    // until the person closes it, so what happens next is not cut off.
    const sync = () => setActive((now) => now ?? dueCheckIns(readPlans(store), todayString())[0] ?? null);
    sync();
    window.addEventListener(PLANS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PLANS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const due = active;
  if (!due || gone) return null;

  const dismiss = () => {
    updatePlan(store, due.id, due.date, { status: 'dismissed' });
    setGone(true);
  };

  const went = (outcome: Outcome) => {
    updatePlan(store, due.id, due.date, { status: 'went', outcome });
    setChosen(outcome);
    setStep('next');
    setIdeas(null);
    loadSuggestions(due, 'rung', dataVersion)
      .then(setIdeas)
      .catch(() => setIdeas([]));
  };

  const notYet = (why: Obstacle) => {
    updatePlan(store, due.id, due.date, { status: 'not_yet', obstacle: why });
    setObstacle(why);
    setStep('fix');
    setIdeas(null);
    if (why === 'cost' || why === 'no_reply') {
      loadSuggestions(due, why, dataVersion)
        .then(setIdeas)
        .catch(() => setIdeas([]));
    }
  };

  return (
    <section class="checkin" aria-labelledby="checkin-title">
      <h2 id="checkin-title">{fill(t.title, { name: due.name })}</h2>
      {step === 'ask' && (
        <>
          <p>{fill(t.planned, { when: dateWords(due.date) })}</p>
          <div class="btn-row">
            <button type="button" class="btn" onClick={() => setStep('how')}>
              {t.yes}
            </button>
            <button type="button" class="btn btn--secondary" onClick={() => setStep('why')}>
              {t.notYet}
            </button>
            <button type="button" class="btn btn--quiet" aria-label={fill(t.dismissLabel, { name: due.name })} onClick={dismiss}>
              {t.dismiss}
            </button>
          </div>
        </>
      )}

      {step === 'how' && (
        <fieldset class="qgroup">
          <legend>{t.how}</legend>
          <div class="btn-row">
            {(['loved', 'okay', 'not_for_me'] as const).map((o) => (
              <button key={o} type="button" class="btn btn--secondary" onClick={() => went(o)}>
                {t.outcomes[o]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 'next' && chosen && (
        <>
          <p>{t.thanks[chosen]}</p>
          <p class="help">{t.honest}</p>
          <h3>{t.next}</h3>
          <Ideas ideas={ideas} loadingText={t.nextLoading} emptyText={t.nextNone} quiz />
          <div class="btn-row">
            <button type="button" class="btn btn--quiet" onClick={() => setGone(true)}>
              {t.close}
            </button>
          </div>
        </>
      )}

      {step === 'why' && (
        <fieldset class="qgroup">
          <legend>{t.whatHappened}</legend>
          <div class="btn-row">
            {(['time', 'nerves', 'cost', 'no_reply'] as const).map((o) => (
              <button key={o} type="button" class="btn btn--secondary" onClick={() => notYet(o)}>
                {t.obstacles[o]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 'fix' && obstacle && (
        <>
          <p>{t.fix[obstacle]}</p>
          {obstacle === 'time' && (
            <>
              {panel !== 'plan' ? (
                <div class="btn-row">
                  <button type="button" class="btn" onClick={() => setPanel('plan')}>
                    {t.planAgain}
                  </button>
                </div>
              ) : (
                <PlanPanel target={{ id: due.id, name: due.name }} onClose={() => setPanel(null)} onSaved={() => undefined} />
              )}
            </>
          )}
          {obstacle === 'nerves' && (
            <>
              <div class="btn-row">
                <button type="button" class="btn" onClick={() => setPanel(panel === 'share' ? null : 'share')} aria-expanded={panel === 'share'}>
                  {t.inviteFriend}
                </button>
                <a class="btn btn--secondary" href={`${withBase(groupPath(due.id))}#first`}>
                  {t.firstVisit}
                </a>
              </div>
              {panel === 'share' && <SharePanel target={{ id: due.id, name: due.name }} onClose={() => setPanel(null)} />}
            </>
          )}
          {(obstacle === 'cost' || obstacle === 'no_reply') && <Ideas ideas={ideas} loadingText={t.nextLoading} emptyText={t.none} />}
          <p class="help">{t.honest}</p>
          <div class="btn-row">
            <button type="button" class="btn btn--quiet" onClick={() => setGone(true)}>
              {t.close}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** One short line about why: the stretch sentence for a stretch, the first reason otherwise. */
function line(r: Result): string {
  if (r.kind === 'stretch' && r.stretchLine) return r.stretchLine.split(/(?<=\.)\s/)[0] ?? '';
  return r.why[0] ?? '';
}

function Ideas({ ideas, loadingText, emptyText, quiz }: { ideas: Suggestion[] | null; loadingText: string; emptyText: string; quiz?: boolean }) {
  if (ideas === null) return <p role="status">{loadingText}</p>;
  if (ideas.length === 0) {
    return (
      <p>
        {emptyText}{' '}
        {quiz && (
          <a href={withBase('match/')}>{t.nextQuiz}</a>
        )}
      </p>
    );
  }
  return (
    <ul class="checkin__list">
      {ideas.map(({ label, result }) => (
        <li key={`${label}-${result.group.id}`}>
          <strong>{label}: </strong>
          <a href={withBase(groupPath(result.group.id))}>{result.group.name}</a>
          {line(result) ? <span class="help"> {line(result)}</span> : null}
        </li>
      ))}
    </ul>
  );
}
