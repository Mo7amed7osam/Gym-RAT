import { createNodeDriver } from '@/data/db/driver.node';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { BUILTIN_EXERCISES, builtinContent, getBuiltinExercise } from '@/data/exercisesData';
import { EXERCISE_CONTENT } from '@/data/exerciseContent';
import { MEDIA_MANIFEST, getExerciseMedia, hasBundledMedia } from '@/data/media';
import { PDF_PROGRAM_DAYS } from '@/data/seeds/pdfProgram';
import { STARTER_DAYS } from '@/data/seeds/starterPlan';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, selectExercise, selectLibrary, useWorkoutStore } from '@/store/useWorkoutStore';
import type { Exercise } from '@/types/workout';

/** Phase 2 P2.1 — runtime exercise library (ADR-007). */

const defaults = { restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS };
const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

const customInput = () => ({
  name: { en: 'Cable Lateral Raise', ar: 'رفرفة جانبية بالكابل' },
  primaryMuscles: ['side_delts' as const],
  secondaryMuscles: [],
  equipment: ['cable' as const],
  weightType: 'total' as const,
  isUnilateral: true,
  instructions: [{ en: 'Low pulley, lean away.', ar: 'بكرة منخفضة، مل بعيدًا.' }],
  breathing: null,
  rangeOfMotion: null,
  commonMistakes: [],
  alternatives: ['dumbbell_lateral_raise'],
  videoId: null,
});

beforeEach(() => {
  attachPersistence(null);
  useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
});

describe('built-in seed', () => {
  it('has authored content and resolvable alternatives for every exercise', () => {
    expect(BUILTIN_EXERCISES).toHaveLength(38);
    for (const exercise of BUILTIN_EXERCISES) {
      expect(EXERCISE_CONTENT[exercise.id]).toBeDefined();
      expect(exercise.instructions.length).toBeGreaterThanOrEqual(2);
      for (const step of exercise.instructions) {
        expect(step.en.trim()).not.toBe('');
        expect(step.ar.trim()).not.toBe('');
      }
      for (const alt of exercise.alternatives) expect(getBuiltinExercise(alt)).toBeDefined();
      expect(exercise.alternatives).not.toContain(exercise.id);
    }
  });

  it('every bundled plan prescription points at a built-in exercise', () => {
    for (const day of [...PDF_PROGRAM_DAYS, ...STARTER_DAYS]) {
      for (const item of day.exercises) expect(getBuiltinExercise(item.exerciseId)).toBeDefined();
    }
  });
});

