import { Check, ChevronDown, ChevronUp, Pause, Play, SkipForward } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { STRETCH_POSTERS, stretchPosterAspect } from '@/assets/exercises';

import { ProgressRing } from '@/components/ui/ProgressRing';
import { HIT } from '@/constants/theme';
import { STRETCH_ROUTINES, WARMUP_STAGES } from '@/data/warmupData';
import { hapticSelection, hapticWarning } from '@/lib/feedback';
import { getPreviousPerformance, isCountedSet, roundTo } from '@/lib/workoutMath';
import { useLocale, useT } from '@/i18n';
import { formatRestTime } from '@/store/useRestTimerCountdown';
import { useExercise, useWorkoutStore } from '@/store/useWorkoutStore';
import type { StretchMove, StretchRoutine, WarmupStage } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

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
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const completed = new Set(completedIds);
  const progress = getRoutineProgress(completedIds);

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introText}>
          <Text style={styles.title} accessibilityRole="header">
            {t('warmup.title')}
          </Text>
          <Text style={styles.subtitle}>{t('warmup.subtitle', { before: day ? t('warmup.beforeCode', { code: day.code }) : '' })}</Text>
        </View>
        <ProgressRing size={64} strokeWidth={7} progress={progress} color={progress >= 1 ? theme.colors.success : theme.colors.tint}>
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
  const t = useT();
  const locale = useLocale();
  const styles = useStyles();
  const theme = useTheme();
  const [showPreWorkout, setShowPreWorkout] = useState(false);
  const firstExercise = useExercise(day?.firstExerciseId);
  const acclimationKg = useAcclimationWeight(day?.firstExerciseId);

  return (
    <>
      {WARMUP_STAGES.map((stage) => {
        const done = isStageDone(stage, completed);
        const detail =
          stage.id === 'acclimation_sets' && firstExercise
            ? t('warmup.acclimation', { name: firstExercise.name.en, weight: acclimationKg ? t('warmup.acclimationAt', { kg: acclimationKg }) : t('warmup.acclimationLight') })
            : stage.detail[locale];

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
                <Text style={styles.stageTitle}>{`${stage.order}. ${stage.title[locale]}`}</Text>
                <Text style={styles.stageDetail}>{detail}</Text>
                {locale === 'en' ? (
                  <Text style={styles.arabicSmall} accessibilityLanguage="ar">
                    {stage.detail.ar}
                  </Text>
                ) : null}
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
            <Text style={styles.stageTitle}>{t('warmup.optional', { title: PRE_WORKOUT.title[locale] })}</Text>
            <Text style={styles.stageDetail}>{PRE_WORKOUT.description[locale]}</Text>
          </View>
          {showPreWorkout ? (
            <ChevronUp size={20} color={theme.colors.labelSecondary} />
          ) : (
            <ChevronDown size={20} color={theme.colors.labelSecondary} />
          )}
        </Pressable>
        {showPreWorkout ? (
          <StretchSession routine={PRE_WORKOUT} completed={completed} onToggle={onToggle} embedded />
        ) : null}
      </View>

      <Text style={styles.footnote}>{t('warmup.footnote')}</Text>
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
  const t = useT();
  const locale = useLocale();
  const styles = useStyles();
  const theme = useTheme();
  const hapticsEnabled = useWorkoutStore((state) => state.settings.hapticsEnabled);
  const timer = useHoldTimer(routine, completed, onToggle, hapticsEnabled);
  const current = routine.moves[timer.index];
  const remainingSeconds = Math.max(0, Math.ceil(timer.remainingMs / 1000));
  const progress = 1 - timer.remainingMs / (current.holdSeconds * 1000);
  // Absent in store builds (unlicensed artwork is stubbed out by metro.config.js).
  const poster = routine.posterKey ? STRETCH_POSTERS[routine.posterKey] : undefined;

  return (
    <View style={[styles.session, !embedded && styles.sessionCard]}>
      {routine.posterKey && poster ? (
        // Sized by the wrapper: react-native-web ignores aspectRatio on Image itself.
        <View style={[styles.poster, { aspectRatio: stretchPosterAspect(routine.posterKey) }]}>
          <Image
            source={poster}
            style={styles.posterImage}
            resizeMode="contain"
            accessibilityLabel={t('warmup.posterA11y', { title: routine.title[locale] })}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}
      <View style={styles.nowCard}>
        <ProgressRing
          size={76}
          strokeWidth={7}
          progress={progress}
          color={timer.running ? theme.colors.link : theme.colors.labelSecondary}
          trackColor={theme.colors.surfaceHigh}
        >
          <Text style={styles.nowTime}>{formatRestTime(remainingSeconds)}</Text>
        </ProgressRing>
        <View style={styles.flex}>
          <Text style={styles.nowEyebrow}>
            {`${t('warmup.stretchOf', { n: timer.index + 1, total: routine.moves.length })}${current.bothSides ? t('warmup.side', { side: timer.side }) : ''}`}
          </Text>
          <Text style={styles.nowName}>{current.name[locale]}</Text>
          <Text style={styles.nowInstruction}>{current.instruction[locale]}</Text>
        </View>
      </View>
      <View style={styles.nowControls}>
        <Pressable
          onPress={timer.running ? timer.pause : timer.start}
          accessibilityRole="button"
          accessibilityLabel={timer.running ? t('warmup.pauseA11y', { name: current.name[locale] }) : t('warmup.startA11y', { name: current.name[locale] })}
          style={({ pressed }) => [styles.controlButton, styles.controlPrimary, pressed && styles.pressed]}
        >
          {timer.running ? <Pause size={18} color={theme.colors.onTint} fill={theme.colors.onTint} /> : <Play size={18} color={theme.colors.onTint} fill={theme.colors.onTint} />}
          <Text style={styles.controlPrimaryText}>{timer.running ? t('warmup.pause') : t('warmup.start')}</Text>
        </Pressable>
        <Pressable
          onPress={timer.next}
          accessibilityRole="button"
          accessibilityLabel={t('warmup.doneNextA11y')}
          style={({ pressed }) => [styles.controlButton, styles.controlSecondary, pressed && styles.pressed]}
        >
          <SkipForward size={18} color={theme.colors.link} />
          <Text style={styles.controlSecondaryText}>{t('warmup.doneNext')}</Text>
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
                accessibilityLabel={t('warmup.selectA11y', { name: move.name[locale] })}
                style={styles.moveBody}
              >
                <View style={styles.flex}>
                  <Text style={[styles.moveName, isCurrent && styles.moveNameCurrent, done && styles.moveNameDone]}>
                    {move.name[locale]}
                  </Text>
                  {locale === 'en' ? (
                    <Text style={styles.arabicSmall} accessibilityLanguage="ar">
                      {move.name.ar}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.moveHold}>
                  {`${formatRestTime(move.holdSeconds)}${move.bothSides ? t('warmup.times2') : ''}`}
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
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={[styles.checkMark, checked ? styles.checkMarkOn : styles.checkMarkOff]}>
      {checked ? <Check size={16} strokeWidth={3} color={theme.colors.onTint} /> : null}
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

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    container: {
      gap: t.spacing.lg,
    },
    poster: {
      width: '100%',
      // The A4 pre-workout sheet would otherwise be taller than the screen.
      maxHeight: 360,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.photoBackground,
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
      gap: t.spacing.lg,
    },
    introText: {
      flex: 1,
      gap: t.spacing.xxs,
    },
    title: {
      ...t.typography.title1,
      color: t.colors.label,
    },
    subtitle: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    percent: {
      fontSize: 15,
      fontWeight: '700',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    stageCard: {
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    stageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: HIT,
      padding: t.spacing.lg,
    },
    stageTitle: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    stageDetail: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    arabicSmall: {
      ...t.typography.arabic,
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.labelSecondary,
    },
    footnote: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      paddingHorizontal: t.spacing.lg,
    },
    session: {
      gap: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
    sessionCard: {
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      paddingTop: t.spacing.lg,
    },
    nowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.lg,
      marginHorizontal: t.spacing.lg,
      padding: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
    },
    nowTime: {
      fontSize: 17,
      fontWeight: '700',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    nowEyebrow: {
      ...t.typography.footnote,
      fontSize: 12,
      color: t.colors.tint,
    },
    nowName: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    nowInstruction: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    nowControls: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      marginHorizontal: t.spacing.lg,
    },
    controlButton: {
      flex: 1,
      minHeight: HIT,
      borderRadius: t.radii.row,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs,
    },
    controlPrimary: {
      backgroundColor: t.colors.tint,
    },
    controlPrimaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.onTint,
    },
    controlSecondary: {
      backgroundColor: t.colors.surfaceRaised,
    },
    controlSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.link,
    },
    moveList: {
      marginTop: t.spacing.xs,
    },
    moveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: t.spacing.lg,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
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
      gap: t.spacing.md,
      minHeight: 52,
      paddingVertical: t.spacing.xs,
      paddingRight: t.spacing.lg,
    },
    moveName: {
      ...t.typography.body,
      color: t.colors.label,
    },
    moveNameCurrent: {
      fontWeight: '600',
      color: t.colors.tint,
    },
    moveNameDone: {
      color: t.colors.labelSecondary,
    },
    moveHold: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    checkMark: {
      width: 24,
      height: 24,
      borderRadius: t.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkMarkOn: {
      backgroundColor: t.colors.success,
    },
    checkMarkOff: {
      borderWidth: 2,
      borderColor: t.colors.surfaceHigh,
    },
    pressed: {
      opacity: 0.75,
    },
  }),
);
