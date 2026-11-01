import { Check, ChevronDown, ChevronUp, Pause, Play, SkipForward } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { STRETCH_POSTERS, stretchPosterAspect } from '@/assets/exercises';

import { ProgressRing } from '@/components/ui/ProgressRing';
import { HIT, colors, radii, spacing, typography } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import { STRETCH_ROUTINES, WARMUP_STAGES } from '@/data/warmupData';
import { hapticSelection, hapticWarning } from '@/lib/feedback';
import { getPreviousPerformance, isCountedSet, roundTo } from '@/lib/workoutMath';
import { formatRestTime } from '@/store/useRestTimerCountdown';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { StretchMove, StretchRoutine, WarmupStage } from '@/types/workout';

// ─── Checklist ids & progress ────────────────────────────────────────────────

export const stageItemId = (stage: WarmupStage['id']): string => `stage:${stage}`;
export const moveItemId = (routine: StretchRoutine, move: StretchMove): string => `${routine.id}:${move.id}`;

const DYNAMIC = STRETCH_ROUTINES.dynamic_warmup;
const PRE_WORKOUT = STRETCH_ROUTINES.pre_workout_stretches;

function isStageDone(stage: WarmupStage, completed: ReadonlySet<string>): boolean {
  if (stage.routineId) {
    const routine = STRETCH_ROUTINES[stage.routineId];
    return routine.moves.every((move) => completed.has(moveItemId(routine, move)));
  }
  return completed.has(stageItemId(stage.id));
}

/** 0 → 1 across the three PDF warm-up stages. */
export function getRoutineProgress(completedIds: readonly string[]): number {
  const completed = new Set(completedIds);
  return WARMUP_STAGES.filter((stage) => isStageDone(stage, completed)).length / WARMUP_STAGES.length;
}

// ─── Component ───────────────────────────────────────────────────────────────

/** What the warm-up needs to know about today's workout. */
export interface WarmupDayInfo {
  code: string;
  /** First lift of the day, for the acclimation-set suggestion. */
  firstExerciseId?: string;
}

interface WarmupRoutineProps {
  day?: WarmupDayInfo;
  completedIds: readonly string[];
  onToggle: (itemId: string) => void;
}

/**
 * Warm-up: the 3 PDF stages + dynamic stretches, with a built-in hold timer.
 * Stateless about completion: the screen passes `completedIds` / `onToggle`.
 */
export function WarmupRoutine({ day, completedIds, onToggle }: WarmupRoutineProps) {
  const completed = new Set(completedIds);
  const progress = getRoutineProgress(completedIds);

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introText}>
          <Text style={styles.title} accessibilityRole="header">
            Warm-up
          </Text>
          <Text style={styles.subtitle}>
            {`Three stages${day ? ` before ${day.code}` : ''}: raise your heart rate, move every joint, then rehearse the first lift light.`}
          </Text>
        </View>
        <ProgressRing size={64} strokeWidth={7} progress={progress} color={progress >= 1 ? colors.success : colors.tint}>
          <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
        </ProgressRing>
      </View>

      <WarmupStages day={day} completed={completed} onToggle={onToggle} />
    </View>
  );
}

