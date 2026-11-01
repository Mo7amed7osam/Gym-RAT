import { Pause, Play } from 'lucide-react-native';
import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { HIT, colors, radii, restPhaseColors, spacing, typography } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import { hapticSelection, restCompleteFeedback } from '@/lib/feedback';
import { formatSet, getPreviousSetAt } from '@/lib/workoutMath';
import { formatRestTime, useRestTimerCountdown, type RestTimerPhase } from '@/store/useRestTimerCountdown';
import { selectPreviousExercise, useWorkoutStore } from '@/store/useWorkoutStore';
import type { ExerciseSet, SessionExercise } from '@/types/workout';

const MAX_RING_SIZE = 248;
const PHASE_LABEL: Record<RestTimerPhase, string> = {
  idle: 'Rest',
  paused: 'Paused',
  running: 'Rest',
  warning: 'Get ready',
  overtime: 'Overtime',
};

/** Exercise + sets referenced by the current rest timer context. */
function useRestContext(): { exercise: SessionExercise | null; completed: ExerciseSet | null; next: ExerciseSet | null } {
  const context = useWorkoutStore((state) => state.restTimer.context);
  const exercise = useWorkoutStore(
    (state) => state.activeSession?.exercises.find((item) => item.id === context?.sessionExerciseId) ?? null,
  );
  return {
    exercise,
    completed: exercise?.sets.find((item) => item.id === context?.completedSetId) ?? null,
    next: exercise?.sets.find((item) => item.id === context?.nextSetId) ?? null,
  };
}

interface RestTimerModalProps {
  /** Sheet expanded. The timer keeps running when minimised to the pill. */
  visible: boolean;
  onMinimize: () => void;
}

/**
 * Bottom-sheet rest timer. Mount exactly one per screen: it owns the
 * "rest finished" haptic + chime even while minimised.
 */
export function RestTimerModal({ visible, onMinimize }: RestTimerModalProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const ringSize = Math.min(MAX_RING_SIZE, Math.round(height * 0.3));
  const hapticsEnabled = useWorkoutStore((state) => state.settings.hapticsEnabled);
  const soundEnabled = useWorkoutStore((state) => state.settings.restSoundEnabled);
  const pauseRestTimer = useWorkoutStore((state) => state.pauseRestTimer);
  const resumeRestTimer = useWorkoutStore((state) => state.resumeRestTimer);
  const adjustRestTimer = useWorkoutStore((state) => state.adjustRestTimer);
  const skipRestTimer = useWorkoutStore((state) => state.skipRestTimer);

  const onElapsed = useCallback(
    () => restCompleteFeedback({ haptics: hapticsEnabled, sound: soundEnabled }),
    [hapticsEnabled, soundEnabled],
  );
  const countdown = useRestTimerCountdown(onElapsed);
  const { exercise, completed, next } = useRestContext();
  const previousExercise = useWorkoutStore(selectPreviousExercise(exercise?.exerciseId ?? ''));

  const exerciseName = exercise ? getExercise(exercise.exerciseId)?.name.en ?? exercise.exerciseId : 'Rest';
  const ringColor = restPhaseColors[countdown.phase];
  const isPaused = countdown.phase === 'paused';
  // Ring drains as rest runs out; full red once in overtime.
  const ringProgress = countdown.phase === 'overtime' ? 1 : 1 - countdown.progress;
  const nextPrevious = next ? getPreviousSetAt(previousExercise, next.setNumber) : null;

  const adjust = (seconds: number) => {
    adjustRestTimer(seconds);
    if (hapticsEnabled) hapticSelection();
  };

  return (
    <Modal
      visible={visible && countdown.phase !== 'idle'}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onMinimize}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onMinimize} accessibilityLabel="Minimise rest timer" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable onPress={onMinimize} accessibilityRole="button" accessibilityLabel="Minimise rest timer" style={styles.grabberArea}>
            <View style={styles.grabber} />
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {exerciseName}
            </Text>
            {completed ? (
              <Text style={styles.subtitle}>
                Set {completed.setNumber} logged: {formatSet(completed)}
              </Text>
            ) : null}
          </View>

          <View
            style={styles.ringWrap}
            accessible
            accessibilityRole="timer"
            accessibilityLabel={`${PHASE_LABEL[countdown.phase]}, ${formatRestTime(countdown.remainingSeconds)} remaining`}
          >
            <ProgressRing size={ringSize} strokeWidth={14} progress={ringProgress} color={ringColor}>
              <Text style={[styles.phase, { color: ringColor }]}>{PHASE_LABEL[countdown.phase]}</Text>
              <Text style={[styles.time, countdown.phase === 'overtime' && { color: colors.destructive }]}>
                {formatRestTime(countdown.remainingSeconds)}
              </Text>
              <Text style={styles.ofTotal}>of {formatRestTime(Math.round(countdown.durationMs / 1000))}</Text>
            </ProgressRing>
          </View>

          <View style={styles.controls}>
            <RoundControl label="−15 s" accessibilityLabel="Subtract 15 seconds" onPress={() => adjust(-15)} />
            <Pressable
              onPress={isPaused ? resumeRestTimer : pauseRestTimer}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Resume rest timer' : 'Pause rest timer'}
              style={({ pressed }) => [styles.playPause, pressed && styles.pressed]}
            >
              {isPaused ? <Play size={26} color={colors.label} fill={colors.label} /> : <Pause size={26} color={colors.label} fill={colors.label} />}
            </Pressable>
            <RoundControl label="+30 s" accessibilityLabel="Add 30 seconds" onPress={() => adjust(30)} />
          </View>

          <View style={styles.quickAdjust}>
            <Pressable onPress={() => adjust(-30)} accessibilityRole="button" accessibilityLabel="Subtract 30 seconds" style={styles.quickChip}>
              <Text style={styles.quickChipText}>−30 s</Text>
            </Pressable>
            <Pressable onPress={() => adjust(15)} accessibilityRole="button" accessibilityLabel="Add 15 seconds" style={styles.quickChip}>
              <Text style={styles.quickChipText}>+15 s</Text>
            </Pressable>
          </View>

          {next ? (
            <View style={styles.upNext} accessible>
              <Text style={styles.upNextLabel}>Up next</Text>
              <View style={styles.upNextBody}>
                <Text style={styles.upNextValue}>
                  Set {next.setNumber}: {next.weightKg ?? '—'} kg × {next.targetReps.min === next.targetReps.max ? next.targetReps.min : `${next.targetReps.min}–${next.targetReps.max}`}
                </Text>
                {nextPrevious ? <Text style={styles.upNextLast}>last: {formatSet(nextPrevious)}</Text> : null}
              </View>
            </View>
          ) : (
            <View style={styles.upNext}>
              <Text style={styles.upNextLabel}>Up next</Text>
              <Text style={styles.upNextValue}>Next exercise</Text>
            </View>
          )}

          <Button label="Skip rest" onPress={skipRestTimer} variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

