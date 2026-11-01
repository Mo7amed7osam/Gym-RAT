import { Redirect, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, Pause, Play, Star } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseCard } from '@/components/ExerciseCard';
import { RestTimerModal, RestTimerPill } from '@/components/RestTimerModal';
import { ExerciseGuideModal } from '@/components/ExerciseGuideModal';
import { WarmupRoutine, getRoutineProgress } from '@/components/WarmupRoutine';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { HIT } from '@/constants/theme';
import { isSessionForDay } from '@/data/plans';
import { formatDuration, formatElapsed, formatKg, formatLongDate, formatTime, percentChange } from '@/lib/format';
import { countSets } from '@/lib/workoutMath';
import { activeSeconds, isPaused } from '@/domain/session/reducer';
import { useT } from '@/i18n';
import { selectIsWorkoutPaused, selectNextDay, useWorkoutStore, useExerciseMap } from '@/store/useWorkoutStore';
import type { PersonalRecord, SessionExercise, WorkoutSession } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

type Stage = 'warmup' | 'exercises';

const STAGES: { id: Stage; labelKey: string }[] = [
  { id: 'warmup', labelKey: 'workout.stageWarmup' },
  { id: 'exercises', labelKey: 'workout.stageWorkout' },
];

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const session = useWorkoutStore((state) => state.activeSession);
  const [finished, setFinished] = useState<WorkoutSession | null>(null);

  if (finished) {
    return <WorkoutCompleteModal session={finished} onDone={() => router.replace('/')} />;
  }
  if (!session) return <Redirect href="/" />;
  return <ActiveWorkout session={session} onFinished={setFinished} />;
}

// ─── Live runner ─────────────────────────────────────────────────────────────

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Ticks on its own so the rest of the runner doesn't re-render every second. Shows active time (pauses excluded). */
function ElapsedLabel({ session, completed, total }: { session: WorkoutSession; completed: number; total: number }) {
  const t = useT();
  const styles = useStyles();
  const now = useNow(1000);
  const seconds = activeSeconds(session, now);
  const paused = isPaused(session);
  return (
    <Text
      style={[styles.topElapsed, paused && styles.topElapsedPaused]}
      accessibilityLabel={t('workout.elapsedA11y', { paused: paused ? `${t('workout.paused')}, ` : '', time: formatElapsed(seconds), completed, total })}
    >
      {`${paused ? `${t('workout.paused')} · ` : ''}${formatElapsed(seconds)}`}
    </Text>
  );
}

const isExerciseDone = (exercise: SessionExercise) => exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);

