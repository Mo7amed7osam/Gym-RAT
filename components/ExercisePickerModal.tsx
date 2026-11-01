import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { HIT } from '@/constants/theme';
import { MUSCLE_LABELS } from '@/data/exercisesData';
import { useLocale, useT } from '@/i18n';
import { selectLibrary, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { Exercise } from '@/types/workout';

interface ExercisePickerModalProps {
  visible: boolean;
  title: string;
  /** Ids to leave out (already on the day). */
  excludeIds?: readonly string[];
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}

/** Searchable picker over the non-archived library, used by the plan builder and the session engine. */
export function ExercisePickerModal({ visible, title, excludeIds = [], onPick, onClose }: ExercisePickerModalProps) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const library = useWorkoutStore(selectLibrary);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library
      .filter((exercise) => !excludeIds.includes(exercise.id))
      .filter(
        (exercise) =>
          !q ||
          exercise.name.en.toLowerCase().includes(q) ||
          exercise.name.ar.includes(query.trim()) ||
          exercise.primaryMuscles.some((m) => MUSCLE_LABELS[m].en.toLowerCase().includes(q)),
      );
  }, [library, excludeIds, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('library.detail.close')} hitSlop={8} style={styles.closeButton}>
            <X size={20} color={theme.colors.labelSecondary} strokeWidth={2.5} />
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
            autoFocus
            accessibilityLabel={t('library.search')}
            style={styles.searchInput}
          />
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
          ListEmptyComponent={<Text style={styles.empty}>{t('library.empty')}</Text>}
          renderItem={({ item }) => <Row exercise={item} locale={locale} onPress={() => onPick(item.id)} />}
        />
      </View>
    </Modal>
  );
}

function Row({ exercise, locale, onPress }: { exercise: Exercise; locale: 'en' | 'ar'; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={exercise.name.en} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ExerciseThumb exerciseId={exercise.id} size={48} />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={2}>
          {exercise.name.en}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m][locale]).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1, minWidth: 0 },
    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.lg, paddingBottom: t.spacing.md },
    toolbarTitle: { ...t.typography.headline, color: t.colors.label },
    closeButton: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceRaised },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: HIT,
      marginHorizontal: t.spacing.screen,
      marginBottom: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
    },
    searchInput: { ...t.typography.body, flex: 1, color: t.colors.label, paddingVertical: 0 },
    content: { paddingHorizontal: t.spacing.screen },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 64, paddingVertical: t.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    pressed: { opacity: 0.6 },
    name: { ...t.typography.headline, color: t.colors.label },
    secondary: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary },
    empty: { ...t.typography.body, color: t.colors.labelSecondary, textAlign: 'center', paddingVertical: t.spacing.xxxl },
  }),
);
