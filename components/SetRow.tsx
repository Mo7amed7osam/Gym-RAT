import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { HIT } from '@/constants/theme';
import { formatInputNumber, parseReps, parseWeight } from '@/lib/parseNumber';
import { formatSet } from '@/lib/workoutMath';
import type { SetValues } from '@/store/useWorkoutStore';
import type { ExerciseSet } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

interface SetRowProps {
  set: ExerciseSet;
  /** Same set number last time this exercise was logged. */
  previous: ExerciseSet | null;
  /** First incomplete set — gets the orange check ring. */
  isActive: boolean;
  isLast: boolean;
  onCommit: (values: SetValues) => void;
  onComplete: (values: SetValues) => void;
  onUncomplete: () => void;
  onToggleType: () => void;
  onRemove: () => void;
}

/**
 * One row of the sets grid: Set · Previous · kg · Reps · ✓.
 * Inputs keep a local text draft (so "57." or "٥٧٫٥" can be typed) and commit
 * on blur; tapping ✓ while still typing uses the draft directly.
 */
export function SetRow({
  set,
  previous,
  isActive,
  isLast,
  onCommit,
  onComplete,
  onUncomplete,
  onToggleType,
  onRemove,
}: SetRowProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [weightText, setWeightText] = useState(() => formatInputNumber(set.weightKg));
  const [repsText, setRepsText] = useState(() => formatInputNumber(set.reps));
  const [syncedWeight, setSyncedWeight] = useState(set.weightKg);
  const [syncedReps, setSyncedReps] = useState(set.reps);

  // Values changed from outside (carry-forward from the previous set): reset drafts.
  if (set.weightKg !== syncedWeight) {
    setSyncedWeight(set.weightKg);
    setWeightText(formatInputNumber(set.weightKg));
  }
  if (set.reps !== syncedReps) {
    setSyncedReps(set.reps);
    setRepsText(formatInputNumber(set.reps));
  }

  const placeholderWeight = previous?.weightKg ?? null;
  const placeholderReps = previous?.reps ?? set.targetReps.max;
  const isWarmup = set.type === 'warmup';
  const setLabel = isWarmup ? 'W' : String(set.setNumber);

  const handleComplete = () => {
    if (set.completed) {
      onUncomplete();
      return;
    }
    onComplete({
      weightKg: parseWeight(weightText) ?? placeholderWeight,
      reps: parseReps(repsText) ?? placeholderReps,
    });
  };

  return (
    <View
      style={[
        styles.row,
        !isLast && styles.rowDivider,
        set.completed && styles.rowCompleted,
      ]}
    >
      <Pressable
        onPress={onToggleType}
        onLongPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Set ${set.setNumber}, ${isWarmup ? 'warm-up' : 'working'} set`}
        accessibilityHint="Tap to switch warm-up or working set. Long press to remove."
        accessibilityActions={[{ name: 'activate' }, { name: 'longpress', label: 'Remove set' }]}
        onAccessibilityAction={(event) => (event.nativeEvent.actionName === 'longpress' ? onRemove() : onToggleType())}
        hitSlop={8}
        style={styles.setNumber}
      >
        <Text style={[styles.setNumberText, isWarmup && styles.warmupText]}>{setLabel}</Text>
      </Pressable>

      <Text style={styles.previous} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityLabel={previous ? `Previous ${formatSet(previous)}` : 'No previous set'}>
        {previous ? formatSet(previous) : '—'}
      </Text>

      {set.completed ? (
        <>
          <Text style={[styles.valueText, styles.weightColumn]}>{set.weightKg ?? 0}</Text>
          <Text style={[styles.valueText, styles.repsColumn]}>{set.reps ?? 0}</Text>
        </>
      ) : (
        <>
          <TextInput
            value={weightText}
            onChangeText={setWeightText}
            onEndEditing={() => onCommit({ weightKg: parseWeight(weightText) })}
            placeholder={placeholderWeight !== null ? String(placeholderWeight) : 'kg'}
            placeholderTextColor={theme.colors.labelTertiary}
            keyboardType="decimal-pad"
            returnKeyType="next"
            selectTextOnFocus
            maxLength={6}
            accessibilityLabel={`Set ${set.setNumber} weight in kilograms`}
            style={[styles.input, styles.weightColumn]}
          />
          <TextInput
            value={repsText}
            onChangeText={setRepsText}
            onEndEditing={() => onCommit({ reps: parseReps(repsText) })}
            placeholder={String(placeholderReps)}
            placeholderTextColor={theme.colors.labelTertiary}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            maxLength={3}
            accessibilityLabel={`Set ${set.setNumber} reps, target ${set.targetReps.min} to ${set.targetReps.max}`}
            style={[styles.input, styles.repsColumn]}
          />
        </>
      )}

      <Pressable
        onPress={handleComplete}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={set.completed ? `Set ${set.setNumber} logged. Tap to undo` : `Log set ${set.setNumber}`}
        style={({ pressed }) => [
          styles.check,
          set.completed ? styles.checkDone : isActive ? styles.checkActive : styles.checkIdle,
          pressed && styles.pressed,
        ]}
      >
        <Check
          size={20}
          strokeWidth={3}
          color={set.completed ? theme.colors.onTint : isActive ? theme.colors.tint : theme.colors.labelTertiary}
        />
      </Pressable>
    </View>
  );
}

export const SET_GRID_COLUMNS = {
  set: 32,
  weight: 72,
  reps: 60,
  check: HIT,
} as const;

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 60,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    rowCompleted: {
      backgroundColor: t.colors.successRow,
    },
    setNumber: {
      width: SET_GRID_COLUMNS.set,
      minHeight: HIT,
      justifyContent: 'center',
    },
    setNumberText: {
      fontFamily: t.fonts.display,
      fontSize: 20,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    warmupText: {
      color: t.colors.tint,
    },
    previous: {
      ...t.typography.mono,
      fontFamily: t.fonts.mono,
      flex: 1,
      color: t.colors.labelSecondary,
    },
    input: {
      ...t.typography.metric,
      height: HIT,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      color: t.colors.label,
      textAlign: 'center',
      paddingVertical: 0,
      paddingHorizontal: 4,
    },
    weightColumn: {
      width: SET_GRID_COLUMNS.weight,
    },
    repsColumn: {
      width: SET_GRID_COLUMNS.reps,
    },
    valueText: {
      ...t.typography.metric,
      color: t.colors.label,
      textAlign: 'center',
    },
    check: {
      width: SET_GRID_COLUMNS.check,
      height: SET_GRID_COLUMNS.check,
      borderRadius: t.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkDone: {
      backgroundColor: t.colors.success,
    },
    checkActive: {
      borderWidth: 2,
      borderColor: t.colors.tint,
    },
    checkIdle: {
      borderWidth: 2,
      borderColor: t.colors.surfaceHigh,
    },
    pressed: {
      opacity: 0.7,
    },
  }),
);