function ActiveWorkout({ session, onFinished }: { session: WorkoutSession; onFinished: (session: WorkoutSession) => void }) {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>(() =>
    session.exercises.some((exercise) => exercise.sets.some((set) => set.completed)) ? 'exercises' : 'warmup',
  );
  const [videoExerciseId, setVideoExerciseId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);
  const [dismissedRestKey, setDismissedRestKey] = useState<string | null>(null);

  const restKey = useWorkoutStore((state) => state.restTimer.context?.completedSetId ?? null);
  const toggleWarmupItem = useWorkoutStore((state) => state.toggleWarmupItem);
  const goToExercise = useWorkoutStore((state) => state.goToExercise);
  const setExerciseSkipped = useWorkoutStore((state) => state.setExerciseSkipped);
  const deferExercise = useWorkoutStore((state) => state.deferExercise);
  const finishWorkout = useWorkoutStore((state) => state.finishWorkout);
  const cancelWorkout = useWorkoutStore((state) => state.cancelWorkout);
  const pauseWorkout = useWorkoutStore((state) => state.pauseWorkout);
  const resumeWorkout = useWorkoutStore((state) => state.resumeWorkout);
  const paused = useWorkoutStore(selectIsWorkoutPaused);
  const exerciseMap = useExerciseMap();

  const day = { code: session.code, firstExerciseId: session.exercises[0]?.exerciseId };
  const index = session.currentExerciseIndex;
  const current = session.exercises[index];
  const next = session.exercises[index + 1];
  const isLastExercise = index >= session.exercises.length - 1;
  const { completed, total } = countSets(session);

  // The rest sheet opens for every newly logged set until the user minimises it.
  const restSheetVisible = restKey !== null && restKey !== dismissedRestKey;

  const finish = () => {
    setConfirm(null);
    const result = finishWorkout();
    if (result) onFinished(result);
  };

  const requestFinish = () => (completed < total ? setConfirm('finish') : finish());

  // After the last exercise the workout goes straight to the summary (no cool-down stage).
  const advance = () => {
    if (isLastExercise) requestFinish();
    else goToExercise(index + 1);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel={t('workout.minimise')}
          style={styles.iconButton}
        >
          <ChevronDown size={24} color={theme.colors.label} />
        </Pressable>
        <View style={styles.topTitle}>
          <Text style={styles.topCode}>{session.code}</Text>
          <ElapsedLabel session={session} completed={completed} total={total} />
        </View>
        <Pressable
          onPress={paused ? resumeWorkout : pauseWorkout}
          accessibilityRole="button"
          accessibilityLabel={paused ? t('workout.resume') : t('workout.pause')}
          style={styles.iconButton}
        >
          {paused ? <Play size={22} color={theme.colors.tint} fill={theme.colors.tint} /> : <Pause size={22} color={theme.colors.label} fill={theme.colors.label} />}
        </Pressable>
        <Pressable onPress={requestFinish} accessibilityRole="button" style={styles.finishButton}>
          <Text style={styles.finishText}>{t('common.finish')}</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.progressFill, { width: `${total > 0 ? (completed / total) * 100 : 0}%` }]} />
      </View>

      <View style={styles.segmented} accessibilityRole="tablist">
        {STAGES.map((item) => {
          const selected = item.id === stage;
          return (
            <Pressable
              key={item.id}
              onPress={() => setStage(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{t(item.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {stage === 'warmup' ? (
            <WarmupRoutine
              day={day}
              completedIds={session.warmupCompletedIds}
              onToggle={toggleWarmupItem}
            />
          ) : null}

          {stage === 'exercises' && current ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navigator}>
                {session.exercises.map((exercise, i) => {
                  const done = isExerciseDone(exercise);
                  const selected = i === index;
                  return (
                    <Pressable
                      key={exercise.id}
                      onPress={() => goToExercise(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t('workout.exerciseA11y', {
                        n: i + 1,
                        name: exerciseMap.get(exercise.exerciseId)?.name.en ?? '',
                        done: done ? t('workout.doneSuffix') : '',
                        skipped: exercise.skipped ? t('workout.skippedSuffix') : '',
                      })}
                      style={[styles.navChip, selected && styles.navChipSelected, exercise.skipped && styles.navChipSkipped]}
                    >
                      <ExerciseThumb exerciseId={exercise.exerciseId} size={44} />
                      {done ? (
                        <View style={styles.navChipDone}>
                          <Check size={18} strokeWidth={3} color={theme.colors.label} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <ExerciseCard
                key={current.id}
                sessionExercise={current}
                position={index + 1}
                total={session.exercises.length}
                onOpenGuide={setVideoExerciseId}
              />

              {next ? (
                <View style={styles.upNext}>
                  <ExerciseThumb exerciseId={next.exerciseId} size={48} />
                  <View style={styles.flex}>
                    <Text style={styles.upNextLabel}>{t('common.upNext')}</Text>
                    <Text style={styles.upNextName} numberOfLines={1}>
                      {exerciseMap.get(next.exerciseId)?.name.en}
                    </Text>
                  </View>
                  <Text style={styles.upNextMeta}>
                    {next.prescription.sets} × {next.prescription.reps.min}
                    {next.prescription.reps.max !== next.prescription.reps.min ? `–${next.prescription.reps.max}` : ''}
                  </Text>
                </View>
              ) : null}

              <View style={styles.linkRow}>
                <Pressable
                  onPress={() => setExerciseSkipped(current.id, !current.skipped)}
                  accessibilityRole="button"
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>{current.skipped ? t('workout.unskipExercise') : t('workout.skipExercise')}</Text>
                </Pressable>
                {!isLastExercise && !isExerciseDone(current) ? (
                  <Pressable
                    onPress={() => deferExercise(current.id)}
                    accessibilityRole="button"
                    accessibilityHint={t('workout.doLaterHint')}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkText}>{t('workout.doLater')}</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setConfirm('discard')} accessibilityRole="button" style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: theme.colors.destructive }]}>{t('workout.discardWorkout')}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        <RestTimerPill onExpand={() => setDismissedRestKey(null)} />
        {stage === 'warmup' ? (
          <Button
            label={getRoutineProgress(session.warmupCompletedIds) >= 1 ? t('workout.beginCode', { code: session.code }) : t('workout.skipToCode', { code: session.code })}
            onPress={() => setStage('exercises')}
          />
        ) : null}
        {stage === 'exercises' ? (
          <View style={styles.navButtons}>
            <Pressable
              onPress={() => goToExercise(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel={t('workout.previousExercise')}
              accessibilityState={{ disabled: index === 0 }}
              style={[styles.prevButton, index === 0 && styles.disabled]}
            >
              <ChevronLeft size={22} color={theme.colors.label} />
            </Pressable>
            <Button
              label={isLastExercise ? t('workout.finishWorkout') : t('workout.nextExercise')}
              variant={current && isExerciseDone(current) ? 'primary' : 'tinted'}
              onPress={advance}
              style={styles.flex}
            />
          </View>
        ) : null}
      </View>

      <RestTimerModal visible={restSheetVisible} onMinimize={() => setDismissedRestKey(restKey)} />
      <ExerciseGuideModal exerciseId={videoExerciseId} onClose={() => setVideoExerciseId(null)} />
      <ConfirmDialog
        visible={confirm === 'finish'}
        title={t('workout.finishTitle')}
        message={t('workout.finishMessage', { missing: total - completed, total })}
        confirmLabel={t('common.finish')}
        onCancel={() => setConfirm(null)}
        onConfirm={finish}
      />
      <ConfirmDialog
        visible={confirm === 'discard'}
        title={t('workout.discardTitle')}
        message={t('workout.discardMessage')}
        confirmLabel={t('common.discard')}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          cancelWorkout();
          router.replace('/');
        }}
      />
    </View>
  );
}

// ─── Completion modal ────────────────────────────────────────────────────────

const PR_LABEL_KEY: Record<PersonalRecord['kind'], string> = {
  top_weight: 'workout.prTopWeight',
  estimated_1rm: 'workout.prEstimated1rm',
};

function WorkoutCompleteModal({ session, onDone }: { session: WorkoutSession; onDone: () => void }) {
  const exerciseMap = useExerciseMap();
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const history = useWorkoutStore((state) => state.history);
  const nextDay = useWorkoutStore(selectNextDay);
  const setNextDay = useWorkoutStore((state) => state.setNextDay);
  const activePlan = useWorkoutStore((state) => state.plans.find((plan) => plan.kind === 'active') ?? null);
  const summary = session.summary;

  const thisDay = activePlan?.days.find((day) => isSessionForDay(session, activePlan, day)) ?? null;
  const thisDayIndex = thisDay?.position ?? -1;
  const previousVolume = useMemo(
    () =>
      history.find(
        (item) =>
          item.id !== session.id &&
          item.status === 'completed' &&
          (activePlan && thisDay ? isSessionForDay(item, activePlan, thisDay) : item.planDayId === session.planDayId),
      )?.summary?.totalVolumeKg ?? 0,
    [history, session.id, session.planDayId, activePlan, thisDay],
  );
  const repeatable = session.kind === 'plan' && thisDayIndex !== -1 && nextDay?.id !== session.planDayId;

  if (!summary) return null;
  const change = percentChange(summary.totalVolumeKg, previousVolume);
  const progress = summary.totalSets > 0 ? summary.completedSets / summary.totalSets : 0;
  const exercisesDone = session.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).length;

  return (
    <Modal visible animationType="fade" onRequestClose={onDone}>
      <View style={[styles.root, { paddingTop: insets.top + theme.spacing.xxl }]}>
        <ScrollView contentContainerStyle={styles.summaryContent}>
          <View style={styles.summaryHeader}>
            <ProgressRing size={132} strokeWidth={12} progress={progress} color={theme.colors.success}>
              <Text style={styles.summaryPercent}>{Math.round(progress * 100)}%</Text>
            </ProgressRing>
            <Text style={styles.summaryTitle} accessibilityRole="header">
              {t('workout.complete', { code: session.code })}
            </Text>
            <Text style={styles.summaryDate}>
              {formatLongDate(new Date(session.startedAt))} · {formatTime(session.startedAt)}
              {session.finishedAt ? ` – ${formatTime(session.finishedAt)}` : ''}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryTile
              label={t('workout.volume')}
              value={formatKg(summary.totalVolumeKg)}
              detail={change === null ? t('workout.firstTime') : t('workout.vsLast', { delta: `${change >= 0 ? '+' : ''}${change}`, code: session.code })}
              positive={change !== null && change >= 0}
            />
            <SummaryTile label={t('workout.sets')} value={`${summary.completedSets} / ${summary.totalSets}`} detail={t('workout.exercisesDone', { count: exercisesDone })} />
            <SummaryTile
              label={t('workout.duration')}
              value={formatDuration(summary.durationSeconds)}
              detail={
                summary.activeSeconds < summary.durationSeconds
                  ? t('workout.activeDetail', { time: formatDuration(summary.activeSeconds) })
                  : session.warmupCompletedIds.length > 0
                    ? t('workout.withWarmup')
                    : t('workout.noWarmup')
              }
            />
            <SummaryTile label={t('workout.newPrs')} value={String(summary.personalRecords.length)} detail={t('workout.vsAllHistory')} positive={summary.personalRecords.length > 0} />
          </View>

          {summary.personalRecords.length > 0 ? (
            <View style={styles.prList}>
              {summary.personalRecords.map((record, i) => (
                <View
                  key={`${record.exerciseId}:${record.kind}`}
                  style={[styles.prRow, i < summary.personalRecords.length - 1 && styles.divider]}
                >
                  <View style={styles.prStar}>
                    <Star size={16} color={theme.colors.tint} fill={theme.colors.tint} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {exerciseMap.get(record.exerciseId)?.name.en}
                    </Text>
                    <Text style={styles.prDetail}>{t('workout.prWas', { kind: t(PR_LABEL_KEY[record.kind]), previous: record.previous ?? t('common.none') })}</Text>
                  </View>
                  <Text style={styles.prValue}>{t('workout.prValue', { value: record.value })}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {nextDay ? (
            <View style={styles.nextUp}>
              <Text style={styles.upNextLabel}>{t('workout.nextInRotation')}</Text>
              <Text style={styles.upNextName}>{nextDay.code}</Text>
              {repeatable ? (
                <Pressable onPress={() => setNextDay(thisDayIndex)} accessibilityRole="button" style={styles.linkButton}>
                  <Text style={styles.linkText}>{t('workout.repeatInstead', { code: session.code })}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
          <Button label={t('common.done')} onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

function SummaryTile({ label, value, detail, positive = false }: { label: string; value: string; detail: string; positive?: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.summaryTile} accessible accessibilityLabel={`${label} ${value}. ${detail}`}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={styles.summaryTileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.summaryTileDetail, positive && { color: theme.colors.success }]}>{detail}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flex: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.sm,
      minHeight: 52,
    },
    iconButton: {
      width: HIT,
      height: HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topTitle: {
      flex: 1,
      alignItems: 'center',
    },
    topCode: {
      fontFamily: t.fonts.display,
      fontSize: 24,
      lineHeight: 26,
      color: t.colors.label,
    },
    topElapsed: {
      ...t.typography.caption,
      fontSize: 13,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    topElapsedPaused: {
      color: t.colors.tint,
    },
    nextUp: {
      padding: t.spacing.lg,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: 2,
    },
    finishButton: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      justifyContent: 'center',
    },
    finishText: {
      ...t.typography.headline,
      color: t.colors.tint,
    },
    segmented: {
      flexDirection: 'row',
      marginHorizontal: t.spacing.screen,
      marginBottom: t.spacing.sm,
      padding: 3,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surface,
    },
    segment: {
      flex: 1,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radii.pill,
    },
    segmentSelected: {
      backgroundColor: t.colors.surfaceHigh,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '500',
      color: t.colors.labelSecondary,
    },
    segmentTextSelected: {
      fontWeight: '600',
      color: t.colors.label,
    },
    content: {
      paddingHorizontal: t.spacing.screen,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxxl,
      gap: t.spacing.lg,
    },
    navigator: {
      gap: t.spacing.sm,
      padding: 3,
    },
    navChip: {
      borderRadius: t.radii.row + 4,
      padding: 2,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    navChipDone: {
      position: 'absolute',
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      borderRadius: t.radii.row,
      backgroundColor: 'rgba(48,209,88,0.78)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navChipSelected: {
      borderColor: t.colors.tint,
    },
    navChipSkipped: {
      opacity: 0.35,
    },
    upNext: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.md,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
    },
    upNextLabel: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    upNextName: {
      ...t.typography.headline,
      flex: 1,
      color: t.colors.label,
    },
    upNextMeta: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    linkButton: {
      minHeight: HIT,
      justifyContent: 'center',
      paddingHorizontal: t.spacing.lg,
    },
    linkText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.link,
    },
    bottomBar: {
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.screen,
      paddingTop: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.separator,
      backgroundColor: t.colors.background,
    },
    navButtons: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    prevButton: {
      width: 56,
      minHeight: 50,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      opacity: 0.4,
    },
    summaryContent: {
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.xxxl,
      gap: t.spacing.xxl,
    },
    summaryHeader: {
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    summaryPercent: {
      fontFamily: t.fonts.display,
      fontSize: 36,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    summaryTitle: {
      ...t.typography.largeTitle,
      color: t.colors.label,
      marginTop: t.spacing.sm,
    },
    summaryDate: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      textAlign: 'center',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    summaryTile: {
      flexBasis: '48%',
      flexGrow: 1,
      padding: t.spacing.lg,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: 2,
    },
    summaryTileLabel: {
      ...t.typography.footnote,
      fontSize: 12,
      color: t.colors.labelSecondary,
    },
    summaryTileValue: {
      fontFamily: t.fonts.display,
      fontSize: 30,
      lineHeight: 34,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    summaryTileDetail: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    prList: {
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
    },
    prRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 60,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    prStar: {
      width: 32,
      height: 32,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prName: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    prDetail: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    prValue: {
      ...t.typography.headline,
      color: t.colors.tint,
      fontVariant: ['tabular-nums'],
    },
    progressTrack: {
      height: 3,
      marginHorizontal: t.spacing.screen,
      marginBottom: t.spacing.md,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tint,
    },
  }),
);