function WarmupStages({
  day,
  completed,
  onToggle,
}: {
  day?: WarmupDayInfo;
  completed: ReadonlySet<string>;
  onToggle: (itemId: string) => void;
}) {
  const [showPreWorkout, setShowPreWorkout] = useState(false);
  const firstExercise = day?.firstExerciseId ? getExercise(day.firstExerciseId) : undefined;
  const acclimationKg = useAcclimationWeight(day?.firstExerciseId);

  return (
    <>
      {WARMUP_STAGES.map((stage) => {
        const done = isStageDone(stage, completed);
        const detail =
          stage.id === 'acclimation_sets' && firstExercise
            ? `${firstExercise.name.en}, 2 × 12–15${acclimationKg ? ` at ~${acclimationKg} kg` : ' light'}`
            : stage.detail.en;

        return (
          <View key={stage.id} style={styles.stageCard}>
            <Pressable
              onPress={stage.routineId ? undefined : () => onToggle(stageItemId(stage.id))}
              disabled={Boolean(stage.routineId)}
              accessibilityRole={stage.routineId ? 'header' : 'checkbox'}
              accessibilityState={stage.routineId ? undefined : { checked: done }}
              style={styles.stageHeader}
            >
              <CheckMark checked={done} />
              <View style={styles.flex}>
                <Text style={styles.stageTitle}>
                  {stage.order}. {stage.title.en}
                </Text>
                <Text style={styles.stageDetail}>{detail}</Text>
                <Text style={styles.arabicSmall} accessibilityLanguage="ar">
                  {stage.detail.ar}
                </Text>
              </View>
            </Pressable>

            {stage.routineId === 'dynamic_warmup' ? (
              <StretchSession routine={DYNAMIC} completed={completed} onToggle={onToggle} embedded />
            ) : null}
          </View>
        );
      })}

      <View style={styles.stageCard}>
        <Pressable
          onPress={() => setShowPreWorkout((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showPreWorkout }}
          style={styles.stageHeader}
        >
          <View style={styles.flex}>
            <Text style={styles.stageTitle}>{PRE_WORKOUT.title.en} (optional)</Text>
            <Text style={styles.stageDetail}>{PRE_WORKOUT.description.en}</Text>
          </View>
          {showPreWorkout ? (
            <ChevronUp size={20} color={colors.labelSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.labelSecondary} />
          )}
        </Pressable>
        {showPreWorkout ? (
          <StretchSession routine={PRE_WORKOUT} completed={completed} onToggle={onToggle} embedded />
        ) : null}
      </View>

      <Text style={styles.footnote}>Dynamic stretches help prevent injury. Keep static holds short before lifting.</Text>
    </>
  );
}

/** ~50 % of last session's top set on the first lift, rounded to 2.5 kg. */
function useAcclimationWeight(exerciseId: string | undefined): number | null {
  return useWorkoutStore((state) => {
    if (!exerciseId) return null;
    const previous = getPreviousPerformance(state.history, exerciseId);
    if (!previous) return null;
    const top = Math.max(0, ...previous.exercise.sets.filter(isCountedSet).map((set) => set.weightKg));
    return top > 0 ? roundTo(top * 0.5, 2.5) : null;
  });
}

// ─── Stretch session with hold timer ─────────────────────────────────────────


interface StretchSessionProps {
  routine: StretchRoutine;
  completed: ReadonlySet<string>;
  onToggle: (itemId: string) => void;
  /** Rendered inside a stage card (no outer card styling). */
  embedded?: boolean;
}

function StretchSession({ routine, completed, onToggle, embedded = false }: StretchSessionProps) {
  const hapticsEnabled = useWorkoutStore((state) => state.settings.hapticsEnabled);
  const timer = useHoldTimer(routine, completed, onToggle, hapticsEnabled);
  const current = routine.moves[timer.index];
  const remainingSeconds = Math.max(0, Math.ceil(timer.remainingMs / 1000));
  const progress = 1 - timer.remainingMs / (current.holdSeconds * 1000);

  return (
    <View style={[styles.session, !embedded && styles.sessionCard]}>
      {routine.posterKey ? (
        // Sized by the wrapper: react-native-web ignores aspectRatio on Image itself.
        <View style={[styles.poster, { aspectRatio: stretchPosterAspect(routine.posterKey) }]}>
          <Image
            source={STRETCH_POSTERS[routine.posterKey]}
            style={styles.posterImage}
            resizeMode="contain"
            accessibilityLabel={`${routine.title.en} reference poster`}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}
      <View style={styles.nowCard}>
        <ProgressRing
          size={76}
          strokeWidth={7}
          progress={progress}
          color={timer.running ? colors.link : colors.labelSecondary}
          trackColor={colors.surfaceHigh}
        >
          <Text style={styles.nowTime}>{formatRestTime(remainingSeconds)}</Text>
        </ProgressRing>
        <View style={styles.flex}>
          <Text style={styles.nowEyebrow}>
            Stretch {timer.index + 1} of {routine.moves.length}
            {current.bothSides ? `, side ${timer.side} of 2` : ''}
          </Text>
          <Text style={styles.nowName}>{current.name.en}</Text>
          <Text style={styles.nowInstruction}>{current.instruction.en}</Text>
        </View>
      </View>
      <View style={styles.nowControls}>
        <Pressable
          onPress={timer.running ? timer.pause : timer.start}
          accessibilityRole="button"
          accessibilityLabel={timer.running ? `Pause ${current.name.en}` : `Start ${current.name.en}`}
          style={({ pressed }) => [styles.controlButton, styles.controlPrimary, pressed && styles.pressed]}
        >
          {timer.running ? <Pause size={18} color={colors.onTint} fill={colors.onTint} /> : <Play size={18} color={colors.onTint} fill={colors.onTint} />}
          <Text style={styles.controlPrimaryText}>{timer.running ? 'Pause' : 'Start'}</Text>
        </Pressable>
        <Pressable
          onPress={timer.next}
          accessibilityRole="button"
          accessibilityLabel="Mark done and go to next stretch"
          style={({ pressed }) => [styles.controlButton, styles.controlSecondary, pressed && styles.pressed]}
        >
          <SkipForward size={18} color={colors.link} />
          <Text style={styles.controlSecondaryText}>Done, next</Text>
        </Pressable>
      </View>

      <View style={styles.moveList}>
        {routine.moves.map((move, index) => {
          const id = moveItemId(routine, move);
          const done = completed.has(id);
          const isCurrent = index === timer.index;
          return (
            <View key={move.id} style={[styles.moveRow, index < routine.moves.length - 1 && styles.divider]}>
              <Pressable
                onPress={() => onToggle(id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={move.name.en}
                hitSlop={6}
                style={styles.moveCheck}
              >
                <CheckMark checked={done} />
              </Pressable>
              <Pressable
                onPress={() => timer.select(index)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${move.name.en}`}
                style={styles.moveBody}
              >
                <View style={styles.flex}>
                  <Text style={[styles.moveName, isCurrent && styles.moveNameCurrent, done && styles.moveNameDone]}>
                    {move.name.en}
                  </Text>
                  <Text style={styles.arabicSmall} accessibilityLanguage="ar">
                    {move.name.ar}
                  </Text>
                </View>
                <Text style={styles.moveHold}>
                  {formatRestTime(move.holdSeconds)}
                  {move.bothSides ? ' ×2' : ''}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkMark, checked ? styles.checkMarkOn : styles.checkMarkOff]}>
      {checked ? <Check size={16} strokeWidth={3} color={colors.onTint} /> : null}
    </View>
  );
}

interface HoldTimer {
  index: number;
  side: 1 | 2;
  running: boolean;
  remainingMs: number;
  start: () => void;
  pause: () => void;
  next: () => void;
  select: (index: number) => void;
}

/**
 * Hold timer that walks through a stretch routine: counts each hold
 * (both sides where needed), checks the move off, then starts the next one.
 */
function useHoldTimer(
  routine: StretchRoutine,
  completed: ReadonlySet<string>,
  onToggle: (itemId: string) => void,
  hapticsEnabled: boolean,
): HoldTimer {
  const firstOpen = Math.max(0, routine.moves.findIndex((move) => !completed.has(moveItemId(routine, move))));
  const [index, setIndex] = useState(firstOpen);
  const [side, setSide] = useState<1 | 2>(1);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Latest values for the interval callback.
  const latest = useRef({ completed, onToggle, hapticsEnabled });
  useEffect(() => {
    latest.current = { completed, onToggle, hapticsEnabled };
  }, [completed, onToggle, hapticsEnabled]);

  const move = routine.moves[index];
  const holdMs = move.holdSeconds * 1000;

  const finishMove = (from: number, at: number) => {
    const { completed: done, onToggle: toggle, hapticsEnabled: haptics } = latest.current;
    const finished = routine.moves[from];
    if (!done.has(moveItemId(routine, finished))) toggle(moveItemId(routine, finished));
    if (haptics) hapticWarning();

    const nextIndex = routine.moves.findIndex(
      (candidate, i) => i > from && !done.has(moveItemId(routine, candidate)),
    );
    setSide(1);
    setPausedMs(null);
    if (nextIndex === -1) {
      setEndsAt(null);
      return;
    }
    setIndex(nextIndex);
    setEndsAt(at + routine.moves[nextIndex].holdSeconds * 1000);
  };

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t < endsAt) return;
      if (move.bothSides && side === 1) {
        setSide(2);
        setEndsAt(t + holdMs);
        if (latest.current.hapticsEnabled) hapticSelection();
      } else {
        finishMove(index, t);
      }
    }, 250);
    return () => clearInterval(id);
    // finishMove reads refs + stable setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, index, side, holdMs, move.bothSides]);

  const running = endsAt !== null;
  const remainingMs = running ? Math.max(0, endsAt - now) : pausedMs ?? holdMs;

  return {
    index,
    side,
    running,
    remainingMs,
    start: () => {
      const t = Date.now();
      setNow(t);
      setEndsAt(t + (pausedMs ?? holdMs));
      setPausedMs(null);
    },
    pause: () => {
      if (endsAt === null) return;
      setPausedMs(Math.max(0, endsAt - Date.now()));
      setEndsAt(null);
    },
    next: () => {
      const wasRunning = endsAt !== null;
      finishMove(index, Date.now());
      if (!wasRunning) setEndsAt(null);
    },
    select: (nextIndex: number) => {
      setIndex(nextIndex);
      setSide(1);
      setEndsAt(null);
      setPausedMs(null);
    },
  };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  poster: {
    width: '100%',
    // The A4 pre-workout sheet would otherwise be taller than the screen.
    maxHeight: 360,
    borderRadius: radii.tile,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  introText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.title1,
    color: colors.label,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  percent: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  stageCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT,
    padding: spacing.lg,
  },
  stageTitle: {
    ...typography.headline,
    color: colors.label,
  },
  stageDetail: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  arabicSmall: {
    ...typography.arabic,
    fontSize: 13,
    lineHeight: 18,
    color: colors.labelSecondary,
  },
  footnote: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.lg,
  },
  session: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  sessionCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    paddingTop: spacing.lg,
  },
  nowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.tile,
    backgroundColor: colors.surfaceRaised,
  },
  nowTime: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  nowEyebrow: {
    ...typography.footnote,
    fontSize: 12,
    color: colors.tint,
  },
  nowName: {
    ...typography.headline,
    color: colors.label,
  },
  nowInstruction: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  nowControls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  controlButton: {
    flex: 1,
    minHeight: HIT,
    borderRadius: radii.row,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  controlPrimary: {
    backgroundColor: colors.tint,
  },
  controlPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onTint,
  },
  controlSecondary: {
    backgroundColor: colors.surfaceRaised,
  },
  controlSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.link,
  },
  moveList: {
    marginTop: spacing.xs,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  moveCheck: {
    minWidth: HIT,
    minHeight: HIT,
    justifyContent: 'center',
  },
  moveBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  moveName: {
    ...typography.body,
    color: colors.label,
  },
  moveNameCurrent: {
    fontWeight: '600',
    color: colors.tint,
  },
  moveNameDone: {
    color: colors.labelSecondary,
  },
  moveHold: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkOn: {
    backgroundColor: colors.success,
  },
  checkMarkOff: {
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
  },
  pressed: {
    opacity: 0.75,
  },
});
