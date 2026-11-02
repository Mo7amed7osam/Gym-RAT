import { exerciseProgression } from '@/domain/analytics/progression';
import { registerStrengthMetrics } from '@/domain/analytics/metrics';
import { computeExerciseRecords } from '@/domain/records';
import { setGroup } from '@/domain/session/reducer';
import { setCurrentLocale } from '@/i18n';
import { formatDuration, formatKg, formatKgCompact, formatLongDate, formatShortDate, formatTime, formatWeekdayShort, latinDigits } from '@/lib/format';
import { formatRecordPrevious, formatRecordValue } from '@/lib/recordFormat';
import { getExerciseBests } from '@/lib/workoutMath';
import { done, exercise, local, session } from '@/test/fixtures/sessions';

const ARABIC_INDIC = /[٠-٩۰-۹]/;

describe('Western digits and localized units (decision D8)', () => {
  afterEach(() => setCurrentLocale('en'));

  it('maps Arabic-Indic and Persian digits to Western ones', () => {
    expect(latinDigits('١٢:٣٤ ۵۶')).toBe('12:34 56');
  });

  it('formats dates in Arabic without Arabic-Indic digits', () => {
    setCurrentLocale('ar');
    const day = new Date(2026, 10, 2, 18, 5);
    for (const text of [formatLongDate(day), formatShortDate(day.toISOString()), formatTime(day.toISOString()), formatWeekdayShort(day)]) {
      expect(text).not.toMatch(ARABIC_INDIC);
    }
    expect(formatLongDate(day)).toContain('2');
  });

  it('uses the UI language for weight and duration units, never Latin "kg" in Arabic', () => {
    expect(formatKg(1200)).toBe('1,200 kg');
    expect(formatDuration(72 * 60)).toBe('1 h 12 min');
    setCurrentLocale('ar');
    expect(formatKg(1200)).toBe('1,200 كجم');
    expect(formatKgCompact(28_700)).toBe('28.7 طن');
    expect(formatDuration(42 * 60)).toBe('42 د');
    expect(formatDuration(72 * 60)).toBe('1 س 12 د');
  });

  it('prints every record kind in its own unit', () => {
    expect(formatRecordValue('top_weight', 21.25)).toBe('21.5 kg');
    expect(formatRecordValue('estimated_1rm', 146.66)).toBe('146.5 kg');
    expect(formatRecordValue('set_volume', 22.7 * 3)).toBe('68 kg');
    expect(formatRecordValue('reps_at_weight', 12, 80)).toBe('12 × 80 kg');
    expect(formatRecordPrevious('reps_at_weight', 10)).toBe('10');
    expect(formatRecordPrevious('set_volume', 1200)).toBe('1,200 kg');
  });
});

describe('one e1RM engine on every screen', () => {
  afterEach(() => registerStrengthMetrics(null));

  const history = [
    session(local(2026, 10, 20), [exercise('bench', [done(100, 15)])]),
    session(local(2026, 10, 13), [exercise('bench', [done(110, 10)])]),
  ];

  it('card/library "Best" agrees with Records and the progress chart (no estimate above 12 reps)', () => {
    const bests = getExerciseBests(history, 'bench');
    expect(bests.bestSet).toMatchObject({ weightKg: 110, reps: 10 });
    expect(bests.bestOneRepMax).toBeCloseTo(146.67, 1);
    expect(computeExerciseRecords(history, 'bench', 'total').bestEstimated1rm?.value).toBeCloseTo(bests.bestOneRepMax, 6);
    const chartBest = Math.max(...exerciseProgression(history, 'bench').map((point) => point.bestE1rmKg));
    expect(chartBest).toBeCloseTo(bests.bestOneRepMax, 6);
  });

  it('falls back to the heaviest set when no set has an estimate', () => {
    const highReps = [session(local(2026, 10, 20), [exercise('curl', [done(20, 15), done(22.5, 13), done(22.5, 14)])])];
    expect(getExerciseBests(highReps, 'curl')).toMatchObject({ bestOneRepMax: 0, bestSet: { weightKg: 22.5, reps: 14 } });
  });

  it('gives assisted exercises no e1RM anywhere (assistance is not load)', () => {
    registerStrengthMetrics((id) => (id === 'assisted_pullup' ? 'assisted' : 'total'));
    const assisted = [session(local(2026, 10, 20), [exercise('assisted_pullup', [done(40, 8), done(30, 6)])])];
    expect(computeExerciseRecords(assisted, 'assisted_pullup', 'assisted').bestEstimated1rm).toBeNull();
    expect(exerciseProgression(assisted, 'assisted_pullup')[0].bestE1rmKg).toBe(0);
    expect(getExerciseBests(assisted, 'assisted_pullup')).toMatchObject({ bestOneRepMax: 0, topWeightKg: 0 });
  });
});

describe('superset / giant-set grouping', () => {
  const build = () => session(local(2026, 11, 2), [exercise('a', []), exercise('b', []), exercise('c', []), exercise('d', [])], { status: 'in_progress' });

  it('joining an existing group merges into a giant set instead of orphaning a member', () => {
    const start = build();
    const [a, b, c] = start.exercises;
    const pair = setGroup(start, [b.id, c.id], 'g1');
    expect(pair.exercises.slice(1, 3).map((item) => item.groupKind)).toEqual(['superset', 'superset']);
    const giant = setGroup(pair, [a.id, b.id], 'g2');
    expect(giant.exercises.slice(0, 3).map((item) => [item.groupId, item.groupKind])).toEqual([
      ['g2', 'giant'],
      ['g2', 'giant'],
      ['g2', 'giant'],
    ]);
    expect(giant.exercises[3].groupId).toBeNull();
  });

  it('ungrouping keeps kinds matching group size and never leaves a group of one', () => {
    const start = build();
    const [a, b, c] = start.exercises;
    const giant = setGroup(start, [a.id, b.id, c.id], 'g');
    const two = setGroup(giant, [a.id], null);
    expect(two.exercises.slice(0, 3).map((item) => item.groupKind)).toEqual([null, 'superset', 'superset']);
    const none = setGroup(two, [b.id], null);
    expect(none.exercises.every((item) => item.groupId === null && item.groupKind === null)).toBe(true);
    expect(setGroup(none, [d(none)], null)).toBe(none);
  });

  const d = (s: ReturnType<typeof build>) => s.exercises[3].id;
});
