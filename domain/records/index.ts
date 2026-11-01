import type { ExerciseSet, PersonalRecord, PersonalRecordKind, SessionExercise, WeightType, WorkoutSession } from '@/types/workout';

/**
 * Personal records (Phase 3, spec §13), derived from history on every read
 * (ADR-010). History is newest-first everywhere in the app; this module
 * walks it oldest-first so "previous" means "best before that set".
 *
 * Rules
 * 1. Only completed working sets with reps count. Warm-up sets never set records.
 * 2. `top_weight`, `estimated_1rm` and `set_volume` need `weightKg > 0`.
 *    Bodyweight-only sets (0 kg) and `assisted` exercises only get `reps_at_weight`
 *    (assistance weight is not comparable to load; lower is harder).
 * 3. e1RM is Epley (w × (1 + reps/30)) and is not computed above 12 reps:
 *    the formula overstates badly for high-rep sets, so those sets simply do not
 *    compete for the e1RM record. The UI labels it an estimate.
 * 4. Records are keyed by exercise id. An id is a variant (per-hand dumbbell vs
 *    barbell are different ids), so variants are never compared.
 * 5. A record needs something to beat: the first ever set of an exercise is a
 *    baseline, not a PR event.
 */

export const E1RM_MAX_REPS = 12;

export const RECORD_KINDS: readonly PersonalRecordKind[] = ['top_weight', 'estimated_1rm', 'reps_at_weight', 'set_volume'];

export interface CountedSet {
  set: ExerciseSet & { weightKg: number; reps: number };
  sessionId: string;
  date: string;
}

/** Epley estimate; null when it would be meaningless (no load, no reps, or too many reps). */
export function estimateOneRepMaxOrNull(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > E1RM_MAX_REPS) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export const isCountedForRecords = (set: ExerciseSet): set is ExerciseSet & { weightKg: number; reps: number } =>
  set.completed && set.type === 'working' && set.weightKg !== null && set.reps !== null && set.reps > 0;

export interface RecordEntry {
  value: number;
  setId: string;
  sessionId: string;
  date: string;
  /** For reps_at_weight. */
  weightKg?: number;
}

export interface RecordEvent extends RecordEntry {
  kind: PersonalRecordKind;
  previous: number | null;
}

export interface ExerciseRecords {
  topWeight: RecordEntry | null;
  bestEstimated1rm: RecordEntry | null;
  bestSetVolume: RecordEntry | null;
  /** Most reps at each weight, heaviest first. */
  repsAtWeight: RecordEntry[];
  /** Every time a record was beaten, oldest first. */
  events: RecordEvent[];
}

const EMPTY: ExerciseRecords = { topWeight: null, bestEstimated1rm: null, bestSetVolume: null, repsAtWeight: [], events: [] };

const allowsLoadRecords = (weightType: WeightType, weightKg: number): boolean => weightType !== 'assisted' && weightKg > 0;

/** Completed sets of an exercise across history, oldest session first, set order preserved. */
export function countedSetsOf(history: readonly WorkoutSession[], exerciseId: string, excludeSessionId?: string): CountedSet[] {
  const out: CountedSet[] = [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const session = history[i];
    if (session.status !== 'completed' || session.id === excludeSessionId) continue;
    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        if (isCountedForRecords(set)) out.push({ set, sessionId: session.id, date: set.completedAt ?? session.startedAt });
      }
    }
  }
  return out;
}

/** Folds one set into the running records, returning the events it produced. */
function foldSet(records: ExerciseRecords, item: CountedSet, weightType: WeightType, emit: boolean): RecordEvent[] {
  const { set, sessionId, date } = item;
  const events: RecordEvent[] = [];
  const entry = (value: number, extra: Partial<RecordEntry> = {}): RecordEntry => ({ value, setId: set.id, sessionId, date, ...extra });
  const push = (kind: PersonalRecordKind, value: number, previous: number | null, extra: Partial<RecordEntry> = {}) => {
    if (emit) events.push({ kind, value, previous, setId: set.id, sessionId, date, ...extra });
  };

  if (allowsLoadRecords(weightType, set.weightKg)) {
    if (!records.topWeight || set.weightKg > records.topWeight.value) {
      push('top_weight', set.weightKg, records.topWeight?.value ?? null);
      records.topWeight = entry(set.weightKg);
    }
    const e1rm = estimateOneRepMaxOrNull(set.weightKg, set.reps);
    if (e1rm !== null && (!records.bestEstimated1rm || e1rm > records.bestEstimated1rm.value)) {
      push('estimated_1rm', e1rm, records.bestEstimated1rm?.value ?? null);
      records.bestEstimated1rm = entry(e1rm);
    }
    const volume = set.weightKg * set.reps;
    if (!records.bestSetVolume || volume > records.bestSetVolume.value) {
      push('set_volume', volume, records.bestSetVolume?.value ?? null);
      records.bestSetVolume = entry(volume);
    }
  }

  const existing = records.repsAtWeight.find((item) => item.weightKg === set.weightKg);
  if (!existing) {
    records.repsAtWeight.push(entry(set.reps, { weightKg: set.weightKg }));
    records.repsAtWeight.sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0));
  } else if (set.reps > existing.value) {
    push('reps_at_weight', set.reps, existing.value, { weightKg: set.weightKg });
    existing.value = set.reps;
    existing.setId = set.id;
    existing.sessionId = sessionId;
    existing.date = date;
  }
  return events;
}

