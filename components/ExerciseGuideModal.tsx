import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDetail } from '@/components/ExerciseDetail';
import { HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { useExercise } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

interface ExerciseGuideModalProps {
  /** Exercise to show; null hides the sheet. */
  exerciseId: string | null;
  onClose: () => void;
}

/** In-workout guide sheet: the Library detail for an exercise, without leaving the session. */
export function ExerciseGuideModal({ exerciseId, onClose }: ExerciseGuideModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();

  return (
    <Modal visible={exerciseId !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>{t('exercise.guide')}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('library.detail.close')} hitSlop={8} style={styles.closeButton}>
            <X size={20} color={theme.colors.labelSecondary} strokeWidth={2.5} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]} keyboardShouldPersistTaps="handled">
          {/* Keyed so the sheet resets to the requested exercise each time it opens; alternatives navigate inside it. */}
          {exerciseId ? <GuideContent key={exerciseId} initialId={exerciseId} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function GuideContent({ initialId }: { initialId: string }) {
  const [currentId, setCurrentId] = useState(initialId);
  const exercise = useExercise(currentId);
  return exercise ? <ExerciseDetail exercise={exercise} onOpenExercise={setCurrentId} /> : null;
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.screen,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.md,
    },
    toolbarTitle: { ...t.typography.headline, color: t.colors.label },
    closeButton: {
      width: HIT,
      height: HIT,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
    },
    content: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.sm },
  }),
);
