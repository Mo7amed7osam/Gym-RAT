import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { parseReps } from '@/lib/parseNumber';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { SessionExercise } from '@/types/workout';

const REST_CHOICES = [60, 90, 120, 150, 180] as const;

interface SessionTargetsSheetProps {
  exercise: SessionExercise | null;
  canSaveToPlan: boolean;
  onClose: () => void;
  onSavedToPlan: () => void;
}

/** Session-only edit of sets · reps · rest, with an explicit "save to plan" that writes back permanently. */
export function SessionTargetsSheet({ exercise, canSaveToPlan, onClose, onSavedToPlan }: SessionTargetsSheetProps) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={exercise !== null} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('library.detail.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          {exercise ? <TargetsForm key={exercise.id} exercise={exercise} canSaveToPlan={canSaveToPlan} onClose={onClose} onSavedToPlan={onSavedToPlan} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function TargetsForm({ exercise, canSaveToPlan, onClose, onSavedToPlan }: { exercise: SessionExercise; canSaveToPlan: boolean; onClose: () => void; onSavedToPlan: () => void }) {
  const styles = useStyles();
  const t = useT();
  const updateSessionPrescription = useWorkoutStore((state) => state.updateSessionPrescription);
  const saveTargetsToPlan = useWorkoutStore((state) => state.saveTargetsToPlan);
  const markRecommendationEdited = useWorkoutStore((state) => state.markRecommendationEdited);
  const { prescription } = exercise;
  const [sets, setSets] = useState(String(prescription.sets));
  const [min, setMin] = useState(String(prescription.reps.min));
  const [max, setMax] = useState(String(prescription.reps.max));

  const apply = () => {
    const s = parseReps(sets);
    const lo = parseReps(min);
    const hi = parseReps(max);
    const patch: Parameters<typeof updateSessionPrescription>[1] = {};
    if (s !== null && s >= 1 && s !== prescription.sets) patch.sets = s;
    if (lo !== null && hi !== null && lo >= 1 && (lo !== prescription.reps.min || hi !== prescription.reps.max)) patch.reps = { min: Math.min(lo, hi), max: Math.max(lo, hi) };
    if (Object.keys(patch).length > 0) {
      updateSessionPrescription(exercise.id, patch);
      // Phase 3: an open suggestion the user re-targets by hand counts as "edited" (never silently accepted).
      if (exercise.recommendation && exercise.recommendation.decision !== 'dismissed') {
        const reps = patch.reps ?? prescription.reps;
        markRecommendationEdited(exercise.id, exercise.recommendation.weightKg, reps);
      }
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title} accessibilityRole="header">
        {t('workout.targetsTitle')}
      </Text>
      <Text style={styles.hint}>{t('workout.sessionOnly')}</Text>
      <View style={styles.row}>
        <Field label={t('plan.editor.sets')} value={sets} onChange={setSets} onBlur={apply} />
        <Field label={t('plan.editor.reps')} value={min} onChange={setMin} onBlur={apply} />
        <Text style={styles.to}>{t('plan.editor.repsTo')}</Text>
        <Field label={t('plan.editor.reps')} value={max} onChange={setMax} onBlur={apply} />
      </View>
      <Text style={styles.label}>{t('plan.editor.rest')}</Text>
      <View style={styles.chips}>
        {REST_CHOICES.map((seconds) => (
          <SelectChip
            key={seconds}
            label={t('library.detail.restSeconds', { n: seconds })}
            selected={prescription.rest.defaultSeconds === seconds}
            onPress={() => updateSessionPrescription(exercise.id, { rest: { defaultSeconds: seconds, minSeconds: seconds, maxSeconds: seconds } })}
          />
        ))}
      </View>
      <View style={styles.actions}>
        {canSaveToPlan ? (
          <Button
            label={t('workout.saveToPlan')}
            variant="tinted"
            onPress={() => {
              apply();
              if (saveTargetsToPlan(exercise.id)) onSavedToPlan();
            }}
          />
        ) : null}
        <Button
          label={t('plan.editor.done')}
          onPress={() => {
            apply();
            onClose();
          }}
        />
      </View>
    </View>
  );
}

function Field({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="number-pad" selectTextOnFocus accessibilityLabel={label} style={styles.input} />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim },
    sheet: { borderTopLeftRadius: t.radii.sheet, borderTopRightRadius: t.radii.sheet, backgroundColor: t.colors.surface, paddingTop: t.spacing.lg, paddingHorizontal: t.spacing.xl },
    form: { gap: t.spacing.md },
    title: { ...t.typography.title3, color: t.colors.label },
    hint: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm },
    field: { gap: t.spacing.xxs, width: 76 },
    label: { ...t.typography.footnote, color: t.colors.labelSecondary },
    input: { ...t.typography.metric, color: t.colors.label, minHeight: HIT, textAlign: 'center', borderRadius: t.radii.tile, backgroundColor: t.colors.surfaceRaised },
    to: { ...t.typography.subheadline, color: t.colors.labelSecondary, paddingBottom: t.spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    actions: { gap: t.spacing.sm, marginTop: t.spacing.sm },
  }),
);
