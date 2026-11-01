import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS } from '@/data/exercisesData';
import { useLocale, useT } from '@/i18n';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { Equipment, Exercise, MuscleGroup } from '@/types/workout';

type Scope = 'all' | 'custom' | 'archived';
const EQUIPMENT_FILTERS: Equipment[] = ['barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band'];

/** Pure filter so the screen test and the UI agree. */
export function filterLibrary(
  exercises: readonly Exercise[],
  filters: { query: string; muscle: MuscleGroup | null; equipment: Equipment | null; scope: Scope },
): Exercise[] {
  const q = filters.query.trim().toLowerCase();
  const raw = filters.query.trim();
  return [...exercises]
    .filter((exercise) => (filters.scope === 'archived' ? exercise.archived : !exercise.archived))
    .filter((exercise) => (filters.scope === 'custom' ? exercise.origin === 'custom' : true))
    .filter((exercise) => (filters.muscle ? exercise.primaryMuscles.includes(filters.muscle) || exercise.secondaryMuscles.includes(filters.muscle) : true))
    .filter((exercise) => (filters.equipment ? exercise.equipment.includes(filters.equipment) : true))
    .filter(
      (exercise) =>
        !q ||
        exercise.name.en.toLowerCase().includes(q) ||
        exercise.name.ar.includes(raw) ||
        [...exercise.primaryMuscles, ...exercise.secondaryMuscles].some((m) => MUSCLE_LABELS[m].en.toLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.en.localeCompare(b.name.en));
}

/** Library tab: searchable, filterable catalogue of built-in and custom exercises. */
export default function LibraryScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const exercises = useWorkoutStore((state) => state.exercises);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [scope, setScope] = useState<Scope>('all');

  const visible = useMemo(() => filterLibrary(exercises, { query, muscle, equipment, scope }), [exercises, query, muscle, equipment, scope]);
  const hasFilters = muscle !== null || equipment !== null || scope !== 'all';

  return (
    <View style={styles.root}>
      {/* The search box lives outside the list: a TextInput inside ListHeaderComponent loses focus on every keystroke when the data changes. */}
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.lg }]}>
        <View style={styles.titleRow}>
          <Text style={styles.largeTitle} accessibilityRole="header">
            {t('library.title')}
          </Text>
          <Pressable
            onPress={() => router.push('/exercise/edit')}
            accessibilityRole="button"
            accessibilityLabel={t('library.newExercise')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Plus size={22} color={theme.colors.onTint} strokeWidth={2.5} />
          </Pressable>
        </View>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} keyboardShouldPersistTaps="handled">
          {(['all', 'custom', 'archived'] as const).map((item) => (
            <SelectChip
              key={item}
              label={t(item === 'all' ? 'library.filterAll' : item === 'custom' ? 'library.filterCustom' : 'library.filterArchived')}
              selected={scope === item}
              onPress={() => setScope(item)}
            />
          ))}
          <View style={styles.filterGap} />
          {EQUIPMENT_FILTERS.map((item) => (
            <SelectChip key={item} label={EQUIPMENT_LABELS[item][locale]} selected={equipment === item} onPress={() => setEquipment(equipment === item ? null : item)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} keyboardShouldPersistTaps="handled">
          {MUSCLE_GROUPS.map((item) => (
            <SelectChip key={item} label={MUSCLE_LABELS[item][locale]} selected={muscle === item} onPress={() => setMuscle(muscle === item ? null : item)} />
          ))}
        </ScrollView>
        <View style={styles.countRow}>
          <Text style={styles.count}>{t('library.count', { count: visible.length })}</Text>
          {hasFilters ? (
            <Pressable
              onPress={() => {
                setMuscle(null);
                setEquipment(null);
                setScope('all');
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.clear}>{t('library.clearFilters')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('library.empty')}</Text>}
        renderItem={({ item }) => <ExerciseRow exercise={item} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })} />}
      />
    </View>
  );
}

function ExerciseRow({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const muscles = exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m][locale]).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name.en}, ${muscles}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ExerciseThumb exerciseId={exercise.id} size={56} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {exercise.name.en}
          </Text>
          {exercise.origin === 'custom' ? <Chip label={t('library.customBadge')} tone="link" /> : null}
        </View>
        {exercise.name.ar && exercise.name.ar !== exercise.name.en ? (
          <Text style={styles.arabic} accessibilityLanguage="ar" numberOfLines={1}>
            {exercise.name.ar}
          </Text>
        ) : null}
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
    header: { gap: t.spacing.md, paddingBottom: t.spacing.sm },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.screen },
    flex: { flex: 1, minWidth: 0 },
    largeTitle: { ...t.typography.largeTitle, color: t.colors.label },
    addButton: {
      width: HIT,
      height: HIT,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: HIT,
      marginHorizontal: t.spacing.screen,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
    },
    searchInput: { ...t.typography.body, flex: 1, color: t.colors.label, paddingVertical: 0 },
    filterRow: { paddingHorizontal: t.spacing.screen, gap: t.spacing.sm },
    filterGap: { width: t.spacing.sm },
    countRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: t.spacing.screen },
    count: { ...t.typography.footnote, color: t.colors.labelSecondary },
    clear: { ...t.typography.footnote, color: t.colors.link },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 76,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    pressed: { opacity: 0.6 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    name: { ...t.typography.headline, color: t.colors.label, flexShrink: 1 },
    arabic: { ...t.typography.arabic, color: t.colors.labelSecondary, textAlign: 'left' },
    secondary: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary },
    empty: { ...t.typography.body, color: t.colors.labelSecondary, textAlign: 'center', paddingVertical: t.spacing.xxxl },
  }),
);
