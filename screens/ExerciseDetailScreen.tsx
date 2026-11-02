import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDetail } from '@/components/ExerciseDetail';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HIT } from '@/constants/theme';
import { useT, useLocale } from '@/i18n';
import { useExercise, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import { localName } from '@/lib/exerciseName';

/** Library → exercise detail route (`/exercise/[id]`). */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const exercise = useExercise(id);
  const setExerciseArchived = useWorkoutStore((state) => state.setExerciseArchived);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/library'));
  const openExercise = (exerciseId: string) => router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('onboarding.back')} hitSlop={8} style={styles.iconButton}>
          <ChevronLeft size={24} color={theme.colors.label} />
        </Pressable>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {localName(exercise?.name, locale, '')}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]} keyboardShouldPersistTaps="handled">
        {exercise ? (
          <>
            <ExerciseDetail
              exercise={exercise}
              onOpenExercise={openExercise}
              onEdit={exercise.origin === 'custom' ? () => router.push({ pathname: '/exercise/edit', params: { id: exercise.id } }) : undefined}
            />
            {exercise.origin === 'custom' ? (
              <View style={styles.actions}>
                {exercise.archived ? (
                  <Button label={t('library.detail.unarchive')} variant="tinted" onPress={() => setExerciseArchived(exercise.id, false)} />
                ) : (
                  <Button label={t('library.detail.archive')} variant="secondary" onPress={() => setConfirmArchive(true)} />
                )}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.missing}>{t('library.empty')}</Text>
        )}
      </ScrollView>
      <ConfirmDialog
        visible={confirmArchive}
        title={t('library.detail.archiveTitle', { name: localName(exercise?.name, locale, '') })}
        message={t('library.detail.archiveMessage')}
        confirmLabel={t('library.detail.archiveConfirm')}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          setConfirmArchive(false);
          if (exercise) setExerciseArchived(exercise.id, true);
        }}
      />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      gap: t.spacing.sm,
    },
    toolbarTitle: { ...t.typography.headline, color: t.colors.label, flex: 1, textAlign: 'center' },
    iconButton: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.sm, gap: t.spacing.xl },
    actions: { gap: t.spacing.sm },
    missing: { ...t.typography.body, color: t.colors.labelSecondary, textAlign: 'center', paddingTop: t.spacing.xxxl },
  }),
);
