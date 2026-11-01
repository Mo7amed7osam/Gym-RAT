import { clampDayIndex, clonePlan } from '@/data/plans';
import type { ExercisePrescription, LocalizedText, Plan, PlanDay, RestPeriod, TrainingFocus } from '@/types/workout';

/**
 * Pure plan-builder operations (P2.3). Every function returns a new plan and
 * never touches sessions: history snapshots its prescriptions at start time,
 * so editing a plan only affects future workouts. Day ids stay stable across
 * reorders (sessions and the rotation pointer reference them); new days get
 * the id the caller supplies.
 */

export class LockedPlanError extends Error {
  constructor(planId: string) {
    super(`Plan "${planId}" is a bundled template; duplicate it before editing`);
    this.name = 'LockedPlanError';
  }
}

const assertEditable = (plan: Plan): void => {
  if (plan.locked) throw new LockedPlanError(plan.id);
};

const touch = (plan: Plan, now: string): Plan => ({ ...plan, updatedAt: now });

export const DEFAULT_REST: RestPeriod = { defaultSeconds: 90, minSeconds: 90, maxSeconds: 90 };

export function createEmptyPlan(id: string, name: LocalizedText, now: string): Plan {
  return {
    id,
    kind: 'template',
    name,
    description: null,
    sourcePlanId: null,
    locked: false,
    nextDayIndex: 0,
    days: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Editable copy of any plan (bundled or not); the copy is a template until activated. */
export function duplicatePlan(source: Plan, id: string, now: string, name?: LocalizedText): Plan {
  const copy = clonePlan(source, id, 'template', now);
  return { ...copy, name: name ?? { en: `${source.name.en} copy`, ar: `${source.name.ar} (نسخة)` }, sourcePlanId: source.sourcePlanId ?? source.id };
}

export function renamePlan(plan: Plan, name: LocalizedText, description: LocalizedText | null, now: string): Plan {
  assertEditable(plan);
  return touch({ ...plan, name, description }, now);
}

export function makeDay(id: string, position: number, code: string, title?: LocalizedText): PlanDay {
  return { id, position, code, title: title ?? { en: code, ar: code }, muscleSummary: { en: '', ar: '' }, focus: null, exercises: [] };
}

const renumber = (days: PlanDay[]): PlanDay[] => days.map((day, position) => (day.position === position ? day : { ...day, position }));

export function addDay(plan: Plan, day: PlanDay, now: string): Plan {
  assertEditable(plan);
  return touch({ ...plan, days: renumber([...plan.days, day]) }, now);
}

export function removeDay(plan: Plan, dayId: string, now: string): Plan {
  assertEditable(plan);
  const index = plan.days.findIndex((day) => day.id === dayId);
  if (index === -1) return plan;
  const days = renumber(plan.days.filter((day) => day.id !== dayId));
  // Keep the pointer on the same day when possible; otherwise clamp.
  let nextDayIndex = plan.nextDayIndex;
  if (index < plan.nextDayIndex) nextDayIndex -= 1;
  const next = { ...plan, days, nextDayIndex: 0 };
  return touch({ ...next, nextDayIndex: clampDayIndex(next, nextDayIndex) }, now);
}

export function reorderDay(plan: Plan, dayId: string, toIndex: number): Plan {
  assertEditable(plan);
  const from = plan.days.findIndex((day) => day.id === dayId);
  if (from === -1) return plan;
  const to = Math.max(0, Math.min(plan.days.length - 1, toIndex));
  if (from === to) return plan;
  const pointerDayId = plan.days[clampDayIndex(plan, plan.nextDayIndex)]?.id;
  const days = [...plan.days];
  const [moved] = days.splice(from, 1);
  days.splice(to, 0, moved);
  const renumbered = renumber(days);
  const nextDayIndex = Math.max(0, renumbered.findIndex((day) => day.id === pointerDayId));
  return { ...plan, days: renumbered, nextDayIndex, updatedAt: plan.updatedAt };
}

export function updateDay(
  plan: Plan,
  dayId: string,
  patch: Partial<Pick<PlanDay, 'code' | 'title' | 'muscleSummary'>> & { focus?: TrainingFocus | null },
  now: string,
): Plan {
  assertEditable(plan);
  return touch({ ...plan, days: plan.days.map((day) => (day.id === dayId ? { ...day, ...patch } : day)) }, now);
}

function updateExercises(plan: Plan, dayId: string, update: (exercises: ExercisePrescription[]) => ExercisePrescription[], now: string): Plan {
  assertEditable(plan);
  const day = plan.days.find((item) => item.id === dayId);
  if (!day) return plan;
  const exercises = update(day.exercises);
  if (exercises === day.exercises) return plan;
  return touch({ ...plan, days: plan.days.map((item) => (item.id === dayId ? { ...item, exercises } : item)) }, now);
}

export function addExercise(plan: Plan, dayId: string, prescription: ExercisePrescription, now: string): Plan {
  return updateExercises(plan, dayId, (exercises) => [...exercises, prescription], now);
}

export function removeExercise(plan: Plan, dayId: string, index: number, now: string): Plan {
  return updateExercises(plan, dayId, (exercises) => (index < 0 || index >= exercises.length ? exercises : exercises.filter((_, i) => i !== index)), now);
}

export function reorderExercise(plan: Plan, dayId: string, from: number, to: number, now: string): Plan {
  return updateExercises(
    plan,
    dayId,
    (exercises) => {
      const target = Math.max(0, Math.min(exercises.length - 1, to));
      if (from < 0 || from >= exercises.length || from === target) return exercises;
      const next = [...exercises];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return next;
    },
    now,
  );
}

/** Swaps the movement but keeps sets, reps and rest. */
export function substituteExercise(plan: Plan, dayId: string, index: number, exerciseId: string, now: string): Plan {
  return updateExercises(plan, dayId, (exercises) => exercises.map((item, i) => (i === index ? { ...item, exerciseId } : item)), now);
}

export function updatePrescription(plan: Plan, dayId: string, index: number, patch: Partial<Omit<ExercisePrescription, 'exerciseId'>>, now: string): Plan {
  return updateExercises(plan, dayId, (exercises) => exercises.map((item, i) => (i === index ? { ...item, ...patch } : item)), now);
}

export function defaultPrescription(exerciseId: string, userRestSeconds: number | null = null): ExercisePrescription {
  const rest = userRestSeconds ? { defaultSeconds: userRestSeconds, minSeconds: userRestSeconds, maxSeconds: userRestSeconds } : DEFAULT_REST;
  return { exerciseId, sets: 3, reps: { min: 8, max: 12 }, rest };
}

/**
 * Makes `planId` the one active plan. Locked templates are copied first
 * (the copy becomes active); an unlocked plan flips to `active` in place and
 * the previous active plan becomes a template again, keeping its rotation
 * pointer so the user can switch back. History is untouched either way.
 */
export function activatePlan(plans: Plan[], planId: string, newId: string, now: string): { plans: Plan[]; active: Plan } | null {
  const target = plans.find((plan) => plan.id === planId);
  if (!target) return null;
  if (target.kind === 'active') return { plans, active: target };
  const demoted = plans.map((plan) => (plan.kind === 'active' ? { ...plan, kind: 'template' as const, updatedAt: now } : plan));
  if (target.locked) {
    const active = clonePlan(target, newId, 'active', now);
    return { plans: [...demoted, active], active };
  }
  const active: Plan = { ...target, kind: 'active', archived: false, updatedAt: now };
  return { plans: demoted.map((plan) => (plan.id === planId ? active : plan)), active };
}

export function setPlanArchived(plan: Plan, archived: boolean, now: string): Plan {
  if (plan.kind === 'active' || plan.locked) return plan;
  return plan.archived === archived ? plan : touch({ ...plan, archived }, now);
}
