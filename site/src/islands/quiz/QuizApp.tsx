import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildCatalog } from '../../engine/catalog';
import type { Answers, FollowId } from '../../engine/types';
import { fetchGroups, fetchQuizConfig } from '../../lib/client-data';
import { fill } from '../../lib/inline';
import type { QuizConfig } from '../../lib/quiz-config';
import { withBase } from '../../lib/site';
import { store } from '../../lib/storage';
import type { Group } from '../../lib/types';
import { matches as tm, quiz as t } from '../../strings/en';
import * as S from './screens';
import { nextScreen, needsExtraScenes, newState, progressPercent, QUIZ_KEY, readState, shuffle, stepNumber, type QuizState, type ScreenId } from './state';
import { Progress } from './widgets';

// The quiz island: one decision per screen, every question skippable, saved in this browser so a
// reload picks up where the person left off. It downloads the vocabulary first (small), and the
// group list only once the person is a few screens in, so the first screens appear at once.

interface Props {
  dataVersion: string;
}

type Load = 'loading' | 'ready' | 'error';
type Late = typeof import('./late');

function savedProgress(s: QuizState | null): boolean {
  if (!s) return false;
  const a = s.answers;
  return s.screen !== 'start' || a.paths.length > 0 || a.scenes.length > 0 || a.picked.length > 0;
}