/** Every record of an exercise plus the event trail, from completed history only. */
export function computeExerciseRecords(
  history: readonly WorkoutSession[],
  exerciseId: string,
  weightType: WeightType,
  excludeSessionId?: string,
): ExerciseRecords {
  const sets = countedSetsOf(history, exerciseId, excludeSessionId);
  if (sets.length === 0) return EMPTY;
  const records: ExerciseRecords = { topWeight: null, bestEstimated1rm: null, bestSetVolume: null, repsAtWeight: [], events: [] };
  let seenBaseline = false;
  for (const item of sets) {
    // Rule 5: the very first set is the baseline; events start with the second set.
    const events = foldSet(records, item, weightType, seenBaseline);
    records.events.push(...events);
    seenBaseline = true;
  }
  return records;
}

/**
 * Records a just-completed set would set against history (the active session
 * excluded). Pure; the caller decides whether to celebrate. Nothing is stored.
 */
export function detectSetRecords(
  history: readonly WorkoutSession[],
  exerciseId: string,
  weightType: WeightType,
  set: ExerciseSet,
  sessionId: string,
): PersonalRecord[] {
  if (!isCountedForRecords(set)) return [];
  const prior = computeExerciseRecords(history, exerciseId, weightType, sessionId);
  if (!prior.topWeight && prior.repsAtWeight.length === 0) return [];
  const snapshot: ExerciseRecords = {
    topWeight: prior.topWeight,
    bestEstimated1rm: prior.bestEstimated1rm,
    bestSetVolume: prior.bestSetVolume,
    repsAtWeight: prior.repsAtWeight.map((item) => ({ ...item })),
    events: [],
  };
  const events = foldSet(snapshot, { set, sessionId, date: set.completedAt ?? '' }, weightType, true);
  return events.map((event) => ({ exerciseId, kind: event.kind, value: event.value, previous: event.previous, setId: event.setId, ...(event.weightKg !== undefined ? { weightKg: event.weightKg } : {}) }));
}

/**
 * One record per exercise per kind for a finishing session, against history
 * that does not contain it. Replaces the Phase 1 `detectPersonalRecords`.
 */
export function detectSessionRecords(
  session: WorkoutSession,
  history: readonly WorkoutSession[],
  weightTypeOf: (exerciseId: string) => WeightType,
): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const seen = new Set<string>();
  for (const exercise of session.exercises) {
    if (seen.has(exercise.exerciseId)) continue;
    seen.add(exercise.exerciseId);
    const weightType = weightTypeOf(exercise.exerciseId);
    const prior = computeExerciseRecords(history, exercise.exerciseId, weightType, session.id);
    if (!prior.topWeight && prior.repsAtWeight.length === 0) continue; // nothing to beat
    const working: ExerciseRecords = {
      topWeight: prior.topWeight,
      bestEstimated1rm: prior.bestEstimated1rm,
      bestSetVolume: prior.bestSetVolume,
      repsAtWeight: prior.repsAtWeight.map((item) => ({ ...item })),
      events: [],
    };
    const best = new Map<string, PersonalRecord>();
    const sets = session.exercises.filter((item) => item.exerciseId === exercise.exerciseId).flatMap((item) => item.sets);
    for (const set of sets) {
      if (!isCountedForRecords(set)) continue;
      for (const event of foldSet(working, { set, sessionId: session.id, date: set.completedAt ?? session.startedAt }, weightType, true)) {
        const key = event.kind === 'reps_at_weight' ? `${event.kind}:${event.weightKg}` : event.kind;
        const previous = best.get(key)?.previous ?? event.previous;
        best.set(key, { exerciseId: exercise.exerciseId, kind: event.kind, value: event.value, previous, setId: event.setId, ...(event.weightKg !== undefined ? { weightKg: event.weightKg } : {}) });
      }
    }
    records.push(...best.values());
  }
  return records;
}

/** Sets of one exercise in a session, for "best this session" style displays. */
export const countedSetsInExercise = (exercise: SessionExercise): (ExerciseSet & { weightKg: number; reps: number })[] =>
  exercise.sets.filter(isCountedForRecords);
