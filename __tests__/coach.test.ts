import { DISMISS_DAYS, buildInsights } from '@/domain/coach';
import { BUILTIN_EXERCISES } from '@/data/exercisesData';
import type { ExerciseSet, WorkoutSession } from '@/types/workout';

/** Phase 3 W3 — coach insight rules. */

const NOW = '2026-11-02T10:00:00.000Z';
let counter = 0;
const set = (weightKg: number, reps: number): ExerciseSet => ({ id: `s${++counter}`, setNumber: 1, type: 'working', kind: 'normal', targetReps: { min: 8, max: 12 }, weightKg, reps, rpe: null, rir: null, completed: true, completedAt: null });
const session = (daysAgo: number, exerciseId: string, sets: ExerciseSet[], volume = 1000): WorkoutSession => {
  const at = new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
  const id = `s${++counter}`;
  return {
    id, schemaVersion: 2, kind: 'plan', planId: 'p', planDayId: 'd', title: { en: 'x', ar: 'x' }, code: 'X', focus: null, status: 'completed', startedAt: at, finishedAt: at, endedAtOverride: null, pausedIntervals: [],
    exercises: [{ id: `${id}e`, exerciseId, prescription: { exerciseId, sets: sets.length, reps: { min: 8, max: 12 }, rest: { defaultSeconds: 90, minSeconds: 90, maxSeconds: 90 } }, sets, skipped: false, notes: '', groupId: null, groupKind: null, recommendation: null }],
    deferredIds: [], currentExerciseIndex: 0, warmupCompletedIds: [], notes: '',
    summary: { totalVolumeKg: volume, completedSets: sets.length, totalSets: sets.length, durationSeconds: 0, activeSeconds: 0, personalRecords: [] },
  };
};
const base = { exercises: BUILTIN_EXERCISES, activePlan: null, now: NOW, dismissed: {} };

describe('coach insights', () => {
  it('B: fewer than 3 sessions → insufficient data only', () => {
    const history = [session(2, 'leg_press', [set(100, 10)]), session(5, 'leg_press', [set(100, 10)])];
    expect(buildInsights({ ...base, history })).toEqual([{ key: 'insufficient_data', kind: 'insufficient_data', exerciseId: null, params: { sessions: 2, needed: 3 } }]);
    expect(buildInsights({ ...base, history: [] })).toHaveLength(1);
  });

  it('A: returning after a break comes first', () => {
    const history = [session(20, 'leg_press', [set(100, 10)]), session(25, 'leg_press', [set(100, 10)]), session(30, 'leg_press', [set(100, 10)])];
    const insights = buildInsights({ ...base, history });
    expect(insights[0]).toMatchObject({ kind: 'returning', params: { days: 20 } });
  });

  it('D: three missed sessions in a row flag the exercise', () => {
    const history = [session(2, 'leg_press', [set(100, 5)]), session(5, 'leg_press', [set(100, 6)]), session(8, 'leg_press', [set(100, 4)])];
    expect(buildInsights({ ...base, history })[0]).toMatchObject({ kind: 'missing_targets', exerciseId: 'leg_press', key: 'missing_targets:leg_press' });
  });

  it('E: same weight, no improvement, 4+ sessions in 60 days → plateau', () => {
    const history = [2, 9, 16, 23].map((d) => session(d, 'leg_press', [set(100, 10), set(100, 10)]));
    expect(buildInsights({ ...base, history })[0]).toMatchObject({ kind: 'plateau', exerciseId: 'leg_press', params: { sessions: 4, weight: 100 } });
    const improving = [session(2, 'leg_press', [set(100, 12)]), session(9, 'leg_press', [set(100, 11)]), session(16, 'leg_press', [set(100, 10)]), session(23, 'leg_press', [set(100, 10)])];
    expect(buildInsights({ ...base, history: improving }).some((i) => i.kind === 'plateau')).toBe(false);
  });

  it('C: recent best e1RM ≥ 5 % above the previous four sessions → progressing', () => {
    const history = [
      ...[2, 5, 8, 11].map((d) => session(d, 'leg_press', [set(110, 10)])),
      ...[14, 17, 20, 23].map((d) => session(d, 'leg_press', [set(100, 10)])),
    ];
    const insights = buildInsights({ ...base, history });
    expect(insights.find((i) => i.kind === 'progressing')).toMatchObject({ exerciseId: 'leg_press', params: { percent: 10 } });
  });

  it('F: three steady weeks → consistent load; dismissals hide for 14 days; max 3 insights', () => {
    const history = [session(1, 'leg_press', [set(100, 10)], 1000), session(8, 'leg_press', [set(100, 10)], 1100), session(15, 'leg_press', [set(100, 10)], 950)];
    const insights = buildInsights({ ...base, history });
    expect(insights.some((i) => i.kind === 'consistent_load')).toBe(true);
    const dismissed = { consistent_load: new Date(Date.parse(NOW) - (DISMISS_DAYS - 1) * 86_400_000).toISOString() };
    expect(buildInsights({ ...base, history, dismissed }).some((i) => i.kind === 'consistent_load')).toBe(false);
    const expired = { consistent_load: new Date(Date.parse(NOW) - (DISMISS_DAYS + 1) * 86_400_000).toISOString() };
    expect(buildInsights({ ...base, history, dismissed: expired }).some((i) => i.kind === 'consistent_load')).toBe(true);
    const many = [
      ...[2, 5, 8].map((d) => session(d, 'leg_press', [set(100, 4)])),
      ...[2, 5, 8].map((d) => session(d, 'hack_squat', [set(100, 4)])),
      ...[2, 5, 8].map((d) => session(d, 'leg_extension', [set(100, 4)])),
      ...[2, 5, 8].map((d) => session(d, 'lying_leg_curl', [set(100, 4)])),
    ];
    expect(buildInsights({ ...base, history: many })).toHaveLength(3);
  });
});

