import { evaluateSession, recommend, type ProgressionInput } from '@/domain/progression';
import type { ExerciseSet, WorkoutSession } from '@/types/workout';

/** Phase 3 W2 — progressive-overload rules, one case per numbered rule. */

let counter = 0;
const set = (weightKg: number, reps: number, extra: Partial<ExerciseSet> = {}): ExerciseSet => ({
  id: `s${++counter}`, setNumber: counter, type: 'working', kind: 'normal', targetReps: { min: 8, max: 12 }, weightKg, reps, rpe: null, rir: null, completed: true, completedAt: null, ...extra,
});
const session = (id: string, daysAgo: number, sets: ExerciseSet[], exerciseId = 'leg_press'): WorkoutSession => {
  const at = new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
  return {
    id, schemaVersion: 2, kind: 'plan', planId: 'p', planDayId: 'd', title: { en: 'x', ar: 'x' }, code: 'X', focus: null, status: 'completed', startedAt: at, finishedAt: at,
    endedAtOverride: null, pausedIntervals: [],
    exercises: [{ id: `${id}e`, exerciseId, prescription: { exerciseId, sets: sets.length, reps: { min: 8, max: 12 }, rest: { defaultSeconds: 90, minSeconds: 90, maxSeconds: 90 } }, sets, skipped: false, notes: '', groupId: null, groupKind: null, recommendation: null }],
    deferredIds: [], currentExerciseIndex: 0, warmupCompletedIds: [], notes: '', summary: null,
  };
};
const NOW = '2026-11-02T10:00:00.000Z';
const input = (history: WorkoutSession[], overrides: Partial<ProgressionInput> = {}): ProgressionInput => ({
  history, exerciseId: 'leg_press', prescription: { reps: { min: 8, max: 12 } }, weightType: 'total', stepKg: 2.5, stepPerHandKg: 1, now: NOW, ...overrides,
});

beforeEach(() => { counter = 0; });

describe('evaluateSession (rules 3–4)', () => {
  it('picks the heaviest weight used by at least half the sets and judges only those', () => {
    const p = evaluateSession(session('a', 1, [set(100, 12), set(100, 12), set(80, 15)]), 'leg_press', { min: 8, max: 12 })!;
    expect(p.workingWeightKg).toBe(100);
    expect(p.sets).toHaveLength(2);
    expect(p.verdict).toBe('hit');
    expect(evaluateSession(session('b', 1, [set(100, 12), set(90, 12), set(80, 12)]), 'leg_press', { min: 8, max: 12 })!.workingWeightKg).toBe(90);
    expect(evaluateSession(session('c', 1, [set(100, 10), set(100, 8)]), 'leg_press', { min: 8, max: 12 })!.verdict).toBe('met');
    expect(evaluateSession(session('d', 1, [set(100, 10), set(100, 6)]), 'leg_press', { min: 8, max: 12 })!.verdict).toBe('missed');
    expect(evaluateSession(session('e', 1, [set(100, 12, { type: 'warmup' })]), 'leg_press', { min: 8, max: 12 })).toBeNull();
    expect(evaluateSession(session('f', 1, [set(100, 12, { rir: 0 })]), 'leg_press', { min: 8, max: 12 })!.atLimit).toBe(true);
  });
});

