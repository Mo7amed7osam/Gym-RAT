import { ar } from '@/i18n/ar';
import { arabicPluralForm, setCurrentLocale, translate } from '@/i18n';
import { iosAr } from '@/i18n/ios.ar';
import { progressAr } from '@/i18n/progress.ar';
import { localName, secondaryName } from '@/lib/exerciseName';
import { groupRange } from '@/components/GroupExercisesSheet';
import { seedPlans } from '@/data/db/seed';
import { restSecondsAfter, setGroup } from '@/domain/session/reducer';
import { exercise, local, session, set } from '@/test/fixtures/sessions';
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

describe('giant-set multi-select', () => {
  it('always covers the whole range between the first and last pick', () => {
    expect(groupRange(new Set([3]))).toEqual([3]);
    expect(groupRange(new Set([1, 3]))).toEqual([1, 2, 3]);
    expect(groupRange(new Set([4, 2, 5]))).toEqual([2, 3, 4, 5]);
    expect(groupRange(new Set())).toEqual([]);
  });

  it('groups three exercises into a giant set that rests only after the last member', () => {
    const base = session(local(2026, 11, 2), [exercise('a', [set({ reps: 10 })]), exercise('b', [set({ reps: 10 })]), exercise('c', [set({ reps: 10 })])], { status: 'in_progress' });
    const grouped = setGroup(base, base.exercises.map((item) => item.id), 'g');
    expect(grouped.exercises.map((item) => item.groupKind)).toEqual(['giant', 'giant', 'giant']);
    const options = { warmupRestSeconds: 45, userRestSeconds: null };
    const [a, , c] = grouped.exercises;
    expect(restSecondsAfter(grouped, a, a.sets[0], options)).toBe(0);
    const lastRound = { ...grouped, exercises: grouped.exercises.map((item) => ({ ...item, sets: item.sets.map((s) => ({ ...s, completed: true })) })) };
    expect(restSecondsAfter(lastRound, c, c.sets[0], options)).toBe(120);
  });
});

describe('exercise names follow the UI language', () => {
  const builtin = { en: 'Leg Press', ar: 'مكبس' };
  const custom = { en: 'Sled Push', ar: 'Sled Push' };
  it('shows the UI language first and the other language underneath', () => {
    expect([localName(builtin, 'en'), secondaryName(builtin, 'en')]).toEqual(['Leg Press', 'مكبس']);
    expect([localName(builtin, 'ar'), secondaryName(builtin, 'ar')]).toEqual(['مكبس', 'Leg Press']);
  });
  it('falls back to English and never repeats the same name', () => {
    expect([localName(custom, 'ar'), secondaryName(custom, 'ar')]).toEqual(['Sled Push', null]);
    expect(localName({ en: 'Row', ar: '' }, 'ar')).toBe('Row');
    expect(localName(undefined, 'ar', 'fallback-id')).toBe('fallback-id');
  });
});

describe('Arabic plurals and wording', () => {
  afterEach(() => setCurrentLocale('en'));

  it('uses the CLDR Arabic plural categories', () => {
    expect([0, 1, 2, 3, 10, 11, 99, 100, 102, 111, 2.5].map(arabicPluralForm)).toEqual(['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'other', 'other', 'many', 'other']);
    setCurrentLocale('ar');
    expect([1, 2, 5, 12, 100].map((count) => translate('progress.workoutsCount', { count }))).toEqual(['تمرين واحد', 'تمرينان', '5 تمارين', '12 تمرينًا', '100 تمرين']);
    expect(translate('progress.calendar.weeksValue', { count: 2 })).toBe('أسبوعان');
    setCurrentLocale('en');
    expect([1, 2].map((count) => translate('progress.workoutsCount', { count }))).toEqual(['1 workout', '2 workouts']);
  });

  it('keeps Western percent signs and digits in every Arabic string', () => {
    const strings = JSON.stringify([ar, progressAr, iosAr]);
    expect(strings).not.toMatch(/[٠-٩۰-۹٪]/);
    expect(strings).not.toMatch(/سِت|دورتك'|راحة-توقف|أقصى تكرار مقدّر/);
  });
});
