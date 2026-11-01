import { E1RM_MAX_REPS, computeExerciseRecords, detectSessionRecords, detectSetRecords, estimateOneRepMaxOrNull } from '@/domain/records';
import type { ExerciseSet, WorkoutSession } from '@/types/workout';

/** Phase 3 W1 — PR engine. */

let counter = 0;
const set = (weightKg: number | null, reps: number | null, overrides: Partial<ExerciseSet> = {}): ExerciseSet => ({
  id: `set-${++counter}`,
  setNumber: 1,
  type: 'working',
  kind: 'normal',
  targetReps: { min: 8, max: 12 },
  weightKg,
  reps,
  rpe: null,
  rir: null,
  completed: true,
  completedAt: `2026-10-${String(10 + counter).padStart(2, '0')}T10:00:00.000Z`,
  ...overrides,
});

const session = (id: string, startedAt: string, exerciseId: string, sets: ExerciseSet[], status: WorkoutSession['status'] = 'completed'): WorkoutSession => ({
  id,
  schemaVersion: 2,
  kind: 'plan',
  planId: 'p',
  planDayId: 'd',
  title: { en: 'x', ar: 'x' },
  code: 'X',
  focus: null,
  status,
  startedAt,
  finishedAt: startedAt,
  endedAtOverride: null,
  pausedIntervals: [],
  exercises: [{ id: `${id}-e`, exerciseId, prescription: { exerciseId, sets: sets.length, reps: { min: 8, max: 12 }, rest: { defaultSeconds: 90, minSeconds: 90, maxSeconds: 90 } }, sets, skipped: false, notes: '', groupId: null, groupKind: null, recommendation: null }],
  deferredIds: [],
  currentExerciseIndex: 0,
  warmupCompletedIds: [],
  notes: '',
  summary: null,
});

beforeEach(() => {
  counter = 0;
});

