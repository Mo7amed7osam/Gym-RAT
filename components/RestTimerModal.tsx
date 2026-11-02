import { Pause, Play } from 'lucide-react-native';
import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EffortPicker } from '@/components/EffortPicker';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { HIT } from '@/constants/theme';
import { hapticSelection, restCompleteFeedback } from '@/lib/feedback';
import { formatSet, getPreviousSetAt } from '@/lib/workoutMath';
import { useT } from '@/i18n';
import { formatRestTime, useRestTimerCountdown, type RestTimerPhase } from '@/store/useRestTimerCountdown';
import { selectPreviousExercise, useWorkoutStore, useExercise } from '@/store/useWorkoutStore';
import type { ExerciseSet, SessionExercise } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

const MAX_RING_SIZE = 248;
const PHASE_KEY: Record<RestTimerPhase, string> = {
  idle: 'rest.rest',
  paused: 'rest.paused',
  running: 'rest.rest',
  warning: 'rest.getReady',
  overtime: 'rest.overtime',
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
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const ringSize = Math.min(MAX_RING_SIZE, Math.round(height * 0.3));
  const hapticsEnabled = useWorkoutStore((state) => state.settings.hapticsEnabled);
  const soundEnabled = useWorkoutStore((state) => state.settings.restSoundEnabled);
  const pauseRestTimer = useWorkoutStore((state) => state.pauseRestTimer);
  const resumeRestTimer = useWorkoutStore((state) => state.resumeRestTimer);
  const adjustRestTimer = useWorkoutStore((state) => state.adjustRestTimer);
  const skipRestTimer = useWorkoutStore((state) => state.skipRestTimer);
  const effortScale = useWorkoutStore((state) => state.settings.effortScale);

  const onElapsed = useCallback(
    () => restCompleteFeedback({ haptics: hapticsEnabled, sound: soundEnabled }),
    [hapticsEnabled, soundEnabled],
  );
  const countdown = useRestTimerCountdown(onElapsed);
  const { exercise, completed, next } = useRestContext();
  const previousExercise = useWorkoutStore(selectPreviousExercise(exercise?.exerciseId ?? ''));

  const exerciseRecord = useExercise(exercise?.exerciseId);
  const exerciseName = exercise ? exerciseRecord?.name.en ?? exercise.exerciseId : t('rest.rest');
  const ringColor = theme.restPhaseColors[countdown.phase];
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onMinimize} accessibilityLabel={t('rest.minimise')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <Pressable onPress={onMinimize} accessibilityRole="button" accessibilityLabel={t('rest.minimise')} style={styles.grabberArea}>
            <View style={styles.grabber} />
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {exerciseName}
            </Text>
            {completed ? (
              <Text style={styles.subtitle}>{t('rest.setLogged', { n: completed.setNumber, set: formatSet(completed) })}</Text>
            ) : null}
          </View>

          {exercise && completed && completed.type === 'working' && effortScale !== 'off' ? (
            <EffortPicker scale={effortScale} sessionExerciseId={exercise.id} set={completed} />
          ) : null}

          <View
            style={styles.ringWrap}
            accessible
            accessibilityRole="timer"
            accessibilityLabel={t('rest.remainingA11y', { phase: t(PHASE_KEY[countdown.phase]), time: formatRestTime(countdown.remainingSeconds) })}
          >
            <ProgressRing size={ringSize} strokeWidth={14} progress={ringProgress} color={ringColor}>
              <Text style={[styles.phase, { color: ringColor }]}>{t(PHASE_KEY[countdown.phase])}</Text>
              <Text style={[styles.time, countdown.phase === 'overtime' && { color: theme.colors.destructive }]}>
                {formatRestTime(countdown.remainingSeconds)}
              </Text>
              <Text style={styles.ofTotal}>{t('rest.ofTotal', { time: formatRestTime(Math.round(countdown.durationMs / 1000)) })}</Text>
            </ProgressRing>
          </View>

          <View style={styles.controls}>
            <RoundControl label={t('rest.minus15')} accessibilityLabel={t('rest.subtract15')} onPress={() => adjust(-15)} />
            <Pressable
              onPress={isPaused ? resumeRestTimer : pauseRestTimer}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? t('rest.resume') : t('rest.pause')}
              style={({ pressed }) => [styles.playPause, pressed && styles.pressed]}
            >
              {isPaused ? <Play size={26} color={theme.colors.label} fill={theme.colors.label} /> : <Pause size={26} color={theme.colors.label} fill={theme.colors.label} />}
            </Pressable>
            <RoundControl label={t('rest.plus30')} accessibilityLabel={t('rest.add30')} onPress={() => adjust(30)} />
          </View>

          <View style={styles.quickAdjust}>
            <Pressable onPress={() => adjust(-30)} accessibilityRole="button" accessibilityLabel={t('rest.subtract30')} style={styles.quickChip}>
              <Text style={styles.quickChipText}>{t('rest.minus30')}</Text>
            </Pressable>
            <Pressable onPress={() => adjust(15)} accessibilityRole="button" accessibilityLabel={t('rest.add15')} style={styles.quickChip}>
              <Text style={styles.quickChipText}>{t('rest.plus15')}</Text>
            </Pressable>
          </View>

          {next ? (
            <View style={styles.upNext} accessible>
              <Text style={styles.upNextLabel}>{t('rest.upNext')}</Text>
              <View style={styles.upNextBody}>
                <Text style={styles.upNextValue}>
                  {t('rest.nextSet', {
                    n: next.setNumber,
                    weight: next.weightKg ?? t('common.none'),
                    reps: next.targetReps.min === next.targetReps.max ? next.targetReps.min : `${next.targetReps.min}–${next.targetReps.max}`,
                  })}
                </Text>
                {nextPrevious ? <Text style={styles.upNextLast}>{t('rest.last', { set: formatSet(nextPrevious) })}</Text> : null}
              </View>
            </View>
          ) : (
            <View style={styles.upNext}>
              <Text style={styles.upNextLabel}>{t('rest.upNext')}</Text>
              <Text style={styles.upNextValue}>{t('rest.nextExercise')}</Text>
            </View>
          )}

          <Button label={t('rest.skip')} onPress={skipRestTimer} variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

