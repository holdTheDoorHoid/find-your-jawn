import { describe, expect, it } from 'vitest';
import { createStore, type Backend } from '../../lib/storage';
import { addPlan, dueCheckIns, readPlans, updatePlan, upcoming, type PlannedVisit } from './plans';

function memoryBackend(): Backend {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function freshStore() {
  const backend = memoryBackend();
  return createStore(() => backend);
}

const plan = (over: Partial<PlannedVisit> = {}): PlannedVisit => ({ id: 'trail-crew', name: 'Trail Crew', date: '2026-10-10', time: '09:00', made: '2026-10-08', status: 'planned', ...over });

describe('planned visits', () => {
  it('are kept under the quiz’s own key, in this browser', () => {
    const backend = memoryBackend();
    const store = createStore(() => backend);
    addPlan(store, plan());
    expect(backend.getItem('fyj:plans')).toContain('trail-crew');
  });

  it('read back, and a second plan for the same group and day replaces the first', () => {
    const store = freshStore();
    addPlan(store, plan());
    addPlan(store, plan({ time: '10:30' }));
    addPlan(store, plan({ date: '2026-10-17' }));
    const got = readPlans(store);
    expect(got).toHaveLength(2);
    expect(got.find((p) => p.date === '2026-10-10')?.time).toBe('10:30');
  });

  it('ignore damaged entries', () => {
    const store = freshStore();
    store.setJSON('plans', { v: 1, items: [plan(), { id: 'Bad Id', name: 'x', date: '2026-10-10' }, { id: 'ok', name: '', date: '2026-10-10' }, { id: 'ok2', name: 'x', date: 'soon' }, 'junk', null] });
    expect(readPlans(store).map((p) => p.id)).toEqual(['trail-crew']);
    store.set('plans', 'not json');
    expect(readPlans(store)).toEqual([]);
  });

  it('work when the browser will not store anything', () => {
    const store = createStore(() => null);
    addPlan(store, plan());
    expect(readPlans(store)).toHaveLength(1);
    expect(store.persistent).toBe(false);
  });
});

describe('check ins', () => {
  const plans = [plan({ id: 'a', date: '2026-10-01' }), plan({ id: 'b', date: '2026-10-05' }), plan({ id: 'c', date: '2026-10-08' }), plan({ id: 'd', date: '2026-10-12' }), plan({ id: 'e', date: '2026-09-20', status: 'went' }), plan({ id: 'f', date: '2026-09-21', status: 'dismissed' })];

  it('ask only about visits whose day has passed and that nobody answered', () => {
    expect(dueCheckIns(plans, '2026-10-08').map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('wait until a later day, not the day of the visit', () => {
    expect(dueCheckIns([plan({ date: '2026-10-08' })], '2026-10-08')).toEqual([]);
    expect(dueCheckIns([plan({ date: '2026-10-08' })], '2026-10-09')).toHaveLength(1);
  });

  it('ask about the most recent visit first', () => {
    expect(dueCheckIns(plans, '2026-10-08')[0]!.id).toBe('b');
  });

  it('stop asking once answered or dismissed', () => {
    const store = freshStore();
    addPlan(store, plan({ date: '2026-10-01' }));
    expect(dueCheckIns(readPlans(store), '2026-10-08')).toHaveLength(1);
    updatePlan(store, 'trail-crew', '2026-10-01', { status: 'went', outcome: 'loved' });
    expect(dueCheckIns(readPlans(store), '2026-10-08')).toHaveLength(0);
    expect(readPlans(store)[0]!.outcome).toBe('loved');
  });

  it('remember what got in the way', () => {
    const store = freshStore();
    addPlan(store, plan({ date: '2026-10-01' }));
    updatePlan(store, 'trail-crew', '2026-10-01', { status: 'not_yet', obstacle: 'nerves' });
    expect(readPlans(store)[0]).toMatchObject({ status: 'not_yet', obstacle: 'nerves' });
  });

  it('list plans still ahead, soonest first', () => {
    expect(upcoming(plans, '2026-10-08').map((p) => p.id)).toEqual(['c', 'd']);
  });
});