describe('e1RM', () => {
  it('uses Epley up to 12 reps and refuses beyond', () => {
    expect(estimateOneRepMaxOrNull(100, 1)).toBe(100);
    expect(estimateOneRepMaxOrNull(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimateOneRepMaxOrNull(100, E1RM_MAX_REPS)).toBeCloseTo(140, 5);
    expect(estimateOneRepMaxOrNull(100, 13)).toBeNull();
    expect(estimateOneRepMaxOrNull(100, 25)).toBeNull();
    expect(estimateOneRepMaxOrNull(0, 10)).toBeNull();
    expect(estimateOneRepMaxOrNull(100, 0)).toBeNull();
  });
});

describe('computeExerciseRecords', () => {
  it('tracks top weight, e1RM, set volume and reps at weight with an event trail, oldest first', () => {
    // history newest-first
    const history = [
      session('s3', '2026-10-20T10:00:00.000Z', 'leg_press', [set(110, 8), set(100, 14)]),
      session('s2', '2026-10-15T10:00:00.000Z', 'leg_press', [set(100, 12), set(100, 12)]),
      session('s1', '2026-10-10T10:00:00.000Z', 'leg_press', [set(100, 10), set(90, 12)]),
    ];
    const r = computeExerciseRecords(history, 'leg_press', 'total');
    expect(r.topWeight).toMatchObject({ value: 110, sessionId: 's3' });
    expect(r.bestEstimated1rm).toMatchObject({ value: 140, sessionId: 's2' }); // 100 × 12; 110 × 8 = 139.3 and 100 × 14 is above the cap
    expect(r.bestSetVolume).toMatchObject({ value: 1400, sessionId: 's3' }); // 100 × 14 counts for volume even though e1RM ignores it
    expect(r.repsAtWeight.map((item) => [item.weightKg, item.value])).toEqual([[110, 8], [100, 14], [90, 12]]);
    // First set (100 × 10) is the baseline: no event. 90 × 12 adds a new weight silently.
    expect(r.events.map((e) => [e.kind, e.value, e.previous])).toEqual([
      ['set_volume', 1080, 1000], // 90 × 12 beats 100 × 10 on volume
      ['estimated_1rm', 140, 100 * (1 + 10 / 30)],
      ['set_volume', 1200, 1080],
      ['reps_at_weight', 12, 10],
      ['top_weight', 110, 100],
      ['set_volume', 1400, 1200],
      ['reps_at_weight', 14, 12],
    ]);
  });

  it('ignores warm-ups, incomplete sets, in-progress sessions and the excluded session', () => {
    const history = [
      session('s2', '2026-10-15T10:00:00.000Z', 'leg_press', [set(200, 5)], 'in_progress'),
      session('s1', '2026-10-10T10:00:00.000Z', 'leg_press', [set(150, 5, { type: 'warmup' }), set(120, 3, { completed: false }), set(100, 10)]),
    ];
    expect(computeExerciseRecords(history, 'leg_press', 'total').topWeight?.value).toBe(100);
    expect(computeExerciseRecords(history, 'leg_press', 'total', 's1').topWeight).toBeNull();
    expect(computeExerciseRecords(history, 'other', 'total').events).toEqual([]);
  });

  it('bodyweight gets rep records only; assisted never gets load records', () => {
    const bw = [session('s2', '2026-10-15T10:00:00.000Z', 'pull_up', [set(0, 12)]), session('s1', '2026-10-10T10:00:00.000Z', 'pull_up', [set(0, 8)])];
    const r = computeExerciseRecords(bw, 'pull_up', 'bodyweight');
    expect(r.topWeight).toBeNull();
    expect(r.bestEstimated1rm).toBeNull();
    expect(r.repsAtWeight).toEqual([expect.objectContaining({ weightKg: 0, value: 12 })]);
    expect(r.events).toEqual([expect.objectContaining({ kind: 'reps_at_weight', value: 12, previous: 8 })]);

    const assisted = [session('s2', '2026-10-15T10:00:00.000Z', 'assisted_dip', [set(20, 10)]), session('s1', '2026-10-10T10:00:00.000Z', 'assisted_dip', [set(30, 10)])];
    const a = computeExerciseRecords(assisted, 'assisted_dip', 'assisted');
    expect(a.topWeight).toBeNull();
    expect(a.bestSetVolume).toBeNull();
    expect(a.repsAtWeight.map((i) => i.weightKg)).toEqual([30, 20]);
  });

  it('never compares different exercise ids (variants)', () => {
    const history = [session('s1', '2026-10-10T10:00:00.000Z', 'flat_dumbbell_bench_press', [set(40, 10)])];
    expect(computeExerciseRecords(history, 'flat_barbell_bench_press', 'total').topWeight).toBeNull();
  });
});

describe('detectSetRecords / detectSessionRecords', () => {
  const history = [session('s1', '2026-10-10T10:00:00.000Z', 'leg_press', [set(100, 10), set(100, 12)])];

  it('reports what a single new set beats, excluding the active session, and nothing on first exposure', () => {
    const hit = detectSetRecords(history, 'leg_press', 'total', set(110, 12), 'active');
    expect(hit.map((r) => r.kind)).toEqual(['top_weight', 'estimated_1rm', 'set_volume']);
    expect(hit[0]).toMatchObject({ value: 110, previous: 100 });
    // Equalling a record is not beating it.
    expect(detectSetRecords(history, 'leg_press', 'total', set(100, 12), 'active')).toEqual([]);
    const reps = detectSetRecords(history, 'leg_press', 'total', set(100, 13), 'active');
    expect(reps.map((r) => r.kind)).toEqual(['set_volume', 'reps_at_weight']);
    expect(detectSetRecords(history, 'leg_press', 'total', set(90, 8), 'active')).toEqual([]);
    expect(detectSetRecords([], 'leg_press', 'total', set(200, 1), 'active')).toEqual([]);
    expect(detectSetRecords(history, 'leg_press', 'total', set(200, 1, { type: 'warmup' }), 'active')).toEqual([]);
    // The active session already in history (resume) must not count against itself.
    const resumed = [session('active', '2026-10-20T10:00:00.000Z', 'leg_press', [set(120, 5)], 'in_progress'), ...history];
    expect(detectSetRecords(resumed, 'leg_press', 'total', set(110, 5), 'active')[0]).toMatchObject({ kind: 'top_weight', value: 110, previous: 100 });
  });

  it('summarises one record per kind per exercise for a finishing session, keeping the pre-session previous', () => {
    const finishing = session('s2', '2026-10-20T10:00:00.000Z', 'leg_press', [set(105, 10), set(110, 8), set(100, 15)]);
    const records = detectSessionRecords(finishing, history, () => 'total');
    const byKind = Object.fromEntries(records.map((r) => [r.kind === 'reps_at_weight' ? `${r.kind}:${r.weightKg}` : r.kind, r]));
    expect(byKind.top_weight).toMatchObject({ value: 110, previous: 100 });
    expect(byKind.estimated_1rm).toBeUndefined(); // 105 × 10 = 140 ties, 110 × 8 = 139.3, 100 × 15 is above the cap
    expect(byKind.set_volume).toMatchObject({ value: 1500, previous: 1200 });
    expect(byKind['reps_at_weight:100']).toMatchObject({ value: 15, previous: 12 });
    expect(detectSessionRecords(finishing, [], () => 'total')).toEqual([]);
  });
});
