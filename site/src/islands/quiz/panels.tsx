import { useEffect, useRef, useState } from 'preact/hooks';
import type { Result } from '../../engine/types';
import { fill } from '../../lib/inline';
import { absoluteUrl, groupPath } from '../../lib/site';
import { store } from '../../lib/storage';
import { labels, plan as tp, share as ts } from '../../strings/en';
import { buildIcs, dateWords, defaultTime, icsFileName, nextDateOn, planSentence, todayString, weekdayOf, type PlanInput } from './ics';
import { addPlan } from './plans';
import { canNativeShare, shareData, shareMessage, smsHref } from './share';

// The two small panels under a result: Plan it, and Send to a friend.

function useFocusFirst<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/** What a plan needs to know about a group. A match result and a check in card both fill it in. */
export interface PlanTarget {
  id: string;
  name: string;
  /** days the group meets, when known, for a sensible first date and a gentle warning */
  days?: string[];
  times?: string[];
  firstStep?: string;
  where?: string;
}

export function targetOf(result: Result): PlanTarget {
  const g = result.group;
  const loc = g.locations.find((l) => l.address) ?? g.locations[0];
  return { id: g.id, name: g.name, days: g.schedule.days, times: g.schedule.times, firstStep: result.firstStep, where: loc?.address ?? undefined };
}

export function planInputFor(target: PlanTarget, date: string, time: string): PlanInput {
  return { id: target.id, name: target.name, date, time, firstStep: target.firstStep, url: absoluteUrl(groupPath(target.id)), where: target.where };
}

export function PlanPanel({ target, onClose, onSaved }: { target: PlanTarget; onClose: () => void; onSaved?: () => void }) {
  const g = { id: target.id, name: target.name, schedule: { days: target.days ?? [], times: target.times ?? [] } };
  const first = useFocusFirst<HTMLInputElement>();
  const [date, setDate] = useState(() => nextDateOn(new Date(), g.schedule.days));
  const [time, setTime] = useState(() => defaultTime(g.schedule.times));
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const today = todayString();
  const past = date !== '' && date < today;
  const valid = date !== '' && time !== '' && !past;
  const wd = valid ? weekdayOf(date) : null;
  const odd = wd !== null && g.schedule.days.length > 0 && !g.schedule.days.includes(wd);
  const days = g.schedule.days.map((d) => labels.dayLong[d] ?? d).join(', ');

  const save = (): boolean => {
    if (!valid) return false;
    addPlan(store, { id: g.id, name: g.name, date, time, made: today, status: 'planned' });
    setDone(true);
    onSaved?.();
    return true;
  };

  const download = () => {
    if (!save()) return;
    try {
      const input = planInputFor(target, date, time);
      const blob = new Blob([buildIcs(input)], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = icsFileName(input);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div class="rpanel" role="group" aria-label={tp.title}>
      <p class="rpanel__title">{tp.title}</p>
      <p class="help">{tp.help}</p>
      <div class="rpanel__fields">
        <div class="qfield">
          <label for={`plan-date-${g.id}`}>{tp.date}</label>
          <input ref={first} id={`plan-date-${g.id}`} type="date" min={today} value={date} aria-invalid={past} onInput={(e) => { setDate((e.currentTarget as HTMLInputElement).value); setDone(false); }} />
        </div>
        <div class="qfield">
          <label for={`plan-time-${g.id}`}>{tp.time}</label>
          <input id={`plan-time-${g.id}`} type="time" value={time} onInput={(e) => { setTime((e.currentTarget as HTMLInputElement).value); setDone(false); }} />
        </div>
      </div>
      {past && <p class="help" role="alert">{tp.past}</p>}
      {odd && <p class="help">{fill(tp.oddDay, { days })}</p>}
      <p class="rpanel__sentence" aria-live="polite">
        <span class="sr-only">{tp.sentenceLabel}: </span>
        {valid ? planSentence({ name: g.name, date, time }) : ''}
      </p>
      <div class="btn-row">
        <button type="button" class="btn btn--small" disabled={!valid} onClick={save}>
          {tp.save}
        </button>
        <button type="button" class="btn btn--small btn--secondary" disabled={!valid} onClick={download}>
          {tp.download}
        </button>
        <button type="button" class="btn btn--small btn--quiet" onClick={onClose}>
          {tp.close}
        </button>
      </div>
      <p class="help">{tp.reminders}</p>
      <p class="status" role="status">
        {failed ? tp.fileFailed : done ? tp.saved : ''}
      </p>
    </div>
  );
}

export function SharePanel({ target, onClose }: { target: { id: string; name: string }; onClose: () => void }) {
  const g = target;
  const message = shareMessage(g.name, g.id);
  const [status, setStatus] = useState('');
  const first = useFocusFirst<HTMLParagraphElement>();
  const native = canNativeShare();

  const doShare = async () => {
    try {
      await navigator.share(shareData(g.name, g.id));
    } catch {
      // the person closed the share sheet: nothing to say
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setStatus(ts.copied);
    } catch {
      setStatus(ts.copyFailed);
    }
  };

  return (
    <div class="rpanel" role="group" aria-label={fill(ts.title, { name: g.name })}>
      <p class="rpanel__title">{fill(ts.title, { name: g.name })}</p>
      <p class="help">{ts.help}</p>
      <p class="rpanel__message" ref={first} tabIndex={-1} aria-label={ts.messageLabel}>
        {message}
      </p>
      <div class="btn-row">
        {native && (
          <button type="button" class="btn btn--small" onClick={doShare}>
            {ts.native}
          </button>
        )}
        <button type="button" class={`btn btn--small${native ? ' btn--secondary' : ''}`} onClick={copy}>
          {ts.copy}
        </button>
        <a class="btn btn--small btn--secondary" href={smsHref(message)}>
          {ts.sms}
        </a>
        <button type="button" class="btn btn--small btn--quiet" onClick={onClose}>
          {ts.close}
        </button>
      </div>
      <p class="status" role="status">
        {status}
      </p>
    </div>
  );
}

export { dateWords };
