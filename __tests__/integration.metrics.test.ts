import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createNodeDriver } from '@/data/db/driver.node';
import { SCHEMA_VERSION, migrate, verifySchema } from '@/data/db/migrations';
import { ProgressRepository } from '@/data/db/progressRepository';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { getStrengthMetrics, recordsStrengthMetrics, registerStrengthMetrics } from '@/domain/analytics/metrics';
import { exerciseProgression, trainedExercises } from '@/domain/analytics/progression';
import { currentGoalValue } from '@/domain/analytics/goals';
import { patchHistorySet } from '@/domain/history/edit';
import { replayHistory } from '@/domain/history/recompute';
import { computeExerciseRecords, estimateOneRepMaxOrNull } from '@/domain/records';
import { deleteHistorySession, saveHistorySession } from '@/store/historyActions';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';
import { done, exercise, local, session } from '@/test/fixtures/sessions';

/**
 * Phase 3 + Phase 4 integration (ADR-012): one strength engine. A session
 * finished live in the workout store, a history replay after an edit, the
 * Records section and the exercise chart must all agree, and a deleted or
 * corrected session must never leave a stale record behind.
 */

const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
const active = () => useWorkoutStore.getState().activeSession!;
const history = () => useWorkoutStore.getState().history;

/** Registers the resolver the way boot does, so replays see the same weight types as the live finish. */
const registerLibraryResolver = () =>
  registerStrengthMetrics((exerciseId) => useWorkoutStore.getState().exercises.find((item) => item.id === exerciseId)?.weightType ?? 'total');

/** Finishes Full Body A with leg press at `weightKg` × `reps` on every set, `daysAgo` days before 2 Nov 2026. */
function finishLegPress(weightKg: number, reps: number, daysAgo: number): WorkoutSession {
  const store = useWorkoutStore.getState();
  jest.setSystemTime(new Date(Date.parse('2026-11-02T10:00:00.000Z') - daysAgo * 86_400_000));
  const started = store.startWorkout({ dayIndex: 0 });
  if (!started.ok) throw new Error(started.reason);
  const ex = active().exercises[0];
  expect(ex.exerciseId).toBe('leg_press');
  for (const set of ex.sets) store.completeSet(ex.id, set.id, { weightKg, reps });
  jest.setSystemTime(Date.now() + 50 * 60_000); // a 50-minute workout
  const finished = store.finishWorkout('repeat');
  if (!finished) throw new Error('finish failed');
  return finished;
}

beforeEach(() => {
  attachPersistence(null);
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
  useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
  registerLibraryResolver();
});
afterEach(() => {
  registerStrengthMetrics(null);
  jest.useRealTimers();
});

