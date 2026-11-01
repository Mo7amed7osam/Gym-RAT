import {
  buildSessionSummary,
  countSets,
  detectPersonalRecords,
  estimateOneRepMax,
  formatSet,
  getExerciseBests,
  getPreviousPerformance,
  getPreviousSetAt,
  isCountedSet,
  roundTo,
  sessionVolumeKg,
  weeklyVolumeKg,
} from '@/lib/workoutMath';
import type { ExerciseSet, SessionExercise, WorkoutSession } from '@/types/workout';

let counter = 0;
const id = () => `id-${++counter}`;

function set(partial: Partial<ExerciseSet>): ExerciseSet {
  return {
    id: id(),
    setNumber: 1,
    type: 'working',
    targetReps: { min: 10, max: 12 },
    weightKg: null,
    reps: null,
    completed: false,
    completedAt: null,
    ...partial,
  };
}

function logged(weightKg: number, reps: number, extra: Partial<ExerciseSet> = {}): ExerciseSet {
  return set({ weightKg, reps, completed: true, completedAt: '2026-10-31T18:00:00.000Z', ...extra });
}

function exercise(exerciseId: string, sets: ExerciseSet[]): SessionExercise {
  return {
    id: id(),
    exerciseId,
    prescription: {
      exerciseId,
      sets: sets.length,
      reps: { min: 10, max: 12 },
      rest: { defaultSeconds: 120, minSeconds: 120, maxSeconds: 120 },
    },
    sets: sets.map((item, i) => ({ ...item, setNumber: i + 1 })),
    skipped: false,
    notes: '',
  };
}

function session(startedAt: string, exercises: SessionExercise[], status: WorkoutSession['status'] = 'completed'): WorkoutSession {
  return {
    id: id(),
    schemaVersion: 2,
    kind: 'plan',
    planId: 'plan',
    planDayId: 'plan:push_a',
    title: { en: 'Push', ar: 'دفع' },
    code: 'Push A',
    focus: 'strength',
    status,
    startedAt,
    finishedAt: null,
    endedAtOverride: null,
    pausedIntervals: [],
    exercises,
    deferredIds: [],
    currentExerciseIndex: 0,
    warmupCompletedIds: [],
    notes: '',
    summary: null,
  };
}

describe('set accounting', () => {
  it('counts only completed working sets with numbers', () => {
    expect(isCountedSet(logged(60, 12))).toBe(true);
    expect(isCountedSet(logged(60, 12, { type: 'warmup' }))).toBe(false);
    expect(isCountedSet(set({ weightKg: 60, reps: 12 }))).toBe(false);
    expect(isCountedSet(logged(0, 25))).toBe(true); // bodyweight counts
  });

  it('sums volume and counts sets, skipping warm-ups and skipped exercises', () => {
    const skipped = { ...exercise('b', [logged(100, 5)]), skipped: true };
    const s = session('2026-10-31T18:00:00.000Z', [
      exercise('a', [logged(60, 12), logged(60, 10), logged(20, 15, { type: 'warmup' }), set({})]),
      skipped,
    ]);
    expect(sessionVolumeKg(s)).toBe(60 * 12 + 60 * 10 + 100 * 5);
    expect(countSets(s)).toEqual({ completed: 2, total: 3 });
  });

  it('formats sets', () => {
    expect(formatSet({ weightKg: 57.5, reps: 12 })).toBe('57.5 × 12');
    expect(formatSet({ weightKg: 0, reps: 25 })).toBe('BW × 25');
    expect(formatSet({ weightKg: 10, reps: null })).toBe('—');
  });
});

describe('strength estimates', () => {
  it('uses Epley with a guard for singles and empties', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 12)).toBeCloseTo(84);
    expect(estimateOneRepMax(0, 10)).toBe(0);
    expect(roundTo(83.7, 0.5)).toBe(83.5);
    expect(roundTo(31.3, 2.5)).toBe(32.5);
  });
});

