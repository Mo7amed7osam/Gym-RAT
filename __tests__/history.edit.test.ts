import { createNodeDriver } from '@/data/db/driver.node';
import { migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import {
  addHistorySet,
  patchHistorySet,
  removeHistoryExercise,
  removeHistorySet,
  setHistoryNotes,
  setHistoryTimes,
  validateHistorySession,
} from '@/domain/history/edit';
import { commitSessionEdit, removeFromHistory, replayHistory, summarize } from '@/domain/history/recompute';
import { baselineStrengthMetrics } from '@/domain/analytics/metrics';
import { deleteHistorySession, saveHistorySession } from '@/store/historyActions';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';
import { done, exercise, local, newestFirst, session, set } from '@/test/fixtures/sessions';

const NOW = local(2026, 11, 2, 12).getTime();

/** Three bench sessions with summaries as the app would have stored them at finish time. */
function benchHistory(): WorkoutSession[] {
  const chronological = [
    session(local(2026, 10, 1), [exercise('bench', [done(60, 10)])]),
    session(local(2026, 10, 8), [exercise('bench', [done(70, 8)])]),
    session(local(2026, 10, 15), [exercise('bench', [done(75, 8)])]),
  ];
  return replayHistory(chronological, 0, baselineStrengthMetrics);
}

const byStart = (history: WorkoutSession[], date: Date) => history.find((s) => s.startedAt === date.toISOString())!;

describe('edit operations', () => {
  const base = session(local(2026, 10, 1), [exercise('bench', [done(60, 10), set({ weightKg: 60 })])]);
  const sx = base.exercises[0];

  it('patches a set and stamps completion at the session end', () => {
    const edited = patchHistorySet(base, sx.id, sx.sets[1].id, { reps: 9, completed: true });
    expect(edited.exercises[0].sets[1]).toMatchObject({ reps: 9, completed: true, completedAt: base.finishedAt });
    const unticked = patchHistorySet(edited, sx.id, sx.sets[0].id, { completed: false });
    expect(unticked.exercises[0].sets[0].completedAt).toBeNull();
    expect(base.exercises[0].sets[1].reps).toBeNull(); // input untouched
  });

  it('adds a completed copy of the last set and renumbers on removal', () => {
    const withExtra = addHistorySet(base, sx.id, 'new-set');
    const sets = withExtra.exercises[0].sets;
    expect(sets).toHaveLength(3);
    expect(sets[2]).toMatchObject({ id: 'new-set', setNumber: 3, weightKg: 60, reps: null, completed: false });
    const fromLogged = addHistorySet(patchHistorySet(base, sx.id, sx.sets[1].id, { reps: 8, completed: true }), sx.id, 'n2');
    expect(fromLogged.exercises[0].sets[2]).toMatchObject({ reps: 8, completed: true });

    const removed = removeHistorySet(withExtra, sx.id, sx.sets[0].id);
    expect(removed.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(removeHistorySet(base, sx.id, 'missing')).toBe(base);
  });

  it('removes exercises and edits notes', () => {
    expect(removeHistoryExercise(base, sx.id).exercises).toHaveLength(0);
    expect(setHistoryNotes(base, 'felt strong').notes).toBe('felt strong');
  });

  it('moves times into endedAtOverride and clamps pauses to the new window', () => {
    const paused: WorkoutSession = {
      ...base,
      pausedIntervals: [
        { from: local(2026, 10, 1, 18, 10).toISOString(), to: local(2026, 10, 1, 18, 20).toISOString() },
        { from: local(2026, 10, 1, 18, 50).toISOString(), to: local(2026, 10, 1, 18, 55).toISOString() },
      ],
    };
    const edited = setHistoryTimes(paused, local(2026, 10, 1, 18, 15).toISOString(), local(2026, 10, 1, 18, 45).toISOString());
    expect(edited.finishedAt).toBe(base.finishedAt);
    expect(edited.endedAtOverride).toBe(local(2026, 10, 1, 18, 45).toISOString());
    expect(edited.pausedIntervals).toEqual([{ from: local(2026, 10, 1, 18, 15).toISOString(), to: local(2026, 10, 1, 18, 20).toISOString() }]);
    expect(summarize(edited, [], baselineStrengthMetrics)).toMatchObject({ durationSeconds: 30 * 60, activeSeconds: 25 * 60 });
  });
});

describe('validation', () => {
  const base = session(local(2026, 10, 1), [exercise('bench', [done(60, 10)])]);
  const setId = base.exercises[0].sets[0].id;
  const sxId = base.exercises[0].id;
  const codes = (s: WorkoutSession) => validateHistorySession(s, NOW).map((e) => e.code);

  it('accepts a normal session', () => expect(codes(base)).toEqual([]));

  it('rejects impossible times', () => {
    expect(codes(setHistoryTimes(base, base.startedAt, base.startedAt))).toEqual(['end_before_start']);
    expect(codes(setHistoryTimes(base, base.startedAt, local(2026, 10, 3).toISOString()))).toEqual(['too_long']);
    expect(codes(setHistoryTimes(base, local(2026, 11, 5).toISOString(), local(2026, 11, 5, 19).toISOString()))).toEqual(['in_future']);
    expect(codes({ ...base, startedAt: 'nope' })).toEqual(['invalid_time']);
  });

  it('rejects bad numbers and completed sets without reps', () => {
    expect(codes(patchHistorySet(base, sxId, setId, { weightKg: -5 }))).toEqual(['invalid_weight']);
    expect(codes(patchHistorySet(base, sxId, setId, { weightKg: Number.NaN }))).toEqual(['invalid_weight']);
    expect(codes(patchHistorySet(base, sxId, setId, { reps: 7.5 }))).toEqual(['invalid_reps']);
    expect(codes(patchHistorySet(base, sxId, setId, { reps: null }))).toEqual(['missing_reps']);
    expect(validateHistorySession(patchHistorySet(base, sxId, setId, { reps: -1 }), NOW)[0]).toEqual({ code: 'invalid_reps', setId });
  });

  it('refuses sessions that are not finished', () => {
    expect(codes({ ...base, status: 'in_progress' })).toContain('not_completed');
  });
});

describe('replay recompute', () => {
  it('keeps references for sessions whose summary did not change', () => {
    const history = benchHistory();
    const again = replayHistory(history, 0, baselineStrengthMetrics);
    again.forEach((s, i) => expect(s).toBe(history[i]));
  });

  it('builds the same summaries the app stores at finish time', () => {
    const history = benchHistory();
    const latest = byStart(history, local(2026, 10, 15));
    expect(latest.summary).toMatchObject({ totalVolumeKg: 600, completedSets: 1, totalSets: 1, durationSeconds: 3600 });
    expect(latest.summary!.personalRecords.map((r) => r.kind)).toEqual(['top_weight', 'estimated_1rm']);
    // First ever session: nothing to beat.
    expect(byStart(history, local(2026, 10, 1)).summary!.personalRecords).toEqual([]);
  });

  it('moves records to later sessions when an earlier one is corrected upward', () => {
    const history = benchHistory();
    const first = byStart(history, local(2026, 10, 1));
    const sx = first.exercises[0];
    const edited = patchHistorySet(first, sx.id, sx.sets[0].id, { weightKg: 100 });

    const result = commitSessionEdit(history, edited, NOW, baselineStrengthMetrics);
    if (!result.ok) throw new Error('expected ok');
    const next = result.history;
    expect(byStart(next, local(2026, 10, 1)).summary!.totalVolumeKg).toBe(1000);
    // 70 × 8 and 75 × 8 no longer beat 100 kg: their PRs disappear.
    expect(byStart(next, local(2026, 10, 8)).summary!.personalRecords).toEqual([]);
    expect(byStart(next, local(2026, 10, 15)).summary!.personalRecords).toEqual([]);
    expect(next.map((s) => s.startedAt)).toEqual(history.map((s) => s.startedAt));
  });

  it('only touches sessions from the earliest affected start, and re-sorts moved sessions', () => {
    const history = benchHistory();
    const latest = byStart(history, local(2026, 10, 15));
    // Moving the last session before the others makes it the first bench ever.
    const moved = setHistoryTimes(latest, local(2026, 9, 20).toISOString(), local(2026, 9, 20, 19).toISOString());
    const result = commitSessionEdit(history, moved, NOW, baselineStrengthMetrics);
    if (!result.ok) throw new Error('expected ok');
    expect(result.history.map((s) => s.id)).toEqual([
      byStart(history, local(2026, 10, 8)).id,
      byStart(history, local(2026, 10, 1)).id,
      latest.id,
    ]);
    expect(result.history[2].summary!.personalRecords).toEqual([]);
    // 60 × 10 no longer beats anything; 70 × 8 still does not beat 75 kg.
    expect(byStart(result.history, local(2026, 10, 1)).summary!.personalRecords).toEqual([]);
  });

  it('refuses invalid edits without changing anything', () => {
    const history = benchHistory();
    const first = history[2];
    const bad = patchHistorySet(first, first.exercises[0].id, first.exercises[0].sets[0].id, { reps: -2 });
    const result = commitSessionEdit(history, bad, NOW, baselineStrengthMetrics);
    expect(result.ok).toBe(false);
    expect(commitSessionEdit(history, { ...first, id: 'unknown' }, NOW).ok).toBe(false);
  });

  it('hands records back to later sessions when the record session is deleted', () => {
    const history = benchHistory();
    const middle = byStart(history, local(2026, 10, 8));
    const next = removeFromHistory(history, middle.id, baselineStrengthMetrics);
    expect(next).toHaveLength(2);
    const latest = byStart(next, local(2026, 10, 15));
    expect(latest.summary!.personalRecords.find((r) => r.kind === 'top_weight')).toMatchObject({ value: 75, previous: 60 });
    // Earlier session untouched (same object).
    expect(byStart(next, local(2026, 10, 1))).toBe(byStart(history, local(2026, 10, 1)));
  });

  it('leaves non-completed sessions in place', () => {
    const cancelled = session(local(2026, 10, 10), [exercise('bench', [done(500, 1)])], { status: 'cancelled' });
    const history = newestFirst([...benchHistory(), cancelled]);
    const replayed = replayHistory(history, 0, baselineStrengthMetrics);
    expect(replayed).toContain(cancelled);
    expect(byStart(replayed, local(2026, 10, 15)).summary!.personalRecords).toHaveLength(2);
  });
});

describe('store glue (one transaction through the write-through)', () => {
  const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };

  function boot(history: WorkoutSession[]) {
    const driver = createNodeDriver();
    migrate(driver);
    const repo = new WorkoutRepository(driver);
    attachPersistence(null);
    useWorkoutStore.setState({ exercises: [], plans: [], activeSession: null, history: [], persistenceError: null, ...defaults });
    attachPersistence({ persist: (prev, next) => repo.persistDiff(prev, next) });
    useWorkoutStore.setState({ history });
    return { driver, repo };
  }

  afterEach(() => attachPersistence(null));

  it('persists the edit and every recomputed summary, and reloads identically', () => {
    const { repo } = boot(benchHistory());
    const first = byStart(useWorkoutStore.getState().history, local(2026, 10, 1));
    const sx = first.exercises[0];
    const result = saveHistorySession(patchHistorySet(first, sx.id, sx.sets[0].id, { weightKg: 100 }), NOW);
    expect(result.ok).toBe(true);

    const reloaded = repo.loadAll(defaults).history;
    expect(reloaded.map((s) => s.summary)).toEqual(useWorkoutStore.getState().history.map((s) => s.summary));
    expect(byStart(reloaded, local(2026, 10, 1)).exercises[0].sets[0].weightKg).toBe(100);
    expect(byStart(reloaded, local(2026, 10, 15)).summary!.personalRecords).toEqual([]);
  });

  it('keeps state and database unchanged when the write fails', () => {
    const { repo } = boot(benchHistory());
    const before = useWorkoutStore.getState().history;
    attachPersistence({
      persist: () => {
        throw new Error('disk full');
      },
    });
    const first = before[2];
    const result = saveHistorySession(patchHistorySet(first, first.exercises[0].id, first.exercises[0].sets[0].id, { weightKg: 100 }), NOW);
    expect(result).toMatchObject({ ok: false, persistenceError: 'disk full' });
    expect(useWorkoutStore.getState().history).toBe(before);
    expect(byStart(repo.loadAll(defaults).history, local(2026, 10, 1)).exercises[0].sets[0].weightKg).toBe(60);
  });

  it('deletes with recompute and persists', () => {
    const { repo } = boot(benchHistory());
    const middle = byStart(useWorkoutStore.getState().history, local(2026, 10, 8));
    expect(deleteHistorySession(middle.id)).toBe(true);
    expect(deleteHistorySession('missing')).toBe(false);
    const reloaded = repo.loadAll(defaults).history;
    expect(reloaded).toHaveLength(2);
    expect(byStart(reloaded, local(2026, 10, 15)).summary!.personalRecords).toHaveLength(2);
  });
});