describe('one strength engine', () => {
  it('a live finish and a history replay produce identical summaries', () => {
    finishLegPress(100, 12, 14);
    finishLegPress(100, 12, 10);
    const third = finishLegPress(102.5, 8, 6);
    expect(third.summary?.personalRecords.map((r) => [r.kind, r.value, r.previous])).toEqual([['top_weight', 102.5, 100]]);

    const replayed = replayHistory(history(), 0);
    // Same objects: nothing had to be recomputed, so the write-through diff would write nothing.
    expect(replayed).toHaveLength(3);
    replayed.forEach((s, i) => expect(s).toBe(history()[i]));
  });

  it('records and the exercise chart agree on top weight and e1RM', () => {
    finishLegPress(100, 12, 14);
    finishLegPress(105, 10, 10);
    finishLegPress(110, 6, 6);
    const records = computeExerciseRecords(history(), 'leg_press', 'total');
    const points = exerciseProgression(history(), 'leg_press');
    expect(Math.max(...points.map((p) => p.topWeightKg))).toBe(records.topWeight?.value);
    expect(Math.max(...points.map((p) => p.bestE1rmKg))).toBeCloseTo(records.bestEstimated1rm!.value, 10);
    expect(trainedExercises(history()).find((e) => e.exerciseId === 'leg_press')).toMatchObject({ sessions: 3, topWeightKg: 110, bestE1rmKg: records.bestEstimated1rm!.value });
    const goal = currentGoalValue({ kind: 'exercise_e1rm', exerciseId: 'leg_press', bodyMetric: null }, { history: history(), bodyEntries: [], now: new Date(), weekStart: 'monday' });
    expect(goal).toBeCloseTo(records.bestEstimated1rm!.value, 10);
  });

  it('sets above the e1RM cap get no estimate anywhere: no record, no chart point, no goal value', () => {
    const sessions = [session(local(2026, 10, 1), [exercise('bench', [done(50, 15), done(50, 15)])])];
    expect(estimateOneRepMaxOrNull(50, 15)).toBeNull();
    expect(getStrengthMetrics().estimateOneRepMax(50, 15)).toBe(0);
    expect(computeExerciseRecords(sessions, 'bench', 'total').bestEstimated1rm).toBeNull();
    const [point] = exerciseProgression(sessions, 'bench');
    expect(point).toMatchObject({ topWeightKg: 50, volumeKg: 1500, reps: 30, bestE1rmKg: 0, bestSet: null });
    expect(currentGoalValue({ kind: 'exercise_e1rm', exerciseId: 'bench', bodyMetric: null }, { history: sessions, bodyEntries: [], now: new Date(), weekStart: 'monday' })).toBe(0);
  });

  it('bodyweight, assisted and warm-up rules reach the chart through the registered resolver', () => {
    const store = useWorkoutStore.getState();
    const pullUp = store.exercises.find((e) => e.weightType === 'assisted' || e.weightType === 'bodyweight');
    expect(pullUp).toBeDefined();
    const sessions = [
      session(local(2026, 10, 1), [exercise(pullUp!.id, [done(0, 8, { type: 'warmup' }), done(0, 8)])]),
      session(local(2026, 10, 8), [exercise(pullUp!.id, [done(0, 10)])]),
    ];
    const replayed = replayHistory(sessions, 0);
    const newest = replayed[0];
    // Reps-at-weight only (no load record), via the library-backed weight type.
    expect(newest.summary?.personalRecords.map((r) => r.kind)).toEqual(['reps_at_weight']);
    expect(replayed).toEqual(replayHistory(sessions, 0, recordsStrengthMetrics)); // 0 kg: total and bodyweight agree on reps
  });
});