function RoundControl({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  const styles = useStyles();
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
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const countdown = useRestTimerCountdown();
  const { next } = useRestContext();
  if (countdown.phase === 'idle') return null;

  const color = theme.restPhaseColors[countdown.phase];
  return (
    <Pressable
      onPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel={t('rest.pillA11y', { time: formatRestTime(countdown.remainingSeconds) })}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillLabel} numberOfLines={1}>
        {`${countdown.phase === 'paused' ? t('rest.paused') : t('rest.rest')}${next ? t('rest.pillNext', { n: next.setNumber }) : ''}`}
      </Text>
      <Text style={[styles.pillTime, { color }]}>{formatRestTime(countdown.remainingSeconds)}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: t.colors.scrim,
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radii.sheet,
      borderTopRightRadius: t.radii.sheet,
      paddingHorizontal: t.spacing.xl,
      gap: t.spacing.xl,
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
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceHigh,
    },
    titleBlock: {
      alignItems: 'center',
      gap: 2,
    },
    exerciseName: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    subtitle: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    ringWrap: {
      alignItems: 'center',
    },
    phase: {
      ...t.typography.footnote,
    },
    time: {
      ...t.typography.timer,
      color: t.colors.label,
    },
    ofTotal: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xxl,
    },
    roundControl: {
      width: 84,
      height: 56,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundControlText: {
      ...t.typography.headline,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    playPause: {
      width: 68,
      height: 68,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickAdjust: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: t.spacing.md,
      marginTop: -t.spacing.sm,
    },
    quickChip: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.lg,
      justifyContent: 'center',
    },
    quickChipText: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.link,
    },
    upNext: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: t.spacing.lg,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surfaceRaised,
    },
    upNextLabel: {
      ...t.typography.footnote,
      color: t.colors.labelSecondary,
    },
    upNextBody: {
      alignItems: 'flex-end',
    },
    upNextValue: {
      ...t.typography.headline,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    upNextLast: {
      ...t.typography.mono,
      color: t.colors.labelSecondary,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: HIT + 4,
      paddingHorizontal: t.spacing.lg,
      borderRadius: 24,
      backgroundColor: t.colors.background,
      borderWidth: 1,
      borderColor: t.colors.surfaceRaised,
    },
    pillDot: {
      width: 10,
      height: 10,
      borderRadius: t.radii.pill,
    },
    pillLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: t.colors.label,
    },
    pillTime: {
      ...t.typography.headline,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    pressed: {
      opacity: 0.7,
    },
  }),
);
