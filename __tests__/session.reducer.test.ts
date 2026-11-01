import * as r from '@/domain/session/reducer';
import { seedPlans } from '@/data/db/seed';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER } from '@/store/useWorkoutStore';
import type { WorkoutSession } from '@/types/workout';

const T0 = Date.parse('2026-10-31T18:00:00.000Z');
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

function session(partial: Partial<WorkoutSession> = {}): WorkoutSession {
  const exercise = (id: string): WorkoutSession['exercises'][number] => ({
    id,
    exerciseId: id,
    prescription: { exerciseId: id, sets: 1, reps: { min: 10, max: 12 }, rest: { defaultSeconds: 90, minSeconds: 60, maxSeconds: 120 } },
    sets: [],
    skipped: false,
    notes: '',
  });
  return {
    id: 's',
    schemaVersion: 2,
    kind: 'plan',
    planId: 'p',
    planDayId: 'p:0',
    title: { en: 'A', ar: 'A' },
    code: 'A',
    focus: null,
    status: 'in_progress',
    startedAt: iso(0),
    finishedAt: null,
    endedAtOverride: null,
    pausedIntervals: [],
    exercises: [exercise('a'), exercise('b'), exercise('c')],
    deferredIds: [],
    currentExerciseIndex: 0,
    warmupCompletedIds: [],
    notes: '',
    summary: null,
    ...partial,
  };
}

describe('time accounting', () => {
  it('counts total and active seconds with open and closed pauses', () => {
    let s = session();
    expect(r.totalSeconds(s, T0 + 100_000)).toBe(100);
    s = r.pause(s, iso(30_000));
    expect(r.isPaused(s)).toBe(true);
    expect(r.activeSeconds(s, T0 + 100_000)).toBe(30);
    s = r.resume(s, iso(50_000));
    expect(r.activeSeconds(s, T0 + 100_000)).toBe(80);
    expect(r.pausedMs(s, T0 + 100_000)).toBe(20_000);
  });

  it('uses the end-time override and clips pauses to it', () => {
    let s = r.pause(session(), iso(60_000));
    s = r.finish(s, iso(120_000));
    expect(s.pausedIntervals[0].to).toBe(iso(120_000));
    expect(r.totalSeconds(s, T0 + 999_000)).toBe(120);
    expect(r.activeSeconds(s, T0 + 999_000)).toBe(60);
    s = r.setEndedAtOverride(s, iso(90_000));
    expect(r.totalSeconds(s, T0)).toBe(90);
    expect(r.activeSeconds(s, T0)).toBe(60);
  });

  it('pause and resume are idempotent', () => {
    const s = session();
    expect(r.resume(s, iso(1))).toBe(s);
    const paused = r.pause(s, iso(1));
    expect(r.pause(paused, iso(2))).toBe(paused);
  });
});