describe('recommend', () => {
  it('rule 2: no history → insufficient data, prescription reps, no weight', () => {
    expect(recommend(input([]))).toMatchObject({ action: 'insufficient_data', weightKg: null, reps: { min: 8, max: 12 }, basedOnSessions: 0, explanationKey: 'coach.rec.noHistory' });
    expect(recommend(input([session('a', 1, [set(100, 10, { completed: false })])])).action).toBe('insufficient_data');
  });

  it('rule 5: two hits → increase by the step; per-hand uses the per-hand step', () => {
    const history = [session('b', 2, [set(100, 12), set(100, 12), set(100, 12)]), session('a', 6, [set(100, 12), set(100, 12), set(100, 12)])];
    expect(recommend(input(history))).toMatchObject({ action: 'increase', weightKg: 102.5, reps: { min: 8, max: 12 }, basedOnSessions: 2, explanationKey: 'coach.rec.increase', params: { weight: 100, next: 102.5 } });
    expect(recommend(input(history, { weightType: 'per_hand' })).weightKg).toBe(101);
  });

  it('rule 5a/5b: at the limit or a single good session → hold', () => {
    const limit = [session('b', 2, [set(100, 12, { rpe: 10 }), set(100, 12)]), session('a', 6, [set(100, 12), set(100, 12)])];
    expect(recommend(input(limit))).toMatchObject({ action: 'hold', weightKg: 100, explanationKey: 'coach.rec.atLimit' });
    expect(recommend(input([session('a', 2, [set(100, 12), set(100, 12)])]))).toMatchObject({ action: 'hold', weightKg: 100, basedOnSessions: 1, explanationKey: 'coach.rec.oneSession' });
  });

  it('rule 6: met but not hit → same weight, one more rep than the weakest set', () => {
    const history = [session('a', 2, [set(100, 10), set(100, 9), set(100, 8)])];
    expect(recommend(input(history))).toMatchObject({ action: 'add_reps', weightKg: 100, reps: { min: 9, max: 12 }, params: { lowest: 8, target: 9 } });
    const nearMax = [session('a', 2, [set(100, 12), set(100, 11)])];
    expect(recommend(input(nearMax)).reps).toEqual({ min: 12, max: 12 });
  });

  it('rules 7–8: one miss holds, two misses at the same weight drop 10 % (floored to the step)', () => {
    const once = [session('b', 2, [set(100, 6), set(100, 5)]), session('a', 6, [set(100, 10), set(100, 9)])];
    expect(recommend(input(once))).toMatchObject({ action: 'hold', weightKg: 100, explanationKey: 'coach.rec.missedOnce' });
    const twice = [session('b', 2, [set(100, 6), set(100, 5)]), session('a', 6, [set(100, 7), set(100, 6)])];
    expect(recommend(input(twice))).toMatchObject({ action: 'decrease', weightKg: 90, explanationKey: 'coach.rec.decrease' });
    expect(recommend(input([session('b', 2, [set(42.5, 5)]), session('a', 6, [set(42.5, 5)])])).weightKg).toBe(37.5); // 38.25 floored to 2.5
    // Two misses at different weights are not the same trend.
    const different = [session('b', 2, [set(105, 6)]), session('a', 6, [set(100, 6)])];
    expect(recommend(input(different)).action).toBe('hold');
  });

  it('rule 9: breaks hold at the last weight (≥ 21 days) or suggest 90 % (≥ 42 days)', () => {
    expect(recommend(input([session('a', 25, [set(100, 12), set(100, 12)]), session('z', 30, [set(100, 12)])]))).toMatchObject({ action: 'hold', weightKg: 100, explanationKey: 'coach.rec.break', params: { days: 25 } });
    expect(recommend(input([session('a', 50, [set(100, 12)])]))).toMatchObject({ action: 'decrease', weightKg: 90, explanationKey: 'coach.rec.longBreak' });
  });

  it('rule 10: bodyweight and assisted never get a load suggestion', () => {
    const bw = [session('b', 2, [set(0, 12), set(0, 12)]), session('a', 6, [set(0, 12), set(0, 12)])];
    expect(recommend(input(bw, { weightType: 'bodyweight' }))).toMatchObject({ action: 'hold', weightKg: null, explanationKey: 'coach.rec.hitNoLoad' });
    const assisted = [session('b', 2, [set(20, 10), set(20, 9)])];
    expect(recommend(input(assisted, { weightType: 'assisted' }))).toMatchObject({ action: 'add_reps', weightKg: null, reps: { min: 10, max: 12 } });
  });

  it('ignores the running session and in-progress sessions, and is deterministic', () => {
    const history = [
      { ...session('active', 0, [set(200, 12), set(200, 12)]), status: 'in_progress' as const },
      session('b', 2, [set(100, 12), set(100, 12)]),
      session('a', 6, [set(100, 12), set(100, 12)]),
    ];
    const first = recommend(input(history, { excludeSessionId: 'active' }));
    expect(first).toMatchObject({ action: 'increase', weightKg: 102.5 });
    expect(recommend(input(history, { excludeSessionId: 'active' }))).toEqual(first);
  });
});
