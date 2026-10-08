import { useEffect, useState } from 'preact/hooks';
import { fill } from '../lib/inline';
import { groupPath, withBase } from '../lib/site';
import { store } from '../lib/storage';
import { plan as t } from '../strings/en';
import { dateWords, timeWords, todayString } from './quiz/ics';
import { PLANS_EVENT, readPlans, updatePlan, type PlannedVisit } from './quiz/plans';

/** The visits a person planned and the ones they went to, on the My list page. Kept only in this browser. */
export default function PlannedVisits() {
  const [plans, setPlans] = useState<PlannedVisit[]>([]);

  useEffect(() => {
    const sync = () => setPlans(readPlans(store));
    sync();
    window.addEventListener(PLANS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PLANS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const today = todayString();
  const ahead = plans.filter((p) => p.status === 'planned' && p.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const waiting = plans.filter((p) => p.status === 'planned' && p.date < today);
  const went = plans.filter((p) => p.status === 'went').sort((a, b) => (a.date < b.date ? 1 : -1));
  if (ahead.length + waiting.length + went.length === 0) return null;

  const drop = (p: PlannedVisit) => updatePlan(store, p.id, p.date, { status: 'dismissed' });

  const row = (p: PlannedVisit, removable: boolean) => (
    <li key={`${p.id}-${p.date}`} class="plan-row">
      <span>
        <a href={withBase(groupPath(p.id))}>{p.name}</a>
        <span class="help"> {fill(t.upcoming, { when: `${dateWords(p.date)} at ${timeWords(p.time)}` })}</span>
      </span>
      {removable && (
        <button type="button" class="btn btn--quiet btn--small" aria-label={fill(t.removeLabel, { name: p.name })} onClick={() => drop(p)}>
          {t.remove}
        </button>
      )}
    </li>
  );

  return (
    <section class="planned" aria-labelledby="planned-title">
      <h2 id="planned-title">{t.mineTitle}</h2>
      {ahead.length + waiting.length > 0 ? (
        <ul class="plan-list">
          {ahead.map((p) => row(p, true))}
          {waiting.map((p) => row(p, true))}
        </ul>
      ) : (
        <p class="help">{t.mineEmpty}</p>
      )}
      {went.length > 0 && (
        <>
          <h3>{t.wentTitle}</h3>
          <ul class="plan-list">{went.map((p) => row(p, false))}</ul>
        </>
      )}
    </section>
  );
}
