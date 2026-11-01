import { BUILTIN_EXERCISES, builtinContent } from '@/data/exercisesData';
import { clonePlan } from '@/data/plans';
import { PDF_PROGRAM_ID, buildPplUlTemplate } from '@/data/seeds/pdfProgram';
import { STARTER_PLAN_ID, buildStarterTemplate } from '@/data/seeds/starterPlan';
import type { Exercise, Plan } from '@/types/workout';

import type { PersistedWorkoutState } from './repository';

/**
 * Ensures the bundled plans exist and that there is exactly one active plan.
 * Pure: returns the same object when nothing needs seeding.
 *
 * - Bundled templates are (re)inserted when missing. They are locked, so
 *   refreshing them never touches user data.
 * - Fresh install → Full Body Starter becomes the active plan (spec §5).
 * - Install with legacy history but no active plan → the Push/Pull/Legs +
 *   Upper/Lower program is adopted, because the history was logged against it.
 */
export function seedPlans(state: PersistedWorkoutState, now: string = new Date().toISOString()): PersistedWorkoutState {
  const byId = new Map(state.plans.map((plan) => [plan.id, plan]));
  let plans = state.plans;
  let changed = false;

  for (const bundled of [buildPplUlTemplate(), buildStarterTemplate()]) {
    if (!byId.has(bundled.id)) {
      plans = [...plans, bundled];
      byId.set(bundled.id, bundled);
      changed = true;
    }
  }

  if (!plans.some((plan) => plan.kind === 'active')) {
    const hasLegacyHistory = state.history.some((session) => session.planId === PDF_PROGRAM_ID) || state.activeSession?.planId === PDF_PROGRAM_ID;
    const source = byId.get(hasLegacyHistory ? PDF_PROGRAM_ID : STARTER_PLAN_ID) as Plan;
    const active = clonePlan(source, `${source.id}:active`, 'active', now);
    if (hasLegacyHistory) active.nextDayIndex = nextIndexAfterHistory(active, state);
    plans = [...plans, active];
    changed = true;
  }

  // Anyone with workout data already knows the app: never show first-launch onboarding to them.
  let settings = state.settings;
  if (!settings.onboardingComplete && (state.history.length > 0 || state.activeSession !== null)) {
    settings = { ...settings, onboardingComplete: true };
    changed = true;
  }

  return changed ? { ...state, plans, settings } : state;
}

/** Day after the most recent completed session of the source program. */
function nextIndexAfterHistory(active: Plan, state: PersistedWorkoutState): number {
  const latest = state.history.find((session) => session.status === 'completed' && session.planDayId);
  if (!latest) return 0;
  const sourceDayId = latest.planDayId!.split(':').slice(1).join(':');
  const index = active.days.findIndex((day) => day.id.endsWith(`:${sourceDayId}`) || day.code === latest.code);
  return index === -1 ? 0 : (index + 1) % active.days.length;
}

/**
 * Ensures every built-in exercise exists and carries the current authored
 * content (ADR-007). Pure: returns the same object when nothing changes.
 * User-owned columns (`userNotes`, `userRestSeconds`, `imageUri`, `archived`)
 * and custom exercises are never touched.
 */
export function seedExercises(state: PersistedWorkoutState, now: string = new Date().toISOString()): PersistedWorkoutState {
  const byId = new Map(state.exercises.map((exercise) => [exercise.id, exercise]));
  let exercises = state.exercises;
  let changed = false;
  for (const seed of BUILTIN_EXERCISES) {
    const existing = byId.get(seed.id);
    if (!existing) {
      exercises = [...exercises, seed];
      changed = true;
      continue;
    }
    if (existing.origin !== 'builtin') continue;
    const current = JSON.stringify(builtinContent(existing));
    const authored = JSON.stringify(builtinContent(seed));
    if (current === authored) continue;
    const refreshed: Exercise = { ...existing, ...builtinContent(seed), updatedAt: now };
    exercises = exercises.map((exercise) => (exercise.id === seed.id ? refreshed : exercise));
    changed = true;
  }
  return changed ? { ...state, exercises } : state;
}
