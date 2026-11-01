import type { Plan, PlanDay, WorkoutSession } from '@/types/workout';

/** Rough session length: ~45 s per working set plus prescribed rest, plus 10 min warm-up. */
export function estimateDurationMinutes(day: PlanDay): number {
  const WORK_SECONDS_PER_SET = 45;
  const WARMUP_SECONDS = 10 * 60;
  const seconds = day.exercises.reduce(
    (total, item) => total + item.sets * (WORK_SECONDS_PER_SET + item.rest.defaultSeconds),
    WARMUP_SECONDS,
  );
  return Math.round(seconds / 60);
}

export function getTotalSets(day: PlanDay): number {
  return day.exercises.reduce((total, item) => total + item.sets, 0);
}

/**
 * Whether a session was logged against this plan day. Sessions started from
 * the plan match by id; sessions logged against the plan's source template or
 * reference (e.g. legacy history before the plan was adopted) match by day code.
 */
export function isSessionForDay(session: WorkoutSession, plan: Plan, day: PlanDay): boolean {
  if (session.planDayId === day.id) return true;
  return plan.sourcePlanId !== null && session.planId === plan.sourcePlanId && session.code === day.code;
}

/** The day the rotation points at, or null for an empty plan. */
export function getNextDay(plan: Plan): PlanDay | null {
  if (plan.days.length === 0) return null;
  return plan.days[clampDayIndex(plan, plan.nextDayIndex)];
}

export function clampDayIndex(plan: Plan, index: number): number {
  if (plan.days.length === 0) return 0;
  return ((index % plan.days.length) + plan.days.length) % plan.days.length;
}

/** Copies a template/reference into a new plan that can be made active. */
export function clonePlan(source: Plan, id: string, kind: Plan['kind'], now: string): Plan {
  return {
    ...source,
    id,
    kind,
    sourcePlanId: source.id,
    locked: false,
    nextDayIndex: 0,
    days: source.days.map((day, position) => ({
      ...day,
      id: `${id}:${position}`,
      position,
      exercises: day.exercises.map((e) => ({ ...e })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}
