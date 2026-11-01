import { Check, Minus, SkipForward, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { exerciseOutcome } from '@/domain/session/reducer';
import { useT } from '@/i18n';
import { formatTime } from '@/lib/format';
import { useExerciseMap, useWorkoutStore, type FinishMode } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { WorkoutSession } from '@/types/workout';

interface WorkoutReviewModalProps {
  session: WorkoutSession | null;
  onCancel: () => void;
  onFinish: (mode: FinishMode) => void;
}

/**
 * Review step before the session is committed (P2.4): outcome per exercise,
 * session notes, end-time correction, then finish-and-advance or finish-and-repeat.
 */
export function WorkoutReviewModal({ session, onCancel, onFinish }: WorkoutReviewModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <Modal visible={session !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>{session ? <ReviewContent key={session.id} session={session} onCancel={onCancel} onFinish={onFinish} /> : null}</View>
    </Modal>
  );
}

function ReviewContent({ session, onCancel, onFinish }: { session: WorkoutSession; onCancel: () => void; onFinish: (mode: FinishMode) => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const exercises = useExerciseMap();
  const setSessionNotes = useWorkoutStore((state) => state.setSessionNotes);
  const setEndedAtOverride = useWorkoutStore((state) => state.setEndedAtOverride);
  const [notes, setNotes] = useState(session.notes);
  // The "−N min" chips are relative to when the review opened; a clock read during render is impure.
  const [openedAt] = useState(() => Date.now());
  const outcome = exerciseOutcome(session);
  const endMinutesAgo = session.endedAtOverride ? Math.round((openedAt - Date.parse(session.endedAtOverride)) / 60_000) : 0;
  const setEnd = (minutesAgo: number) => setEndedAtOverride(minutesAgo === 0 ? null : new Date(openedAt - minutesAgo * 60_000).toISOString());
  const commitNotes = () => {
    if (notes !== session.notes) setSessionNotes(notes);
  };
  const finish = (mode: FinishMode) => {
    commitNotes();
    onFinish(mode);
  };

  return (
    <>
      <View style={styles.toolbar}>
        <Text style={styles.title} accessibilityRole="header">
          {t('workout.reviewTitle')}
        </Text>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('workout.keepGoing')} hitSlop={8} style={styles.closeButton}>
          <X size={18} color={theme.colors.labelSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.summary}>{t('workout.reviewDone', { done: outcome.completed.length, skipped: outcome.skipped.length, untouched: outcome.untouched.length })}</Text>
        <View style={styles.card}>
          {session.exercises.map((exercise, index) => {
            const done = exercise.sets.filter((set) => set.completed).length;
            const Icon = exercise.skipped ? SkipForward : done > 0 ? Check : Minus;
            const color = exercise.skipped ? theme.colors.labelTertiary : done > 0 ? theme.colors.success : theme.colors.labelTertiary;
            return (
              <View key={exercise.id} style={[styles.row, index < session.exercises.length - 1 && styles.divider]}>
                <Icon size={18} color={color} strokeWidth={2.5} />
                <Text style={[styles.rowName, styles.flex]} numberOfLines={1}>
                  {exercises.get(exercise.exerciseId)?.name.en ?? exercise.exerciseId}
                </Text>
                <Text style={styles.rowMeta}>
                  {done}/{exercise.sets.length}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.label}>{t('workout.reviewNotes')}</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={commitNotes}
          multiline
          placeholder={t('workout.reviewNotesPlaceholder')}
          placeholderTextColor={theme.colors.labelTertiary}
          accessibilityLabel={t('workout.reviewNotes')}
          style={styles.notes}
        />

        <Text style={styles.label}>
          {t('workout.reviewEnd')} · {formatTime(session.endedAtOverride ?? new Date(openedAt).toISOString())}
        </Text>
        <View style={styles.chips}>
          <SelectChip label={t('workout.reviewEndNow')} selected={endMinutesAgo === 0} onPress={() => setEnd(0)} />
          <SelectChip label={t('workout.minus5')} selected={endMinutesAgo === 5} onPress={() => setEnd(5)} />
          <SelectChip label={t('workout.minus15')} selected={endMinutesAgo === 15} onPress={() => setEnd(15)} />
          <SelectChip label={t('workout.minus30')} selected={endMinutesAgo === 30} onPress={() => setEnd(30)} />
        </View>
      </ScrollView>
      <View style={styles.actions}>
        {session.kind === 'plan' ? (
          <>
            <Button label={t('workout.finishAdvance')} onPress={() => finish('advance')} />
            <Button label={t('workout.finishRepeat')} variant="secondary" onPress={() => finish('repeat')} />
          </>
        ) : (
          <Button label={t('workout.finishTemplate')} onPress={() => finish('advance')} />
        )}
      </View>
    </>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1, minWidth: 0 },
    toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.lg, paddingBottom: t.spacing.sm, gap: t.spacing.sm },
    title: { ...t.typography.title3, color: t.colors.label, flex: 1 },
    closeButton: { width: HIT, height: HIT, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: t.spacing.screen, gap: t.spacing.md, paddingBottom: t.spacing.xl },
    summary: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    card: { borderRadius: t.radii.card, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.edge, paddingHorizontal: t.spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: HIT, paddingVertical: t.spacing.xs },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    rowName: { ...t.typography.body, color: t.colors.label },
    rowMeta: { ...t.typography.mono, color: t.colors.labelSecondary },
    label: { ...t.typography.footnote, color: t.colors.labelSecondary },
    notes: {
      ...t.typography.body,
      color: t.colors.label,
      minHeight: 80,
      padding: t.spacing.lg,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
      textAlignVertical: 'top',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    actions: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.sm, gap: t.spacing.sm },
  }),
);
