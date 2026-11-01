import { ChevronRight, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoModal } from '@/components/VideoModal';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { HIT } from '@/constants/theme';
import { EXERCISE_LIST, MUSCLE_LABELS } from '@/data/exercisesData';
import { useLocale, useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';
import type { Exercise } from '@/types/workout';

/**
 * Library tab (Phase 1 shell): searchable catalogue of the built-in exercises.
 * Illustrations, custom exercises and the full detail screen land in Phase 2.
 */
export default function LibraryScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const exercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...EXERCISE_LIST].sort((a, b) => a.name.en.localeCompare(b.name.en));
    if (!q) return sorted;
    return sorted.filter(
      (exercise) =>
        exercise.name.en.toLowerCase().includes(q) ||
        exercise.name.ar.includes(query.trim()) ||
        [...exercise.primaryMuscles, ...exercise.secondaryMuscles].some((m) => MUSCLE_LABELS[m].en.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <View style={styles.root}>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.largeTitle} accessibilityRole="header">
              {t('library.title')}
            </Text>
            <View style={styles.search}>
              <Search size={18} color={theme.colors.labelSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('library.search')}
                placeholderTextColor={theme.colors.labelTertiary}
                autoCorrect={false}
                clearButtonMode="while-editing"
                accessibilityLabel={t('library.search')}
                style={styles.searchInput}
              />
            </View>
            <Text style={styles.count}>{t('library.count', { count: exercises.length })}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('library.empty')}</Text>}
        ListFooterComponent={<Text style={styles.footnote}>{t('library.customSoon')}</Text>}
        renderItem={({ item }) => <ExerciseRow exercise={item} onPress={() => setOpenId(item.id)} />}
      />
      <VideoModal exerciseId={openId} onClose={() => setOpenId(null)} />
    </View>
  );
}

function ExerciseRow({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const locale = useLocale();
  const muscles = exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m][locale]).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name.en}, ${muscles}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ExerciseThumb exerciseId={exercise.id} />
      <View style={styles.flex}>
        <Text style={styles.headline} numberOfLines={2}>
          {exercise.name.en}
        </Text>
        <Text style={styles.arabic} accessibilityLanguage="ar">
          {exercise.name.ar}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {muscles}
        </Text>
      </View>
      <ChevronRight size={18} color={theme.colors.labelTertiary} />
    </Pressable>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.screen, paddingBottom: t.spacing.xxxl * 2 },
    header: { gap: t.spacing.md, marginBottom: t.spacing.md },
    flex: { flex: 1, minWidth: 0 },
    largeTitle: { ...t.typography.largeTitle, color: t.colors.label },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
    },
    searchInput: { ...t.typography.body, flex: 1, color: t.colors.label, paddingVertical: 0 },
    count: { ...t.typography.footnote, color: t.colors.labelSecondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 76,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    headline: { ...t.typography.headline, color: t.colors.label },
    arabic: { ...t.typography.arabic, fontSize: 13, lineHeight: 18, color: t.colors.labelSecondary, textAlign: 'left', alignSelf: 'flex-start' },
    secondary: { ...t.typography.caption, color: t.colors.labelSecondary },
    empty: { ...t.typography.subheadline, color: t.colors.labelSecondary, paddingVertical: t.spacing.xl },
    footnote: { ...t.typography.caption, color: t.colors.labelTertiary, paddingVertical: t.spacing.xl },
    pressed: { opacity: 0.7 },
  }),
);
