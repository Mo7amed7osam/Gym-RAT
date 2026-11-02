import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineChart } from '@/components/charts/LineChart';
import { Card, Group, ListRow, ScreenHeader, StatTile } from '@/components/progress/parts';
import { SelectChip } from '@/components/ui/SelectChip';
import { isCompleted } from '@/domain/analytics/aggregate';
import { addDays } from '@/domain/analytics/dates';
import { PROGRESSION_METRICS, exerciseProgression, metricValue, type ProgressionMetric } from '@/domain/analytics/progression';
import { trendOf } from '@/domain/analytics/trends';
import { useT } from '@/i18n';
import { formatDayMonth, formatDayMonthYear, formatNumber, formatSigned, ltr } from '@/lib/analyticsFormat';
import { formatKg } from '@/lib/format';
import { useFocusNow } from '@/lib/useFocusNow';
import { useExercise, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

type RangeKey = '3m' | '6m' | '1y' | 'all';
const RANGES: readonly RangeKey[] = ['3m', '6m', '1y', 'all'];
const RANGE_DAYS: Record<RangeKey, number | null> = { '3m': 91, '6m': 182, '1y': 365, all: null };

/** Progression of one exercise over time: e1RM, top weight, volume or reps per session. */
export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useFocusNow();
  const exercise = useExercise(id);
  const history = useWorkoutStore((state) => state.history);
  const [metric, setMetric] = useState<ProgressionMetric>('e1rm');
  const [range, setRange] = useState<RangeKey>('6m');

  const all = useMemo(() => exerciseProgression(history.filter(isCompleted), id ?? ''), [history, id]);
  const points = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null) return all;
    const from = addDays(now, -days).getTime();
    return all.filter((point) => point.at >= from);
  }, [all, range, now]);

  const values = points.map((point) => metricValue(point, metric));
  const isKg = metric !== 'reps';
  const format = (value: number) => (isKg ? formatKg(value) : t('progress.exercise.repsValue', { value: formatNumber(value, 0) }));
  const best = values.length > 0 ? Math.max(...values) : 0;
  const latest = values[values.length - 1] ?? 0;
  const change = values.length > 1 ? latest - values[0] : null;
  const trend = trendOf(values);
  const name = exercise?.name.en ?? id ?? '';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={name} onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />
        {exercise && exercise.name.ar && exercise.name.ar !== exercise.name.en ? <Text style={styles.subtitle}>{exercise.name.ar}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PROGRESSION_METRICS.map((key) => (
            <SelectChip key={key} label={t(`progress.exercise.metrics.${key}`)} selected={metric === key} onPress={() => setMetric(key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {RANGES.map((key) => (
            <SelectChip key={key} label={t(`progress.exercise.ranges.${key}`)} selected={range === key} onPress={() => setRange(key)} />
          ))}
        </ScrollView>

        <Card>
          {points.length === 0 ? (
            <Text style={styles.secondary}>{all.length === 0 ? t('progress.exercise.empty') : t('progress.exercise.emptyRange')}</Text>
          ) : (
            <LineChart
              points={points.map((point, i) => ({ x: point.at, y: values[i] }))}
              formatY={format}
              formatX={(x) => formatDayMonthYear(x)}
              accessibilityLabel={t('progress.exercise.chartA11y', {
                metric: t(`progress.exercise.metrics.${metric}`),
                count: points.length,
                first: format(values[0]),
                last: format(latest),
              })}
            />
          )}
          {metric === 'e1rm' ? <Text style={styles.caption}>{t('progress.exercises.e1rmNote')}</Text> : null}
        </Card>

        {points.length > 0 ? (
          <View style={styles.tiles}>
            <StatTile label={t('progress.exercise.best')} value={format(best)} />
            <StatTile label={t('progress.exercise.latest')} value={format(latest)} />
            <StatTile label={t('progress.exercise.change')} value={change === null ? '—' : `${formatSigned(change)}${isKg ? ` ${t('common.kg')}` : ''}`} />
            <StatTile label={t('progress.exercise.trend')} value={t(`progress.trend.${trend.direction}`)} />
          </View>
        ) : null}

        {points.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('progress.exercise.sessions')}
            </Text>
            <Group>
              {[...points].reverse().map((point, index, list) => (
                <ListRow
                  key={point.sessionId}
                  title={formatDayMonth(point.at)}
                  subtitle={t('progress.exercise.sessionMeta', {
                    count: point.workingSets,
                    best: point.bestSet ? ltr(`${formatNumber(point.bestSet.weightKg)} × ${point.bestSet.reps}`) : '—',
                  })}
                  value={format(metricValue(point, metric))}
                  isLast={index === list.length - 1}
                  onPress={() => router.push({ pathname: '/analytics/session/[id]', params: { id: point.sessionId } })}
                />
              ))}
            </Group>
          </View>
        ) : null}
      </ScrollView>
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
      gap: t.spacing.md,
    },
    subtitle: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    chips: {
      gap: t.spacing.sm,
    },
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    section: {
      gap: t.spacing.sm,
    },
    sectionTitle: {
      ...t.typography.title3,
      color: t.colors.label,
    },
  }),
);