describe('exercise order', () => {
  it('defers to the end and reorders back, keeping the pointer sane', () => {
    let s = session({ currentExerciseIndex: 1 });
    s = r.deferExercise(s, 'b');
    expect(s.exercises.map((e) => e.id)).toEqual(['a', 'c', 'b']);
    expect(s.deferredIds).toEqual(['b']);
    expect(s.currentExerciseIndex).toBe(1);
    s = r.deferExercise(s, 'nope');
    expect(s.exercises.map((e) => e.id)).toEqual(['a', 'c', 'b']);

    s = r.reorderExercise(s, 'b', 0);
    expect(s.exercises.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(s.deferredIds).toEqual([]);
    // Pointer follows the exercise it was on ('c').
    expect(s.exercises[s.currentExerciseIndex].id).toBe('c');
    expect(r.reorderExercise(s, 'b', 0)).toBe(s);
  });

  it('goToExercise clamps and returns the same object when unchanged', () => {
    const s = session();
    expect(r.goToExercise(s, -5).currentExerciseIndex).toBe(0);
    expect(r.goToExercise(s, 99).currentExerciseIndex).toBe(2);
    expect(r.goToExercise(s, 0)).toBe(s);
  });

  it('patchExercise is referentially stable when nothing changes', () => {
    const s = session();
    expect(r.patchExercise(s, 'a', (e) => e)).toBe(s);
    expect(r.patchExercise(s, 'a', (e) => ({ ...e, notes: 'x' })).exercises[0].notes).toBe('x');
    expect(r.setNotes(s, '')).toBe(s);
    expect(r.setNotes(s, 'great').notes).toBe('great');
  });

  it('classifies exercise outcomes', () => {
    const s = session();
    s.exercises[0].sets = [{ id: 'x', setNumber: 1, type: 'working', targetReps: { min: 1, max: 1 }, weightKg: 1, reps: 1, completed: true, completedAt: iso(1) }];
    s.exercises[1].skipped = true;
    expect(r.exerciseOutcome(s)).toEqual({ completed: ['a'], skipped: ['b'], untouched: ['c'] });
  });
});

describe('seedPlans', () => {
  const empty = () => ({ plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

  it('seeds the reference, the starter template and an active Starter copy on a fresh install', () => {
    const seeded = seedPlans(empty(), '2026-11-01T00:00:00.000Z');
    expect(seeded.plans.map((p) => p.kind).sort()).toEqual(['active', 'template', 'template']);
    const active = seeded.plans.find((p) => p.kind === 'active')!;
    expect(active.sourcePlanId).toBe('full_body_starter');
    expect(active.days).toHaveLength(3);
    expect(active.nextDayIndex).toBe(0);
    expect(seedPlans(seeded)).toBe(seeded); // idempotent
  });

  it('adopts the PDF program when legacy history exists and points past the last completed day', () => {
    const state = {
      ...empty(),
      history: [
        { ...session({ planId: 'pdf_ppl_ul_v5', planDayId: 'pdf_ppl_ul_v5:pull_a', code: 'Pull A', status: 'completed' }), id: 'h1' },
      ],
    };
    const seeded = seedPlans(state);
    const active = seeded.plans.find((p) => p.kind === 'active')!;
    expect(active.sourcePlanId).toBe('pdf_ppl_ul_v5');
    expect(active.days[active.nextDayIndex].code).toBe('Leg A');
  });
});

describe('isSessionForDay', () => {
  it('matches by day id, or by code against the plan\'s source program', () => {
    const { isSessionForDay, clonePlan } = jest.requireActual<typeof import('@/data/plans')>('@/data/plans');
    const { buildPplUlTemplate } = jest.requireActual<typeof import('@/data/seeds/pdfProgram')>('@/data/seeds/pdfProgram');
    const reference = buildPplUlTemplate();
    const active = clonePlan(reference, 'active', 'active', '2026-11-01T00:00:00.000Z');
    const legacy = session({ planId: reference.id, planDayId: reference.days[1].id, code: 'Pull A' });
    const fresh = session({ planId: active.id, planDayId: active.days[1].id, code: 'Pull A' });
    const other = session({ planId: 'x', planDayId: 'x:1', code: 'Pull A' });
    expect(isSessionForDay(legacy, active, active.days[1])).toBe(true);
    expect(isSessionForDay(legacy, active, active.days[0])).toBe(false);
    expect(isSessionForDay(fresh, active, active.days[1])).toBe(true);
    expect(isSessionForDay(other, active, active.days[1])).toBe(false);
  });
});

describe('seedPlans onboarding', () => {
  const empty = () => ({ plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

  it('leaves onboarding pending on a fresh install and marks it complete for installs with history', () => {
    expect(seedPlans(empty()).settings.onboardingComplete).toBe(false);
    const withHistory = { ...empty(), history: [{ ...session({ status: 'completed' }), id: 'h' }] };
    expect(seedPlans(withHistory).settings.onboardingComplete).toBe(true);
    const withActive = { ...empty(), activeSession: session() };
    expect(seedPlans(withActive).settings.onboardingComplete).toBe(true);
    const already = { ...empty(), settings: { ...DEFAULT_SETTINGS, onboardingComplete: true } };
    expect(seedPlans(already).settings).toBe(already.settings);
  });
});
