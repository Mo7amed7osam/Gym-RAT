import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow, ScreenHeader } from '@/components/progress/parts';
import { HIT } from '@/constants/theme';
import { isCompleted } from '@/domain/analytics/aggregate';
import { trainedExercises } from '@/domain/analytics/progression';
import { useT } from '@/i18n';
import { formatDayMonth } from '@/lib/analyticsFormat';
import { formatKg } from '@/lib/format';
import { useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

/** Every exercise you have logged, most recent first; tap for its progression chart. */
export default function ExercisesScreen() {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const history = useWorkoutStore((state) => state.history);
  const exerciseMap = useExerciseMap();
  const [query, setQuery] = useState('');

  const all = useMemo(() => trainedExercises(history.filter(isCompleted)), [history]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => {
      const name = exerciseMap.get(item.exerciseId)?.name;
      return (name?.en ?? item.exerciseId).toLowerCase().includes(q) || (name?.ar ?? '').includes(query.trim());
    });
  }, [all, query, exerciseMap]);

  return (
    <View style={styles.root}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.exerciseId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title={t('progress.exercises.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('progress.exercises.search')}
              placeholderTextColor={theme.colors.labelTertiary}
              style={styles.search}
              accessibilityLabel={t('progress.exercises.search')}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            <Text style={styles.caption}>{t('progress.exercises.e1rmNote')}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('progress.exercises.empty')}</Text>}
        renderItem={({ item, index }) => {
          const name = exerciseMap.get(item.exerciseId)?.name;
          return (
            <View style={[styles.item, index === 0 && styles.first, index === list.length - 1 && styles.last]}>
              <ListRow
                title={name?.en ?? item.exerciseId}
                subtitle={t('progress.exercises.rowMeta', { count: item.sessions, date: formatDayMonth(item.lastPerformedAt) })}
                value={formatKg(item.bestE1rmKg)}
                isLast={index === list.length - 1}
                onPress={() => router.push({ pathname: '/analytics/exercise/[id]', params: { id: item.exerciseId } })}
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
    header: {
      gap: t.spacing.sm,
      marginBottom: t.spacing.md,
    },
    search: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      color: t.colors.label,
      fontSize: 17,
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
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
    },
  }),
);