export default function QuizApp({ dataVersion }: Props) {
  const [cfg, setCfg] = useState<QuizConfig | null>(null);
  const [cfgLoad, setCfgLoad] = useState<Load>('loading');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QuizState>(() => newState());
  const [saved, setSaved] = useState<QuizState | null>(null);
  const [asked, setAsked] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupsLoad, setGroupsLoad] = useState<Load>('loading');
  const [groupsWanted, setGroupsWanted] = useState(false);
  const [late, setLate] = useState<Late | null>(null);
  const [lateFailed, setLateFailed] = useState(false);
  const [support, setSupport] = useState(false);
  const [moved, setMoved] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const pushed = useRef(0);

  // ---- read what was saved, and load the vocabulary
  useEffect(() => {
    const found = readState(store.getJSON<unknown>(QUIZ_KEY, null));
    if (found && savedProgress(found)) setSaved(found);
    else if (found) setState(found);
    setAsked(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCfgLoad('loading');
    fetchQuizConfig(dataVersion)
      .then((c) => {
        if (cancelled) return;
        setCfg(c);
        setCfgLoad('ready');
      })
      .catch(() => {
        if (!cancelled) setCfgLoad('error');
      });
    return () => {
      cancelled = true;
    };
  }, [dataVersion, attempt]);

  const cat = useMemo(() => (cfg ? buildCatalog(cfg) : null), [cfg]);
  const places = useMemo(() => Object.fromEntries((cfg?.neighborhoods ?? []).map((n) => [n.id, n.label])), [cfg]);

  // ---- the group list: asked for a few screens in, or when the results need it
  useEffect(() => {
    if (groupsWanted) return;
    const past = state.screen !== 'start' && state.screen !== 'hours' && state.screen !== 'court';
    if (past) setGroupsWanted(true);
  }, [state.screen, groupsWanted]);

  useEffect(() => {
    if (!groupsWanted) return;
    let cancelled = false;
    setGroupsLoad('loading');
    fetchGroups(dataVersion)
      .then((res) => {
        if (cancelled) return;
        setGroups(res.groups);
        setGroupsLoad('ready');
      })
      .catch(() => {
        if (!cancelled) setGroupsLoad('error');
      });
    return () => {
      cancelled = true;
    };
  }, [groupsWanted, dataVersion, attempt]);

  // The later screens and the matcher load in the background once the person is a few screens in.
  useEffect(() => {
    if (!groupsWanted || late) return;
    let cancelled = false;
    setLateFailed(false);
    import('./late')
      .then((m) => {
        if (!cancelled) setLate(m);
      })
      .catch(() => {
        if (!cancelled) setLateFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [groupsWanted, late, attempt]);

  // ---- save every change in this browser
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!asked || saved) return;
    store.setJSON(QUIZ_KEY, state);
    setBlocked(!store.persistent);
  }, [state, asked, saved]);

  const set = useCallback((patch: Partial<Answers>) => setState((s) => ({ ...s, answers: { ...s.answers, ...patch } })), []);

  // ---- moving between screens
  /** Move on without leaving this screen in the history: used by screens that skip themselves. */
  const replaceWith = useCallback((to: ScreenId) => setState((s) => ({ ...s, screen: to })), []);

  const goBack = useCallback(() => {
    setState((s) => {
      const prev = s.history[s.history.length - 1];
      if (!prev) return s;
      return { ...s, screen: prev, history: s.history.slice(0, -1) };
    });
    setMoved(true);
  }, []);

  const onBackButton = useCallback(() => {
    if (pushed.current > 0) window.history.back();
    else goBack();
  }, [goBack]);

  useEffect(() => {
    const onPop = () => {
      if (pushed.current > 0) pushed.current -= 1;
      goBack();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [goBack]);

  const next = useCallback(() => {
    if (!cat) return;
    setState((s0) => {
      let s = s0;
      // Leaving the scenes: decide whether the second set is worth showing.
      if (s.screen === 'scenes') s = { ...s, extra: needsExtraScenes(cat, s.answers.scenes) };
      // Leaving the interest tiles with one pick: that one is the favorite.
      if (s.screen === 'interests' && s.answers.picked.length === 1) s = { ...s, answers: { ...s.answers, starred: [...s.answers.picked] } };
      const to = nextScreen(s.screen, s.answers, s.extra);
      return { ...s, screen: to, history: [...s.history, s.screen] };
    });
    setMoved(true);
    try {
      window.history.pushState({ fyjQuiz: 'next' }, '');
      pushed.current += 1;
    } catch {
      // fine
    }
  }, [cat]);

  const goTo = useCallback((to: ScreenId) => {
    setState((s) => ({ ...s, screen: to, history: [...s.history, s.screen], tasteIds: [], tasteProbes: [], followIds: null }));
    setMoved(true);
  }, []);

  const restart = useCallback(() => {
    store.remove(QUIZ_KEY);
    setState(newState());
    setSaved(null);
    setSupport(false);
    setMoved(true);
  }, []);

  // ---- the taste test cards and the follow up questions, decided once
  const byId = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g])), [groups]);

  useEffect(() => {
    if (state.screen !== 'taste' || !cat || !groups || !late) return;
    if (state.tasteIds.length > 0) return;
    const cards = late.pickTasteCards(groups, cat, state.answers);
    if (cards.length === 0) {
      replaceWith(nextScreen('taste', state.answers, state.extra));
      return;
    }
    // The engine puts its strongest pick first. Shuffle, so no card is favored for being first.
    const order = shuffle(cards, state.seed, 'taste');
    setState((s) => ({ ...s, tasteIds: order.map((c) => c.group.id), tasteProbes: cards.filter((c) => c.probe).map((c) => c.group.id) }));
    // only when the screen or the data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, cat, groups, late, state.tasteIds.length]);

  useEffect(() => {
    if (state.screen !== 'follow') return;
    if (groupsLoad === 'error') {
      replaceWith('heard');
      return;
    }
    if (!cat || !groups || !late || state.followIds !== null) return;
    // Let the screen paint first: choosing questions runs the matcher a few times.
    const id = window.setTimeout(() => {
      const picks = late.pickFollowUps(groups, cat, state.answers).map((p) => p.id);
      setState((s) => ({ ...s, followIds: picks }));
    }, 30);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, cat, groups, late, state.followIds === null, groupsLoad]);

  useEffect(() => {
    if (state.screen === 'follow' && state.followIds !== null && state.followIds.length === 0) replaceWith('heard');
  }, [state.screen, state.followIds, replaceWith]);

  // The taste test and results need the groups. If they cannot load, skip what we can.
  useEffect(() => {
    if (state.screen === 'taste' && groupsLoad === 'error') replaceWith('heard');
  }, [state.screen, groupsLoad, replaceWith]);

  // ---------------------------------------------------------------- render

  if (cfgLoad === 'error') {
    return (
      <div class="callout" role="alert">
        <p>{t.loadError}</p>
        <button type="button" class="btn" onClick={() => setAttempt(attempt + 1)}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (!cfg || !cat || !asked) return <p role="status">{t.loading}</p>;

  if (saved) {
    const atResults = saved.screen === 'results';
    return (
      <div class="callout resume" role="region" aria-labelledby="resume-title">
        <h2 id="resume-title">{t.resume.title}</h2>
        <p>{t.resume.text}</p>
        <div class="btn-row">
          <button
            type="button"
            class="btn"
            onClick={() => {
              setState(saved);
              setSaved(null);
              setMoved(true);
              if (saved.screen === 'taste' || saved.screen === 'follow' || saved.screen === 'heard' || saved.screen === 'results') setGroupsWanted(true);
            }}
          >
            {atResults ? t.resume.results : t.resume.continue}
          </button>
          <button type="button" class="btn btn--quiet" onClick={restart}>
            {t.resume.restart}
          </button>
        </div>
      </div>
    );
  }

  const a = state.answers;
  const screen = state.screen;
  const props: S.ScreenProps = {
    a,
    set,
    cfg,
    cat,
    seed: state.seed,
    grabFocus: moved,
    canBack: state.history.length > 0,
    onBack: onBackButton,
    onNext: next,
  };

  const step = stepNumber(screen, a, state.extra);
  const percent = progressPercent(screen, a, state.extra);
  const showProgress = screen !== 'results';

  const needsLate = screen === 'taste' || screen === 'follow' || screen === 'heard' || screen === 'results';

  let body;
  if (needsLate && !late && lateFailed) {
    body = (
      <div class="callout" role="alert">
        <p>{t.loadError}</p>
        <button type="button" class="btn" onClick={() => setAttempt(attempt + 1)}>
          {t.retry}
        </button>
      </div>
    );
  } else switch (screen) {
    case 'start':
      body = <S.StartScreen {...props} support={support} setSupport={setSupport} />;
      break;
    case 'hours':
      body = <S.HoursScreen {...props} />;
      break;
    case 'court':
      body = <S.CourtScreen {...props} />;
      break;
    case 'kids':
      body = <S.KidsScreen {...props} />;
      break;
    case 'newcomer':
      body = <S.NewcomerScreen {...props} />;
      break;
    case 'student':
      body = <S.StudentScreen {...props} />;
      break;
    case 'scenes':
      body = <S.ScenesScreen {...props} />;
      break;
    case 'scenes_more':
      body = <S.ScenesMoreScreen {...props} />;
      break;
    case 'moments':
      body = <S.MomentsScreen {...props} />;
      break;
    case 'when':
      body = <S.WhenScreen {...props} />;
      break;
    case 'often':
      body = <S.OftenScreen {...props} />;
      break;
    case 'far':
      body = <S.FarScreen {...props} />;
      break;
    case 'budget':
      body = <S.BudgetScreen {...props} />;
      break;
    case 'rules_a':
      body = <S.RulesAScreen {...props} />;
      break;
    case 'rules_b':
      body = <S.RulesBScreen {...props} />;
      break;
    case 'interests':
      body = <S.InterestsScreen {...props} />;
      break;
    case 'stars':
      body = <S.StarsScreen {...props} />;
      break;
    case 'tags':
      body = <S.TagsScreen {...props} />;
      break;
    case 'motives1':
      body = <S.Motives1Screen {...props} />;
      break;
    case 'motives2':
      body = <S.Motives2Screen {...props} />;
      break;
    case 'meet':
      body = <S.MeetScreen {...props} />;
      break;
    case 'strangers':
      body = <S.StrangersScreen {...props} />;
      break;
    case 'newness':
      body = <S.NewnessScreen {...props} />;
      break;
    case 'future':
      body = <S.FutureScreen {...props} />;
      break;
    case 'taste': {
      const cards = state.tasteIds
        .map((id) => byId.get(id))
        .filter((g): g is Group => Boolean(g))
        .map((g) => ({ group: g, probe: state.tasteProbes.includes(g.id) }));
      body = late ? <late.TasteScreen {...props} cards={cards} loading={groupsLoad === 'loading' || (cards.length === 0 && groups !== null && state.tasteIds.length === 0)} places={places} /> : <p role="status">{t.taste.loadingGroups}</p>;
      break;
    }
    case 'follow':
      body = state.followIds === null || !late ? <p role="status">{t.follow.working}</p> : <late.FollowScreen {...props} ids={state.followIds as FollowId[]} />;
      break;
    case 'heard':
      body = late ? <late.HeardScreen {...props} cat={cat} cfg={cfg} goTo={(id) => goTo(id as ScreenId)} /> : <p role="status">{t.loading}</p>;
      break;
    case 'results':
      if (groupsLoad === 'error') {
        body = (
          <div class="callout" role="alert">
            <p>{tm.loadError}</p>
            <button type="button" class="btn" onClick={() => setAttempt(attempt + 1)}>
              {t.retry}
            </button>
          </div>
        );
      } else if (!groups || !late) {
        body = <p role="status">{tm.loading}</p>;
      } else {
        body = (
          <late.Results
            groups={groups}
            cat={cat}
            places={places}
            answers={a}
            setAnswers={set}
            onEdit={() => goTo('heard')}
            onRestart={restart}
          />
        );
      }
      break;
  }

  return (
    <div class="quiz">
      {showProgress && (
        <div class="quiz__top">
          <Progress percent={percent} label={fill(t.stepLabel, step)} />
          <p class="quiz__step">{fill(t.stepLabel, step)}</p>
        </div>
      )}
      {blocked && <p class="callout">{t.storageBlocked}</p>}
      {body}
      {screen !== 'results' && screen !== 'start' && (
        <p class="quiz__foot">
          {t.saved}{' '}
          <button type="button" class="linkish" onClick={restart}>
            {t.startOver}
          </button>
        </p>
      )}
      {screen === 'start' && (
        <p class="quiz__foot">
          {t.saved} <a href={withBase('privacy/')}>{t.privacyLink}</a>
        </p>
      )}
    </div>
  );
}