describe('history lookups', () => {
  const older = session('2026-10-17T18:00:00.000Z', [exercise('bench', [logged(55, 12), logged(55, 11)])]);
  const newer = session('2026-10-24T18:00:00.000Z', [exercise('bench', [logged(60, 12), logged(60, 10), logged(60, 8)])]);
  const inProgress = session('2026-10-31T18:00:00.000Z', [exercise('bench', [logged(70, 10)])], 'in_progress');
  const history = [inProgress, newer, older]; // newest first

  it('returns the most recent completed session that logged the exercise', () => {
    const previous = getPreviousPerformance(history, 'bench');
    expect(previous?.session).toBe(newer);
    expect(getPreviousPerformance(history, 'nope')).toBeNull();
  });

  it('matches previous sets by number, falling back to the last one', () => {
    const previous = getPreviousPerformance(history, 'bench')!.exercise;
    expect(getPreviousSetAt(previous, 2)?.reps).toBe(10);
    expect(getPreviousSetAt(previous, 9)?.reps).toBe(8);
    expect(getPreviousSetAt(null, 1)).toBeNull();
  });

  it('computes bests across completed history only', () => {
    const bests = getExerciseBests(history, 'bench');
    expect(bests.topWeightKg).toBe(60);
    expect(bests.bestSet?.reps).toBe(12);
    expect(bests.bestOneRepMax).toBeCloseTo(84);
  });
});

describe('personal records', () => {
  const prior = session('2026-10-24T18:00:00.000Z', [exercise('bench', [logged(60, 12)])]);

  it('never awards a PR the first time an exercise is logged', () => {
    const first = session('2026-10-31T18:00:00.000Z', [exercise('bench', [logged(100, 10)])]);
    expect(detectPersonalRecords(first, [])).toEqual([]);
  });

  it('awards top-weight and estimated-1RM records that beat all prior history', () => {
    const today = session('2026-10-31T18:00:00.000Z', [exercise('bench', [logged(62.5, 12), logged(65, 6)])]);
    const records = detectPersonalRecords(today, [prior]);
    const kinds = records.map((r) => r.kind).sort();
    expect(kinds).toEqual(['estimated_1rm', 'top_weight']);
    const top = records.find((r) => r.kind === 'top_weight')!;
    expect(top.value).toBe(65);
    expect(top.previous).toBe(60);
    const e1rm = records.find((r) => r.kind === 'estimated_1rm')!;
    expect(e1rm.value).toBe(87.5); // 62.5 × (1 + 12/30) = 87.5
    expect(e1rm.previous).toBe(84);
  });

  it('ignores warm-up sets and equal performances', () => {
    const today = session('2026-10-31T18:00:00.000Z', [
      exercise('bench', [logged(80, 10, { type: 'warmup' }), logged(60, 12)]),
    ]);
    expect(detectPersonalRecords(today, [prior])).toEqual([]);
  });

  it('builds a summary with duration and records', () => {
    const today = session('2026-10-31T18:00:00.000Z', [exercise('bench', [logged(65, 10), set({})])]);
    const summary = buildSessionSummary(today, [prior], new Date('2026-10-31T19:02:30.000Z'));
    expect(summary.durationSeconds).toBe(62 * 60 + 30);
    expect(summary.activeSeconds).toBe(62 * 60 + 30);
    expect(summary.completedSets).toBe(1);
    expect(summary.totalSets).toBe(2);
    expect(summary.totalVolumeKg).toBe(650);
    expect(summary.personalRecords).toHaveLength(2);
  });
});

describe('weeklyVolumeKg', () => {
  it('buckets by Saturday-start weeks, oldest first', () => {
    const now = new Date(2026, 10, 4); // Wednesday; current week starts Sat 31 Oct
    const thisWeek = session(new Date(2026, 10, 1, 18).toISOString(), [exercise('a', [logged(100, 10)])]);
    const lastWeek = session(new Date(2026, 9, 27, 18).toISOString(), [exercise('a', [logged(50, 10)])]);
    const ancient = session(new Date(2026, 0, 1).toISOString(), [exercise('a', [logged(999, 10)])]);
    const result = weeklyVolumeKg([thisWeek, lastWeek, ancient], 3, now);
    expect(result).toEqual([0, 500, 1000]);
  });

  it('prefers the stored summary volume when present', () => {
    const now = new Date(2026, 10, 4);
    const s = { ...session(new Date(2026, 10, 1).toISOString(), [exercise('a', [logged(1, 1)])]), summary: { totalVolumeKg: 42, completedSets: 1, totalSets: 1, durationSeconds: 1, activeSeconds: 1, personalRecords: [] } };
    expect(weeklyVolumeKg([s], 1, now)).toEqual([42]);
  });
});
