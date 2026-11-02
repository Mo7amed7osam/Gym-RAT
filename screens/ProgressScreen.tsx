import { useRouter } from 'expo-router';
import { ChartColumn, Scale, Target } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/charts/BarChart';
import { MonthGrid } from '@/components/progress/MonthGrid';
import { Card, CodeBadge, Group, ListRow, ProgressBar, StatTile } from '@/components/progress/parts';
import { Button } from '@/components/ui/Button';
import { SelectChip } from '@/components/ui/SelectChip';
import { MUSCLE_LABELS } from '@/data/exercisesData';
import { compareTotals, isCompleted, sessionStats } from '@/domain/analytics/aggregate';
import { changeOver, latestEntry } from '@/domain/analytics/body';
import { monthGrid, sessionsByDay, weeklyStreak } from '@/domain/analytics/calendar';
import { PERIOD_KINDS, comparisonRanges, periodRange, type PeriodKind } from '@/domain/analytics/dates';
import { evaluateGoal, newlyAchievedGoalIds } from '@/domain/analytics/goals';
import { muscleSetDistribution } from '@/domain/analytics/muscles';
import { trainedExercises } from '@/domain/analytics/progression';
import { average, trendOf, weeklySeries } from '@/domain/analytics/trends';
import { useLocale, useT } from '@/i18n';
import { formatDayMonth, formatHoursMinutes, formatMonthYear, formatNumber, formatShortDateLatin, formatSigned } from '@/lib/analyticsFormat';
import { formatKg, formatKgCompact } from '@/lib/format';
import { useFocusNow } from '@/lib/useFocusNow';
import { useProgressStore } from '@/store/useProgressStore';
import { useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

import { goalTitle, goalValueText } from './analytics/goalText';
import { localName } from '@/lib/exerciseName';

const TREND_WEEKS = 12;
const PREVIEW_ROWS = 5;

/**
 * Progress tab (Phase 4): period comparison, weekly trends, muscle balance,
 * calendar, goals, body and exercise progression, recent workouts. Every
 * number is derived from the raw log on render (memoised), so history edits
 * show up everywhere at once.
 */
export default function ProgressScreen() {
  const t = useT();
  const locale = useLocale();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useFocusNow();
  const [period, setPeriod] = useState<PeriodKind>('month');

  const history = useWorkoutStore((state) => state.history);
  const weekStart = useWorkoutStore((state) => state.settings.weekStart);
  const exerciseMap = useExerciseMap();
  const bodyEntries = useProgressStore((state) => state.bodyEntries);
  const goals = useProgressStore((state) => state.goals);
  const markGoalsAchieved = useProgressStore((state) => state.markGoalsAchieved);

  const completed = useMemo(() => history.filter(isCompleted), [history]);
  const comparison = useMemo(() => compareTotals(completed, comparisonRanges(period, now, weekStart)), [completed, period, now, weekStart]);
  const weekly = useMemo(() => weeklySeries(completed, TREND_WEEKS, now, weekStart), [completed, now, weekStart]);
  const volumeTrend = useMemo(() => trendOf(weekly.slice(0, -1).map((p) => p.volumeKg)), [weekly]);
  const muscles = useMemo(
    () => muscleSetDistribution(completed, periodRange(period, now, weekStart), exerciseMap).slice(0, 8),
    [completed, period, now, weekStart, exerciseMap],
  );
  const byDay = useMemo(() => sessionsByDay(completed), [completed]);
  const month = useMemo(() => monthGrid(now.getFullYear(), now.getMonth(), weekStart, byDay), [now, weekStart, byDay]);
  const streak = useMemo(() => weeklyStreak(completed, now, weekStart), [completed, now, weekStart]);
  const exercises = useMemo(() => trainedExercises(completed).slice(0, PREVIEW_ROWS), [completed]);
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.archived), [goals]);
  const evaluations = useMemo(
    () => activeGoals.map((goal) => evaluateGoal(goal, { history: completed, bodyEntries, now, weekStart })),
    [activeGoals, completed, bodyEntries, now, weekStart],
  );
  const bodyweight = useMemo(() => latestEntry(bodyEntries, 'bodyweight'), [bodyEntries]);
  const bodyChange = useMemo(() => changeOver(bodyEntries, 'bodyweight', 30, now), [bodyEntries, now]);

  useEffect(() => {
    const ids = newlyAchievedGoalIds(evaluations);
    if (ids.length > 0) markGoalsAchieved(ids, new Date().toISOString());
  }, [evaluations, markGoalsAchieved]);

  const maxMuscleSets = Math.max(1, ...muscles.map((m) => m.sets));
  const avgSessions = average(weekly.slice(0, -1).map((p) => p.sessions));
  const nothingYet = completed.length === 0 && bodyEntries.length === 0 && goals.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.largeTitle} accessibilityRole="header">
          {t('progress.title')}
        </Text>

        {nothingYet ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <ChartColumn size={28} color={theme.colors.tint} />
            </View>
            <Text style={styles.emptyTitle}>{t('progress.emptyTitle')}</Text>
            <Text style={styles.secondary}>{t('progress.emptyBody')}</Text>
            <Button label={t('history.goToToday')} onPress={() => router.navigate('/')} style={styles.emptyButton} />
            <Button label={t('progress.body.log')} variant="secondary" icon={Scale} onPress={() => router.push('/analytics/body')} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {PERIOD_KINDS.map((kind) => (
                <SelectChip key={kind} label={t(`progress.periods.${kind}`)} selected={period === kind} onPress={() => setPeriod(kind)} />
              ))}
            </ScrollView>

            <View>
              <View style={styles.tiles}>
                <StatTile label={t('progress.tiles.sessions')} value={String(comparison.sessions.current)} change={comparison.sessions} />
                <StatTile label={t('progress.tiles.volume')} value={formatKgCompact(comparison.volumeKg.current)} change={comparison.volumeKg} />
                <StatTile label={t('progress.tiles.sets')} value={String(comparison.workingSets.current)} change={comparison.workingSets} />
                <StatTile label={t('progress.tiles.activeTime')} value={formatHoursMinutes(comparison.activeSeconds.current, t)} change={comparison.activeSeconds} />
              </View>
              <Text style={[styles.caption, styles.compareNote]}>{t(`progress.compare.${period}`)}</Text>
            </View>

            {completed.length > 0 ? (
              <>
                <Card title={t('progress.weeklyVolume')}>
                  <Text style={styles.caption}>{t(`progress.trend.${volumeTrend.direction}`)}</Text>
                  <BarChart
                    values={weekly.map((p) => p.volumeKg)}
                    labels={weekly.map((p) => p.weekStart)}
                    formatValue={formatKg}
                    formatLabel={(date) => t('history.weekOf', { date: formatDayMonth(date) })}
                    formatTick={(date) => `${date.getDate()}/${date.getMonth() + 1}`}
                  />
                </Card>

                <Card title={t('progress.frequency')}>
                  <Text style={styles.caption}>{t('progress.avgPerWeek', { value: formatNumber(avgSessions) })}</Text>
                  <BarChart
                    values={weekly.map((p) => p.sessions)}
                    labels={weekly.map((p) => p.weekStart)}
                    formatValue={(value) => t('progress.workoutsCount', { count: value })}
                    formatLabel={(date) => t('history.weekOf', { date: formatDayMonth(date) })}
                    formatTick={(date) => `${date.getDate()}/${date.getMonth() + 1}`}
                    height={80}
                  />
                </Card>

                <Card title={t('progress.muscles.title')}>
                  <Text style={styles.caption}>{t('progress.muscles.hint')}</Text>
                  {muscles.length === 0 ? (
                    <Text style={styles.secondary}>{t('progress.muscles.none')}</Text>
                  ) : (
                    muscles.map((share) => (
                      <View key={share.muscle} style={styles.muscleRow} accessible accessibilityLabel={`${share.muscle === 'other' ? t('progress.muscles.other') : MUSCLE_LABELS[share.muscle][locale]}: ${formatNumber(share.sets)}`}>
                        <Text style={styles.muscleName} numberOfLines={1}>
                          {share.muscle === 'other' ? t('progress.muscles.other') : MUSCLE_LABELS[share.muscle][locale]}
                        </Text>
                        <View style={styles.flex}>
                          <ProgressBar value={share.sets / maxMuscleSets} />
                        </View>
                        <Text style={styles.muscleValue}>{formatNumber(share.sets)}</Text>
                      </View>
                    ))
                  )}
                </Card>

                <Card title={formatMonthYear(now)} action={t('progress.open')} onAction={() => router.push('/analytics/calendar')}>
                  <Text style={styles.caption}>{t('progress.calendar.streak', { count: streak })}</Text>
                  <MonthGrid weeks={month} compact today={now} />
                </Card>
              </>
            ) : null}

            <Card title={t('progress.goals.title')} action={t('progress.manage')} onAction={() => router.push('/analytics/goals')}>
              {evaluations.length === 0 ? (
                <View style={styles.inlineEmpty}>
                  <Target size={20} color={theme.colors.labelSecondary} />
                  <Text style={[styles.secondary, styles.flex]}>{t('progress.goals.empty')}</Text>
                </View>
              ) : (
                evaluations.slice(0, 3).map((evaluation) => (
                  <View key={evaluation.goal.id} style={styles.goal}>
                    <View style={styles.goalHeader}>
                      <Text style={[styles.goalTitle, styles.flex]} numberOfLines={1}>
                        {goalTitle(evaluation.goal, t, exerciseMap)}
                      </Text>
                      <Text style={styles.caption}>{goalValueText(evaluation, t)}</Text>
                    </View>
                    <ProgressBar value={evaluation.progress} tone={evaluation.achieved ? 'success' : 'tint'} />
                  </View>
                ))
              )}
            </Card>

            <Card title={t('progress.body.title')} action={t('progress.open')} onAction={() => router.push('/analytics/body')}>
              {bodyweight ? (
                <View style={styles.bodyRow}>
                  <Text style={styles.bodyValue}>{t('progress.units.kgValue', { value: formatNumber(bodyweight.value) })}</Text>
                  <Text style={styles.caption}>
                    {bodyChange ? t('progress.body.change30', { diff: formatSigned(bodyChange.diff) }) : formatShortDateLatin(bodyweight.measuredAt)}
                  </Text>
                </View>
              ) : (
                <View style={styles.inlineEmpty}>
                  <Scale size={20} color={theme.colors.labelSecondary} />
                  <Text style={[styles.secondary, styles.flex]}>{t('progress.body.empty')}</Text>
                </View>
              )}
            </Card>

            {exercises.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title={t('progress.exercises.title')} action={t('progress.seeAll')} onAction={() => router.push('/analytics/exercises')} />
                <Group>
                  {exercises.map((item, index) => (
                    <ListRow
                      key={item.exerciseId}
                      title={localName(exerciseMap.get(item.exerciseId)?.name, locale, item.exerciseId)}
                      subtitle={t('progress.exercises.rowMeta', { count: item.sessions, date: formatDayMonth(item.lastPerformedAt) })}
                      value={formatKg(item.bestE1rmKg)}
                      isLast={index === exercises.length - 1}
                      onPress={() => router.push({ pathname: '/analytics/exercise/[id]', params: { id: item.exerciseId } })}
                    />
                  ))}
                </Group>
                <Text style={styles.caption}>{t('progress.exercises.e1rmNote')}</Text>
              </View>
            ) : null}

            {completed.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title={t('progress.recent')} action={t('progress.seeAll')} onAction={() => router.push('/analytics/history')} />
                <Group>
                  {completed.slice(0, PREVIEW_ROWS).map((session, index, list) => (
                    <ListRow
                      key={session.id}
                      leading={<CodeBadge code={session.code} />}
                      title={session.code}
                      subtitle={formatShortDateLatin(session.startedAt)}
                      value={formatKg(sessionStats(session).volumeKg)}
                      starred={(session.summary?.personalRecords.length ?? 0) > 0}
                      isLast={index === list.length - 1}
                      onPress={() => router.push({ pathname: '/analytics/session/[id]', params: { id: session.id } })}
                    />
                  ))}
                </Group>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.link} onPress={onAction} accessibilityRole="button" suppressHighlighting>
        {action}
      </Text>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.xxxl * 2,
      gap: t.spacing.lg,
    },
    largeTitle: {
      ...t.typography.largeTitle,
      color: t.colors.label,
    },
    chips: {
      gap: t.spacing.sm,
    },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    compareNote: {
      marginTop: t.spacing.xs,
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    muscleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: 28,
    },
    muscleName: {
      width: 104,
      ...t.typography.subheadline,
      color: t.colors.label,
    },
    muscleValue: {
      width: 36,
      textAlign: 'right',
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    inlineEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    goal: {
      gap: t.spacing.xs,
      paddingVertical: t.spacing.xs,
    },
    goalHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: t.spacing.sm,
    },
    goalTitle: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.label,
    },
    bodyRow: {
      gap: 2,
    },
    bodyValue: {
      fontFamily: t.fonts.display,
      fontSize: 36,
      lineHeight: 40,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    section: {
      gap: t.spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      ...t.typography.title3,
      color: t.colors.label,
    },
    link: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.link,
      paddingVertical: t.spacing.xs,
    },
    empty: {
      padding: t.spacing.xl,
      gap: t.spacing.sm,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.xs,
    },
    emptyTitle: {
      ...t.typography.title1,
      color: t.colors.label,
    },
    emptyButton: {
      marginTop: t.spacing.md,
    },
  }),
);
