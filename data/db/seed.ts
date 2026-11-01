import { clonePlan } from '@/data/plans';
import { PDF_PROGRAM_ID, buildPdfReferencePlan } from '@/data/seeds/pdfProgram';
import { STARTER_PLAN_ID, buildStarterTemplate } from '@/data/seeds/starterPlan';
import type { Plan } from '@/types/workout';

import type { PersistedWorkoutState } from './repository';

/**
 * Ensures the bundled plans exist and that there is exactly one active plan.
 * Pure: returns the same object when nothing needs seeding.
 *
 * - Bundled reference/template plans are (re)inserted when missing. They are
 *   locked, so refreshing them never touches user data.
 * - Fresh install → Full Body Starter becomes the active plan (spec §5).
 * - Install with legacy history but no active plan → the PDF program is
 *   adopted, because that is the program the history was logged against.
 */
export function seedPlans(state: PersistedWorkoutState, now: string = new Date().toISOString()): PersistedWorkoutState {
  const byId = new Map(state.plans.map((plan) => [plan.id, plan]));
  let plans = state.plans;
  let changed = false;

  for (const bundled of [buildPdfReferencePlan(), buildStarterTemplate()]) {
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
