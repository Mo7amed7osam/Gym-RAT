import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthGrid } from '@/components/progress/MonthGrid';
import { Card, CodeBadge, Group, ListRow, ScreenHeader, StatTile } from '@/components/progress/parts';
import { HIT } from '@/constants/theme';
import { isCompleted, sessionStats, totalsFor } from '@/domain/analytics/aggregate';
import { monthGrid, sessionsByDay, weeklyStreak, type CalendarDay } from '@/domain/analytics/calendar';
import { dayKey } from '@/domain/analytics/dates';
import { useT } from '@/i18n';
import { formatHoursMinutes, formatMonthYear } from '@/lib/analyticsFormat';
import { formatKg, formatKgCompact, formatLongDate, formatTime } from '@/lib/format';
import { useFocusNow } from '@/lib/useFocusNow';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

/** Month calendar of actual training dates (rotation-independent), with the day's workouts below. */
export default function CalendarScreen() {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useFocusNow();
  const history = useWorkoutStore((state) => state.history);
  const weekStart = useWorkoutStore((state) => state.settings.weekStart);
  const [offset, setOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(() => dayKey(new Date()));

  const visible = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = visible.getFullYear();
  const month = visible.getMonth();
  const completed = useMemo(() => history.filter(isCompleted), [history]);
  const byDay = useMemo(() => sessionsByDay(completed), [completed]);
  const weeks = useMemo(() => monthGrid(year, month, weekStart, byDay), [year, month, weekStart, byDay]);
  const monthTotals = useMemo(
    () => totalsFor(completed, { start: new Date(year, month, 1).getTime(), end: new Date(year, month + 1, 1).getTime() }),
    [completed, year, month],
  );
  const streak = useMemo(() => weeklyStreak(completed, now, weekStart), [completed, now, weekStart]);
  const selected = selectedKey ? (byDay.get(selectedKey) ?? []) : [];
  const selectedDate = useMemo(() => {
    if (!selectedKey) return null;
    const [y, m, d] = selectedKey.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedKey]);

  const Prev = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const Next = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('progress.calendar.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />

        <Card>
          <View style={styles.monthBar}>
            <Pressable onPress={() => setOffset(offset - 1)} accessibilityRole="button" accessibilityLabel={t('progress.calendar.previousMonth')} style={styles.navButton}>
              <Prev size={22} color={theme.colors.tint} />
            </Pressable>
            <Text style={styles.monthTitle} accessibilityRole="header">
              {formatMonthYear(visible)}
            </Text>
            <Pressable
              onPress={() => setOffset(offset + 1)}
              disabled={offset >= 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: offset >= 0 }}
              accessibilityLabel={t('progress.calendar.nextMonth')}
              style={[styles.navButton, offset >= 0 && styles.disabled]}
            >
              <Next size={22} color={theme.colors.tint} />
            </Pressable>
          </View>
          <MonthGrid weeks={weeks} today={now} selectedKey={selectedKey} onSelect={(day: CalendarDay) => setSelectedKey(day.key)} />
        </Card>

        <View style={styles.tiles}>
          <StatTile label={t('progress.tiles.sessions')} value={String(monthTotals.sessions)} />
          <StatTile label={t('progress.tiles.trainingDays')} value={String(monthTotals.trainingDays)} />
          <StatTile label={t('progress.tiles.volume')} value={formatKgCompact(monthTotals.volumeKg)} />
          <StatTile label={t('progress.calendar.streakTile')} value={t('progress.calendar.weeksValue', { count: streak })} />
        </View>

        {selectedDate ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {formatLongDate(selectedDate)}
            </Text>
            {selected.length === 0 ? (
              <Text style={styles.secondary}>{t('progress.calendar.restDay')}</Text>
            ) : (
              <Group>
                {selected.map((session, index) => (
                  <ListRow
                    key={session.id}
                    leading={<CodeBadge code={session.code} />}
                    title={session.code}
                    subtitle={`${formatTime(session.startedAt)}${session.summary ? ` · ${formatHoursMinutes(session.summary.durationSeconds)}` : ''}`}
                    value={formatKg(sessionStats(session).volumeKg)}
                    isLast={index === selected.length - 1}
                    onPress={() => router.push({ pathname: '/analytics/session/[id]', params: { id: session.id } })}
                  />
                ))}
              </Group>
            )}
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
      gap: t.spacing.lg,
    },
    monthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: t.spacing.xs,
    },
    monthTitle: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    navButton: {
      minWidth: HIT,
      minHeight: HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      opacity: 0.3,
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
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
  }),
);
