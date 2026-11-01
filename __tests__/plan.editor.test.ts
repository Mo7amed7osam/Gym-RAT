import { createNodeDriver } from '@/data/db/driver.node';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '@/data/db/migrations';
import { WorkoutRepository } from '@/data/db/repository';
import { seedExercises, seedPlans } from '@/data/db/seed';
import { PDF_PROGRAM_ID } from '@/data/seeds/pdfProgram';
import { STARTER_PLAN_ID } from '@/data/seeds/starterPlan';
import * as editor from '@/domain/plan/editor';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER, attachPersistence, selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import type { Plan } from '@/types/workout';

/** Phase 2 P2.3 — plan builder. */

const NOW = '2026-11-02T10:00:00.000Z';
const empty = () => ({ exercises: [], plans: [], activeSession: null, history: [], restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });

const fresh = (): Plan => {
  let plan = editor.createEmptyPlan('p1', { en: 'Mine', ar: 'خطتي' }, NOW);
  plan = editor.addDay(plan, editor.makeDay('d1', 0, 'Day 1'), NOW);
  plan = editor.addDay(plan, editor.makeDay('d2', 1, 'Day 2'), NOW);
  plan = editor.addDay(plan, editor.makeDay('d3', 2, 'Day 3'), NOW);
  plan = editor.addExercise(plan, 'd1', editor.defaultPrescription('leg_press'), NOW);
  plan = editor.addExercise(plan, 'd1', editor.defaultPrescription('leg_extension'), NOW);
  return plan;
};

describe('plan editor (pure)', () => {
  it('builds a plan from scratch with stable day ids and renumbered positions', () => {
    const plan = fresh();
    expect(plan.days.map((d) => [d.id, d.position])).toEqual([['d1', 0], ['d2', 1], ['d3', 2]]);
    expect(plan.days[0].exercises.map((e) => e.exerciseId)).toEqual(['leg_press', 'leg_extension']);
    expect(plan.kind).toBe('template');
    expect(plan.locked).toBe(false);
  });

  it('reorders days without changing ids and keeps the rotation pointer on the same day', () => {
    const plan = { ...fresh(), nextDayIndex: 2 }; // pointing at d3
    const moved = editor.reorderDay(plan, 'd3', 0);
    expect(moved.days.map((d) => d.id)).toEqual(['d3', 'd1', 'd2']);
    expect(moved.days.map((d) => d.position)).toEqual([0, 1, 2]);
    expect(moved.nextDayIndex).toBe(0);
  });

  it('removes days and clamps the pointer', () => {
    const plan = { ...fresh(), nextDayIndex: 2 };
    const removed = editor.removeDay(plan, 'd1', NOW);
    expect(removed.days.map((d) => d.id)).toEqual(['d2', 'd3']);
    expect(removed.nextDayIndex).toBe(1);
    const emptyPlan = editor.removeDay(editor.removeDay(removed, 'd2', NOW), 'd3', NOW);
    expect(emptyPlan.days).toEqual([]);
    expect(emptyPlan.nextDayIndex).toBe(0);
  });

  it('edits, reorders, substitutes and removes exercises on a day', () => {
    let plan = fresh();
    plan = editor.updatePrescription(plan, 'd1', 0, { sets: 4, reps: { min: 6, max: 8 }, rest: { defaultSeconds: 150, minSeconds: 150, maxSeconds: 150 } }, NOW);
    expect(plan.days[0].exercises[0]).toMatchObject({ exerciseId: 'leg_press', sets: 4, reps: { min: 6, max: 8 }, rest: { defaultSeconds: 150 } });
    plan = editor.reorderExercise(plan, 'd1', 1, 0, NOW);
    expect(plan.days[0].exercises.map((e) => e.exerciseId)).toEqual(['leg_extension', 'leg_press']);
    plan = editor.substituteExercise(plan, 'd1', 0, 'hack_squat', NOW);
    expect(plan.days[0].exercises[0].exerciseId).toBe('hack_squat');
    expect(plan.days[0].exercises[0].sets).toBe(3);
    plan = editor.removeExercise(plan, 'd1', 1, NOW);
    expect(plan.days[0].exercises.map((e) => e.exerciseId)).toEqual(['hack_squat']);
    expect(editor.removeExercise(plan, 'd1', 5, NOW)).toBe(plan);
  });

  it('refuses to edit bundled templates but can duplicate them', () => {
    const state = seedPlans(empty());
    const bundled = state.plans.find((p) => p.id === PDF_PROGRAM_ID)!;
    expect(() => editor.addDay(bundled, editor.makeDay('x', 5, 'X'), NOW)).toThrow(editor.LockedPlanError);
    const copy = editor.duplicatePlan(bundled, 'copy-1', NOW);
    expect(copy).toMatchObject({ id: 'copy-1', kind: 'template', locked: false, sourcePlanId: PDF_PROGRAM_ID, archived: false });
    expect(copy.name.en).toBe(`${bundled.name.en} copy`);
    expect(copy.days.map((d) => d.id)).toEqual(['copy-1:0', 'copy-1:1', 'copy-1:2', 'copy-1:3', 'copy-1:4']);
    expect(copy.days[0].exercises).toEqual(bundled.days[0].exercises);
    expect(editor.addDay(copy, editor.makeDay('x', 5, 'X'), NOW).days).toHaveLength(6);
  });

  it('activation keeps exactly one active plan and demotes the previous one without losing it', () => {
    const seeded = seedPlans(empty());
    const mine = fresh();
    const plans = [...seeded.plans, mine];
    const result = editor.activatePlan(plans, 'p1', 'unused', NOW)!;
    expect(result.active.id).toBe('p1');
    expect(result.plans.filter((p) => p.kind === 'active')).toHaveLength(1);
    expect(result.plans.find((p) => p.id === `${STARTER_PLAN_ID}:active`)?.kind).toBe('template');
    // Locked template → clone becomes active, the template stays.
    const again = editor.activatePlan(result.plans, PDF_PROGRAM_ID, 'clone-1', NOW)!;
    expect(again.active).toMatchObject({ id: 'clone-1', kind: 'active', sourcePlanId: PDF_PROGRAM_ID });
    expect(again.plans.filter((p) => p.kind === 'active')).toHaveLength(1);
    expect(again.plans.find((p) => p.id === 'p1')?.kind).toBe('template');
    expect(again.plans.find((p) => p.id === PDF_PROGRAM_ID)?.kind).toBe('template');
    expect(editor.activatePlan(again.plans, 'nope', 'x', NOW)).toBeNull();
  });

  it('archives templates only', () => {
    const plan = fresh();
    expect(editor.setPlanArchived(plan, true, NOW).archived).toBe(true);
    expect(editor.setPlanArchived({ ...plan, kind: 'active' }, true, NOW).archived).toBe(false);
    expect(editor.setPlanArchived({ ...plan, locked: true }, true, NOW).archived).toBe(false);
  });
});

