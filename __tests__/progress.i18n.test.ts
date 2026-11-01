import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { setCurrentLocale, translate } from '@/i18n';
import { BODY_METRIC_KINDS, GOAL_KINDS } from '@/types/progress';
import { PERIOD_KINDS } from '@/domain/analytics/dates';
import { PROGRESSION_METRICS } from '@/domain/analytics/progression';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const ROOTS = ['screens/ProgressScreen.tsx', 'screens/analytics', 'components/progress', 'components/charts'];

function sourceFiles(path: string): string[] {
  const full = join(process.cwd(), path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => sourceFiles(join(path, name)));
}

/** Literal `progress.*` keys referenced by the Phase 4 UI. */
const literalKeys = [
  ...new Set(ROOTS.flatMap(sourceFiles).flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/['"](progress\.[A-Za-z0-9_.]+)['"]/g)].map((m) => m[1]))),
];

/** Keys built from enums at runtime. */
const dynamicKeys = [
  ...PERIOD_KINDS.flatMap((p) => [`progress.periods.${p}`, `progress.compare.${p}`]),
  ...['up', 'down', 'flat'].map((d) => `progress.trend.${d}`),
  ...BODY_METRIC_KINDS.map((k) => `progress.body.kinds.${k}`),
  ...GOAL_KINDS.flatMap((k) => [`progress.goals.kinds.${k}`, `progress.goals.titles.${k}`]),
  ...['target', 'exercise', 'body_metric', 'same_as_current'].map((c) => `progress.goals.errors.${c}`),
  ...PROGRESSION_METRICS.map((m) => `progress.exercise.metrics.${m}`),
  ...['3m', '6m', '1y', 'all'].map((r) => `progress.exercise.ranges.${r}`),
  ...['not_completed', 'invalid_time', 'end_before_start', 'too_long', 'in_future', 'invalid_weight', 'invalid_reps', 'missing_reps', 'invalid_type'].map(
    (c) => `progress.session.errors.${c}`,
  ),
  ...['top_weight', 'estimated_1rm'].map((k) => `progress.session.recordKinds.${k}`),
  ...['kgValue', 'cmValue', 'percentValue'].map((u) => `progress.units.${u}`),
];

describe('Progress strings', () => {
  it('finds the UI keys to check', () => {
    expect(literalKeys.length).toBeGreaterThan(80);
    // The detector itself works.
    expect(translate('progress.notAKey')).toMatch(/\[missing ".*" translation\]/);
  });

  it.each(['en', 'ar'] as const)('resolves every referenced key in %s', (locale) => {
    setCurrentLocale(locale);
    const missing = [...literalKeys, ...dynamicKeys].filter((key) => /\[missing ".*" translation\]/.test(translate(key, { count: 2 })));
    expect(missing).toEqual([]);
  });

  it('pluralises counts', () => {
    setCurrentLocale('en');
    expect(translate('progress.workoutsCount', { count: 1 })).toBe('1 workout');
    expect(translate('progress.workoutsCount', { count: 3 })).toBe('3 workouts');
  });
});
