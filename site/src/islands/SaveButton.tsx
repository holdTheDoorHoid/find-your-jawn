import { useEffect, useState } from 'preact/hooks';
import { isSaved, SAVED_EVENT, toggleSaved } from '../lib/saved';
import { withBase } from '../lib/site';
import { store } from '../lib/storage';
import { group as t } from '../strings/en';

interface Props {
  id: string;
}

/** Save or unsave one group. The list lives only in this browser. */
export default function SaveButton({ id }: Props) {
  const [saved, setSaved] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isSaved(store, id));
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [id]);

  function onClick() {
    const now = toggleSaved(store, id);
    setSaved(now);
    setBlocked(!store.persistent);
    try {
      window.dispatchEvent(new Event(SAVED_EVENT));
    } catch {
      // older browsers: the button still works
    }
  }

  return (
    <div class="save">
      <button type="button" class="btn btn--secondary" aria-pressed={saved} onClick={onClick}>
        {saved ? '✓ ' : ''}
        {t.save}
      </button>
      <p class="help status" role="status">
        {saved ? (
          <>
            {t.saved}. <a href={withBase('my-list/')}>{t.viewList}</a>
          </>
        ) : (
          t.saveHelp
        )}
        {blocked ? ` ${t.storageBlocked}` : ''}
      </p>
    </div>
  );
}
