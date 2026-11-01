import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CodeBadge, ListRow, ScreenHeader } from '@/components/progress/parts';
import { isCompleted, sessionStats } from '@/domain/analytics/aggregate';
import { useT } from '@/i18n';
import { formatHoursMinutes, formatMonthYear, formatShortDateLatin } from '@/lib/analyticsFormat';
import { formatKg } from '@/lib/format';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { WorkoutSession } from '@/types/workout';

/** Every finished workout, grouped by month, newest first. */
export default function HistoryListScreen() {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const history = useWorkoutStore((state) => state.history);

  const sections = useMemo(() => {
    const groups: { key: string; title: string; data: WorkoutSession[] }[] = [];
    for (const session of history) {
      if (!isCompleted(session)) continue;
      const date = new Date(session.startedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const last = groups[groups.length - 1];
      if (last?.key === key) last.data.push(session);
      else groups.push({ key, title: formatMonthYear(date), data: [session] });
    }
    return groups;
  }, [history]);

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<ScreenHeader title={t('progress.history.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />}
        ListEmptyComponent={<Text style={styles.empty}>{t('history.emptyBody')}</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title} · {t('progress.workoutsCount', { count: section.data.length })}
          </Text>
        )}
        renderItem={({ item, index, section }) => {
          const stats = sessionStats(item);
          const duration = item.summary ? formatHoursMinutes(item.summary.durationSeconds, t) : '';
          return (
            <View style={[styles.item, index === 0 && styles.first, index === section.data.length - 1 && styles.last]}>
              <ListRow
                leading={<CodeBadge code={item.code} />}
                title={item.code}
                subtitle={[formatShortDateLatin(item.startedAt), duration, t('progress.history.setsCount', { count: stats.workingSets })].filter(Boolean).join(' · ')}
                value={formatKg(stats.volumeKg)}
                starred={(item.summary?.personalRecords.length ?? 0) > 0}
                isLast={index === section.data.length - 1}
                onPress={() => router.push({ pathname: '/analytics/session/[id]', params: { id: item.id } })}
              />
            </View>
          );
        }}
      />
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
    },
    sectionTitle: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.labelSecondary,
      marginTop: t.spacing.xl,
      marginBottom: t.spacing.sm,
    },
    item: {
      backgroundColor: t.colors.surface,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    first: {
      borderTopLeftRadius: t.radii.sheet,
      borderTopRightRadius: t.radii.sheet,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    last: {
      borderBottomLeftRadius: t.radii.sheet,
      borderBottomRightRadius: t.radii.sheet,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    empty: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      marginTop: t.spacing.xl,
    },
  }),
);