function RoundControl({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.roundControl, pressed && styles.pressed]}
    >
      <Text style={styles.roundControlText}>{label}</Text>
    </Pressable>
  );
}

interface RestTimerPillProps {
  onExpand: () => void;
}

/** Sticky mini timer shown while the sheet is minimised. Renders nothing when idle. */
export function RestTimerPill({ onExpand }: RestTimerPillProps) {
  const countdown = useRestTimerCountdown();
  const { next } = useRestContext();
  if (countdown.phase === 'idle') return null;

  const color = restPhaseColors[countdown.phase];
  return (
    <Pressable
      onPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel={`Rest timer ${formatRestTime(countdown.remainingSeconds)}. Tap to expand`}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillLabel} numberOfLines={1}>
        {countdown.phase === 'paused' ? 'Paused' : 'Rest'}
        {next ? `, set ${next.setNumber} next` : ''}
      </Text>
      <Text style={[styles.pillTime, { color }]}>{formatRestTime(countdown.remainingSeconds)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  grabberArea: {
    alignSelf: 'center',
    width: 120,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 2,
  },
  exerciseName: {
    ...typography.headline,
    color: colors.label,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  ringWrap: {
    alignItems: 'center',
  },
  phase: {
    ...typography.footnote,
  },
  time: {
    ...typography.timer,
    color: colors.label,
  },
  ofTotal: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  roundControl: {
    width: 84,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundControlText: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  playPause: {
    width: 68,
    height: 68,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAdjust: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: -spacing.sm,
  },
  quickChip: {
    minHeight: HIT,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  quickChipText: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.link,
  },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceRaised,
  },
  upNextLabel: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  upNextBody: {
    alignItems: 'flex-end',
  },
  upNextValue: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  upNextLast: {
    ...typography.mono,
    color: colors.labelSecondary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  pillLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.label,
  },
  pillTime: {
    ...typography.headline,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
});