describe('history corrections keep derived metrics honest', () => {
  it('editing an earlier session moves a record to the later session that now beats it', () => {
    finishLegPress(100, 12, 14);
    const middle = finishLegPress(110, 8, 10);
    const latest = finishLegPress(105, 8, 6);
    expect(middle.summary?.personalRecords.map((r) => r.kind)).toEqual(expect.arrayContaining(['top_weight']));
    expect(latest.summary?.personalRecords.find((r) => r.kind === 'top_weight')).toBeUndefined();

    // Correct the typo: the middle session was 100 kg, not 110.
    const sx = middle.exercises[0];
    let edited = middle;
    for (const set of sx.sets) edited = patchHistorySet(edited, sx.id, set.id, { weightKg: 100 });
    const result = saveHistorySession(edited);
    expect(result).toMatchObject({ ok: true });

    const after = history();
    const newMiddle = after.find((s) => s.id === middle.id)!;
    const newLatest = after.find((s) => s.id === latest.id)!;
    expect(newMiddle.summary?.personalRecords.find((r) => r.kind === 'top_weight')).toBeUndefined();
    expect(newLatest.summary?.personalRecords.find((r) => r.kind === 'top_weight')).toMatchObject({ value: 105, previous: 100 });
    // The Records section reads the same history and now agrees.
    expect(computeExerciseRecords(after, 'leg_press', 'total').topWeight).toMatchObject({ value: 105, sessionId: latest.id });
    // Untouched session keeps its object; a second replay is a no-op.
    expect(after.find((s) => s.id !== middle.id && s.id !== latest.id)).toBe(history().find((s) => s.id !== middle.id && s.id !== latest.id));
    replayHistory(after, 0).forEach((s, i) => expect(s).toBe(after[i]));
  });

  it('deleting a session leaves no record pointing at its sets, and later records are rebuilt', () => {
    finishLegPress(100, 12, 14);
    const pr = finishLegPress(110, 8, 10);
    const latest = finishLegPress(105, 8, 6);
    expect(deleteHistorySession(pr.id)).toBe(true);
    const after = history();
    expect(after.map((s) => s.id)).not.toContain(pr.id);
    const setIds = new Set(after.flatMap((s) => s.exercises.flatMap((e) => e.sets.map((set) => set.id))));
    for (const record of after.flatMap((s) => s.summary?.personalRecords ?? [])) expect(setIds.has(record.setId)).toBe(true);
    expect(after.find((s) => s.id === latest.id)?.summary?.personalRecords.find((r) => r.kind === 'top_weight')).toMatchObject({ value: 105, previous: 100 });
    const records = computeExerciseRecords(after, 'leg_press', 'total');
    expect(records.topWeight?.sessionId).toBe(latest.id);
    expect(records.events.every((event) => setIds.has(event.setId))).toBe(true);
  });

  it('a failed write rolls the edit back and leaves records as they were', () => {
    finishLegPress(100, 12, 14);
    const latest = finishLegPress(105, 8, 6);
    attachPersistence({
      persist: () => {
        throw new Error('disk full');
      },
    });
    const sx = latest.exercises[0];
    const edited = patchHistorySet(latest, sx.id, sx.sets[0].id, { weightKg: 120 });
    const result = saveHistorySession(edited);
    expect(result.ok).toBe(false);
    expect(history().find((s) => s.id === latest.id)).toBe(latest);
    expect(computeExerciseRecords(history(), 'leg_press', 'total').topWeight?.value).toBe(105);
    expect(useWorkoutStore.getState().persistenceError).toContain('disk full');
  });
});

describe('real simulator database from the Phase 3 build', () => {
  it('upgrades the captured Phase 3 v7 file to the combined schema with its sessions and decision intact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gymrat-'));
    const path = join(dir, 'gymrat.db');
    copyFileSync(join(__dirname, '..', 'test', 'fixtures', 'sim-phase3-v7.db'), path);
    const driver = createNodeDriver(path);
    const before = {
      sessions: driver.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')!.n,
      sets: driver.get<{ n: number }>('SELECT COUNT(*) AS n FROM sets')!.n,
      decisions: driver.all('SELECT exercise_id, recommendation_json FROM session_exercises WHERE recommendation_json IS NOT NULL'),
    };
    expect(before.sessions).toBe(3);
    expect(before.decisions).toHaveLength(1);
    const backup = jest.fn();
    const onRepair = jest.fn();
    expect(migrate(driver, { backup, onRepair })).toEqual({ from: 7, to: SCHEMA_VERSION, applied: [8, 9] });
    expect(backup).toHaveBeenCalledWith(7);
    expect(onRepair).not.toHaveBeenCalled();
    expect(() => verifySchema(driver)).not.toThrow();
    expect(driver.get('SELECT COUNT(*) AS n FROM sessions')).toEqual({ n: before.sessions });
    expect(driver.get('SELECT COUNT(*) AS n FROM sets')).toEqual({ n: before.sets });
    expect(driver.all('SELECT exercise_id, recommendation_json FROM session_exercises WHERE recommendation_json IS NOT NULL')).toEqual(before.decisions);
    const loaded = new WorkoutRepository(driver).loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
    expect(loaded.history).toHaveLength(2);
    expect(loaded.activeSession?.exercises[0].recommendation).toMatchObject({ decision: 'accepted', weightKg: 102.5 });
    expect(new ProgressRepository(driver).loadAll()).toEqual({ bodyEntries: [], goals: [] });
    expect(migrate(driver)).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
  });
});
