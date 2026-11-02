import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { hapticSelection } from '@/lib/feedback';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles } from '@/theme';
import type { EffortScale, ExerciseSet } from '@/types/workout';

/**
 * One-tap effort rating for the set just logged, shown on the rest sheet so
 * the protected set grid stays as it is. RPE 9.5–10 or 0 reps in reserve
 * tells the progression engine the weight was at the limit (rule 5a).
 * Tapping the selected value again clears it.
 */

export const RPE_VALUES = [6, 7, 8, 8.5, 9, 9.5, 10] as const;
export const RIR_VALUES = [4, 3, 2, 1, 0] as const;

interface EffortPickerProps {
  scale: Exclude<EffortScale, 'off'>;
  sessionExerciseId: string;
  set: ExerciseSet;
}

export function EffortPicker({ scale, sessionExerciseId, set }: EffortPickerProps) {
  const t = useT();
  const styles = useStyles();
  const setSetFeedback = useWorkoutStore((state) => state.setSetFeedback);
  const hapticsEnabled = useWorkoutStore((state) => state.settings.hapticsEnabled);
  const values: readonly number[] = scale === 'rpe' ? RPE_VALUES : RIR_VALUES;
  const current = scale === 'rpe' ? set.rpe : set.rir;

  const choose = (value: number) => {
    const next = current === value ? null : value;
    setSetFeedback(sessionExerciseId, set.id, scale === 'rpe' ? { rpe: next } : { rir: next });
    if (hapticsEnabled) hapticSelection();
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        {t('workout.feedbackTitle', { n: set.setNumber })} <Text style={styles.scale}>{t(scale === 'rpe' ? 'workout.rpe' : 'workout.rir')}</Text>
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {values.map((value) => {
          const selected = current === value;
          const label = scale === 'rir' && value === 4 ? '4+' : String(value);
          return (
            <Pressable
              key={value}
              onPress={() => choose(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(scale === 'rpe' ? 'workout.rpeValueA11y' : 'workout.rirValueA11y', { value: label })}
              hitSlop={4}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{t(scale === 'rpe' ? 'workout.rpeHint' : 'workout.rirHint')}</Text>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.xs, alignSelf: 'stretch' },
    title: { ...t.typography.subheadline, color: t.colors.labelSecondary, textAlign: 'center' },
    scale: { ...t.typography.footnote, color: t.colors.labelSecondary },
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: t.spacing.xs },
    chip: {
      minWidth: HIT,
      minHeight: 36,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.surfaceHigh,
    },
    chipSelected: { backgroundColor: t.colors.tint },
    chipText: { ...t.typography.headline, color: t.colors.label, fontVariant: ['tabular-nums'] },
    chipTextSelected: { color: t.colors.onTint },
    hint: { ...t.typography.caption, color: t.colors.labelSecondary, textAlign: 'center' },
    pressed: { opacity: 0.7 },
  }),
);
