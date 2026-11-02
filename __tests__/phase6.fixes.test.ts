import { seedPlans } from '@/data/db/seed';
import { clonePlan } from '@/data/plans';
import { LEGACY_STARTER_NAME_EN, STARTER_PLAN_ID, buildStarterTemplate } from '@/data/seeds/starterPlan';
import { DEFAULT_SETTINGS, IDLE_REST_TIMER } from '@/store/useWorkoutStore';
import type { Plan } from '@/types/workout';

function legacy(plan: Plan): Plan {
  return {
    ...plan,
    name: { en: LEGACY_STARTER_NAME_EN, ar: 'برنامج الجسم الكامل للمبتدئين (مسودة)' },
    description: { en: 'Three full-body workouts per rotation. Draft content pending approval.', ar: 'محتوى مبدئي' },
    days: plan.days.map((day) => ({ ...day, muscleSummary: { en: day.muscleSummary.en, ar: day.muscleSummary.en } })),
  };
}

describe('Full Body Starter without the "(draft)" label', () => {
  it('ships under its final name', () => {
    const plan = buildStarterTemplate();
    expect(plan.name).toEqual({ en: 'Full Body Starter', ar: 'برنامج الجسم الكامل للمبتدئين' });
    expect(JSON.stringify(plan)).not.toMatch(/draft|مسودة|مبدئي/i);
    expect(plan.days.every((day) => day.muscleSummary.ar !== day.muscleSummary.en)).toBe(true);
  });

  it('renames existing copies without touching workouts, rotation or status', () => {
    const template = legacy(buildStarterTemplate());
    const active = { ...clonePlan(template, `${STARTER_PLAN_ID}:active`, 'active', '2026-11-01T00:00:00.000Z'), nextDayIndex: 2 };
    const renamedByUser = { ...clonePlan(template, 'mine', 'template', '2026-11-01T00:00:00.000Z'), name: { en: 'My split', ar: 'خطتي' } };
    const state = {
      exercises: [],
      plans: [template, active, renamedByUser],
      activeSession: null,
      history: [],
      restTimer: IDLE_REST_TIMER,
      settings: { ...DEFAULT_SETTINGS, onboardingComplete: true },
    };
    const next = seedPlans(state);
    const [t, a, mine] = next.plans.filter((plan) => [template.id, active.id, 'mine'].includes(plan.id));
    for (const plan of [t, a]) {
      expect(plan.name.en).toBe('Full Body Starter');
      expect(plan.days[0].muscleSummary.ar).toBe('الرجل + الصدر + الظهر + الكتف');
    }
    expect(a.kind).toBe('active');
    expect(a.nextDayIndex).toBe(2);
    expect(a.days.map((day) => day.exercises)).toEqual(active.days.map((day) => day.exercises));
    expect(mine).toBe(renamedByUser);
    // Idempotent: a second boot changes nothing.
    expect(seedPlans(next)).toBe(next);
  });
});
