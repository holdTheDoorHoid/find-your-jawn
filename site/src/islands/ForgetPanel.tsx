import { useState } from 'preact/hooks';
import { SAVED_EVENT } from '../lib/saved';
import { store } from '../lib/storage';
import { myList as t } from '../strings/en';

type Phase = 'idle' | 'confirm' | 'done' | 'nothing';

/** The "forget everything" button: removes every fyj: key this site stored in the browser. */
export default function ForgetPanel({ heading = t.forgetTitle }: { heading?: string }) {
  const [phase, setPhase] = useState<Phase>('idle');

  function forget() {
    const removed = store.clearAll();
    try {
      window.dispatchEvent(new Event(SAVED_EVENT));
    } catch {
      // nothing else listens in old browsers
    }
    setPhase(removed > 0 ? 'done' : 'nothing');
  }

  return (
    <div class="forget">
      <h2>{heading}</h2>
      <p>{t.forgetText}</p>
      {phase === 'idle' && (
        <button type="button" class="btn btn--quiet" onClick={() => setPhase('confirm')}>
          {t.forgetButton}
        </button>
      )}
      {phase === 'confirm' && (
        <div class="btn-row" role="group" aria-label={t.forgetTitle}>
          <button type="button" class="btn" onClick={forget}>
            {t.forgetConfirm}
          </button>
          <button type="button" class="btn btn--quiet" onClick={() => setPhase('idle')}>
            {t.forgetCancel}
          </button>
        </div>
      )}
      <p class="status" role="status">
        {phase === 'done' ? t.forgetDone : phase === 'nothing' ? t.forgetNone : ''}
      </p>
    </div>
  );
}