describe('schema v5', () => {
  it('adds plans.archived to a v4 database and round-trips it', () => {
    const driver = createNodeDriver();
    driver.transaction(() => {
      for (const step of MIGRATIONS.slice(0, 4)) step.up(driver);
      driver.exec('PRAGMA user_version = 4');
    });
    driver.run(
      `INSERT INTO plans (id, kind, name_json, locked, next_day_index, created_at, updated_at) VALUES ('t', 'template', '{"en":"T","ar":"T"}', 0, 0, ?, ?)`,
      [NOW, NOW],
    );
    expect(migrate(driver)).toEqual({ from: 4, to: SCHEMA_VERSION, applied: [5] });
    const repo = new WorkoutRepository(driver);
    const loaded = repo.loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS });
    expect(loaded.plans[0].archived).toBe(false);
    const archived = { ...loaded, plans: [{ ...loaded.plans[0], archived: true }] };
    repo.persistDiff(loaded, archived);
    expect(repo.loadAll({ restTimer: IDLE_REST_TIMER, settings: DEFAULT_SETTINGS }).plans[0].archived).toBe(true);
  });
});

describe('store: plan builder', () => {
  beforeEach(() => {
    attachPersistence(null);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
    useWorkoutStore.setState({ previewDayIndex: null, persistenceError: null, ...seedExercises(seedPlans(empty())) });
  });
  afterEach(() => jest.useRealTimers());

  it('create → build → activate → edit active plan without corrupting history, then switch back', () => {
    const store = useWorkoutStore.getState();
    const plan = store.createPlan({ en: 'Push only', ar: 'دفع فقط' });
    const day = store.addPlanDay(plan.id, 'Push');
    store.addPlanExercise(plan.id, day.id, 'flat_barbell_bench_press');
    store.addPlanExercise(plan.id, day.id, 'dumbbell_lateral_raise');
    store.updatePlanExercise(plan.id, day.id, 0, { sets: 5 });

    // Log a session on the Starter first.
    expect(store.startWorkout().ok).toBe(true);
    store.finishWorkout('advance');
    const starterActiveId = selectActivePlan(useWorkoutStore.getState())!.id;
    expect(useWorkoutStore.getState().history).toHaveLength(1);

    store.activatePlan(plan.id);
    let state = useWorkoutStore.getState();
    expect(selectActivePlan(state)?.id).toBe(plan.id);
    expect(state.plans.filter((p) => p.kind === 'active')).toHaveLength(1);
    expect(state.plans.find((p) => p.id === starterActiveId)?.kind).toBe('template');
    expect(state.history).toHaveLength(1); // untouched

    // Editing the active plan changes future sessions only.
    const started = store.startWorkout();
    expect(started.ok && started.session.exercises.map((e) => e.exerciseId)).toEqual(['flat_barbell_bench_press', 'dumbbell_lateral_raise']);
    expect(started.ok && started.session.exercises[0].sets).toHaveLength(5);
    store.substitutePlanExercise(plan.id, day.id, 1, 'leaning_lateral_raise');
    state = useWorkoutStore.getState();
    expect(state.activeSession?.exercises[1].exerciseId).toBe('dumbbell_lateral_raise');
    expect(selectActivePlan(state)?.days[0].exercises[1].exerciseId).toBe('leaning_lateral_raise');
    store.finishWorkout('advance');
    expect(useWorkoutStore.getState().history).toHaveLength(2);

    // Switch back to the Starter: its history still matches its days.
    store.activatePlan(starterActiveId);
    state = useWorkoutStore.getState();
    expect(selectActivePlan(state)?.id).toBe(starterActiveId);
    expect(selectActivePlan(state)?.nextDayIndex).toBe(1);
    expect(state.history).toHaveLength(2);
    expect(state.plans.find((p) => p.id === plan.id)?.kind).toBe('template');
  });

  it('duplicates a bundled template into an editable copy and archives/restores it', () => {
    const store = useWorkoutStore.getState();
    const copy = store.duplicatePlan(PDF_PROGRAM_ID)!;
    expect(copy.locked).toBe(false);
    store.renamePlan(copy.id, { en: 'My PPL', ar: 'برنامجي' }, null);
    store.removePlanDay(copy.id, copy.days[4].id);
    store.reorderPlanDay(copy.id, copy.days[3].id, 0);
    const edited = useWorkoutStore.getState().plans.find((p) => p.id === copy.id)!;
    expect(edited.name.en).toBe('My PPL');
    expect(edited.days.map((d) => d.code)).toEqual(['Upper B', 'Push A', 'Pull A', 'Leg A']);
    expect(useWorkoutStore.getState().plans.find((p) => p.id === PDF_PROGRAM_ID)?.days).toHaveLength(5);

    store.setPlanArchived(copy.id, true);
    expect(useWorkoutStore.getState().plans.find((p) => p.id === copy.id)?.archived).toBe(true);
    store.setPlanArchived(copy.id, false);
    expect(useWorkoutStore.getState().plans.find((p) => p.id === copy.id)?.archived).toBe(false);
    // Active plan refuses archiving.
    const activeId = selectActivePlan(useWorkoutStore.getState())!.id;
    store.setPlanArchived(activeId, true);
    expect(selectActivePlan(useWorkoutStore.getState())?.archived).toBe(false);
  });

  it('refuses edits to bundled templates', () => {
    const store = useWorkoutStore.getState();
    const before = useWorkoutStore.getState().plans.find((p) => p.id === STARTER_PLAN_ID)!;
    expect(() => store.addPlanDay(STARTER_PLAN_ID, 'X')).toThrow(editor.LockedPlanError);
    expect(useWorkoutStore.getState().plans.find((p) => p.id === STARTER_PLAN_ID)).toBe(before);
  });

  it('template sessions never move the rotation', () => {
    const store = useWorkoutStore.getState();
    const before = selectActivePlan(useWorkoutStore.getState())!.nextDayIndex;
    const result = store.startWorkout({ planId: PDF_PROGRAM_ID, dayIndex: 2 });
    expect(result.ok && result.session.kind).toBe('template');
    expect(result.ok && result.session.code).toBe('Leg A');
    store.finishWorkout('advance');
    expect(selectActivePlan(useWorkoutStore.getState())!.nextDayIndex).toBe(before);
    expect(useWorkoutStore.getState().history[0].kind).toBe('template');
  });
});