describe('media manifest', () => {
  it('covers every built-in exercise with either bundled stills or an explicit none entry', () => {
    const missing = BUILTIN_EXERCISES.filter((exercise) => !MEDIA_MANIFEST.entries[exercise.id]);
    expect(missing.map((e) => e.id)).toEqual([]);
    const matched = BUILTIN_EXERCISES.filter((exercise) => hasBundledMedia(exercise.id));
    expect(matched).toHaveLength(28);
    for (const exercise of matched) {
      const media = getExerciseMedia(exercise);
      expect(media.kind).toBe('still_pair');
      expect(media.start).toBeTruthy();
      expect(media.end).toBeTruthy();
      expect(media.attribution).toBe('Exercise data by RepDB (repdb.co)');
      const entry = MEDIA_MANIFEST.entries[exercise.id];
      expect(entry.files?.start?.width).toBe(512);
      expect(entry.files?.start?.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    for (const exercise of BUILTIN_EXERCISES.filter((e) => !hasBundledMedia(e.id))) {
      expect(MEDIA_MANIFEST.entries[exercise.id].reason).toBeTruthy();
      expect(getExerciseMedia(exercise).kind).toBe('none');
    }
  });

  it('prefers the custom photo and falls back for unknown ids', () => {
    expect(getExerciseMedia({ id: 'leg_press', imageUri: 'file:///x.jpg' })).toMatchObject({ kind: 'user_photo' });
    expect(getExerciseMedia({ id: 'nope', imageUri: null }).kind).toBe('none');
    expect(getExerciseMedia(null).kind).toBe('none');
  });
});

describe('schema v4 + repository', () => {
  it('migrates a v3 database and round-trips built-in and custom rows', () => {
    const driver = createNodeDriver();
    driver.transaction(() => {
      MIGRATIONS[0].up(driver);
      MIGRATIONS[1].up(driver);
      MIGRATIONS[2].up(driver);
      driver.exec('PRAGMA user_version = 3');
    });
    expect(migrate(driver)).toEqual({ from: 3, to: SCHEMA_VERSION, applied: [4, 5] });
    const repo = new WorkoutRepository(driver);
    expect(repo.loadAll(defaults).exercises).toEqual([]);

    const seeded = seedExercises(empty());
    repo.persistDiff(empty(), seeded);
    expect(repo.counts().library).toBe(38);
    const loaded = repo.loadAll(defaults);
    expect(loaded.exercises).toEqual(seeded.exercises);

    const custom: Exercise = {
      ...customInput(),
      id: 'custom-1',
      origin: 'custom',
      arabicNameSource: 'user',
      imageUri: 'file:///photo.jpg',
      userNotes: 'seat 4',
      userRestSeconds: 75,
      archived: true,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };
    const withCustom = { ...seeded, exercises: [...seeded.exercises, custom] };
    repo.persistDiff(seeded, withCustom);
    expect(repo.loadAll(defaults).exercises.find((e) => e.id === 'custom-1')).toEqual(custom);
  });
});

describe('seedExercises', () => {
  it('is a no-op when content is current and refreshes authored columns without touching user fields', () => {
    const current = seedExercises(empty());
    expect(seedExercises(current)).toBe(current);

    const stale = {
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === 'leg_press'
          ? { ...exercise, instructions: [{ en: 'old', ar: 'قديم' }], userNotes: 'my seat', userRestSeconds: 100, archived: false }
          : exercise,
      ),
    };
    const refreshed = seedExercises(stale, '2026-12-01T00:00:00.000Z');
    const legPress = refreshed.exercises.find((e) => e.id === 'leg_press')!;
    expect(builtinContent(legPress)).toEqual(builtinContent(getBuiltinExercise('leg_press')!));
    expect(legPress.userNotes).toBe('my seat');
    expect(legPress.userRestSeconds).toBe(100);
    expect(legPress.updatedAt).toBe('2026-12-01T00:00:00.000Z');
  });

  it('leaves custom exercises alone', () => {
    const state = useWorkoutStore.getState();
    const custom = state.createCustomExercise(customInput());
    const persisted = { ...empty(), exercises: useWorkoutStore.getState().exercises };
    expect(seedExercises(persisted)).toBe(persisted);
    expect(persisted.exercises.find((e) => e.id === custom.id)).toBe(custom);
  });
});

describe('store: custom exercises', () => {
  it('creates, edits, and archives a custom exercise while history keeps resolving it', () => {
    const store = useWorkoutStore.getState();
    const created = store.createCustomExercise(customInput());
    expect(created.origin).toBe('custom');
    expect(created.arabicNameSource).toBe('user');
    expect(selectLibrary(useWorkoutStore.getState()).some((e) => e.id === created.id)).toBe(true);

    store.updateCustomExercise(created.id, { name: { en: 'Cable Side Raise', ar: 'رفرفة' }, weightType: 'per_hand' });
    store.updateExerciseUser(created.id, { userNotes: 'pulley at knee height', userRestSeconds: 60 });
    const edited = selectExercise(created.id)(useWorkoutStore.getState())!;
    expect(edited.name.en).toBe('Cable Side Raise');
    expect(edited.weightType).toBe('per_hand');
    expect(edited.userNotes).toBe('pulley at knee height');
    expect(edited.userRestSeconds).toBe(60);

    // Log a session against it, then archive.
    const adopted = useWorkoutStore.getState();
    const result = adopted.startWorkout();
    expect(result.ok).toBe(true);
    const session = useWorkoutStore.getState().activeSession!;
    useWorkoutStore.setState({
      activeSession: {
        ...session,
        exercises: [
          ...session.exercises,
          {
            id: 'se-custom',
            exerciseId: created.id,
            prescription: { exerciseId: created.id, sets: 1, reps: { min: 10, max: 12 }, rest: { defaultSeconds: 60, minSeconds: 60, maxSeconds: 60 } },
            sets: [{ id: 'set-custom', setNumber: 1, type: 'working', targetReps: { min: 10, max: 12 }, weightKg: 10, reps: 12, completed: true, completedAt: '2026-11-01T18:00:00.000Z' }],
            skipped: false,
            notes: '',
          },
        ],
      },
    });
    useWorkoutStore.getState().finishWorkout('advance');
    useWorkoutStore.getState().setExerciseArchived(created.id, true);

    const after = useWorkoutStore.getState();
    expect(selectLibrary(after).some((e) => e.id === created.id)).toBe(false);
    expect(selectExercise(created.id)(after)?.archived).toBe(true);
    expect(after.history[0].exercises.find((e) => e.exerciseId === created.id)?.sets[0].weightKg).toBe(10);
    expect(after.exercises).toHaveLength(39);

    useWorkoutStore.getState().setExerciseArchived(created.id, false);
    expect(selectLibrary(useWorkoutStore.getState()).some((e) => e.id === created.id)).toBe(true);
  });

  it('refuses to edit or archive built-ins through the custom paths', () => {
    const store = useWorkoutStore.getState();
    const before = selectExercise('leg_press')(useWorkoutStore.getState())!;
    store.updateCustomExercise('leg_press', { name: { en: 'Hacked', ar: 'x' } });
    store.setExerciseArchived('leg_press', true);
    const after = selectExercise('leg_press')(useWorkoutStore.getState())!;
    expect(after).toBe(before);
    store.updateExerciseUser('leg_press', { userRestSeconds: 150 });
    expect(selectExercise('leg_press')(useWorkoutStore.getState())?.userRestSeconds).toBe(150);
  });
});
