import { Redirect, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, Star } from 'lucide-react-native';
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
import { VideoModal } from '@/components/VideoModal';
import { WarmupRoutine, getRoutineProgress } from '@/components/WarmupRoutine';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { HIT, colors, fonts, radii, spacing, typography } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import { ROUTINES } from '@/data/scheduleData';
import { formatDuration, formatElapsed, formatKg, formatLongDate, formatTime, percentChange } from '@/lib/format';
import { countSets } from '@/lib/workoutMath';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { PersonalRecord, SessionExercise, WorkoutSession } from '@/types/workout';

type Stage = 'warmup' | 'exercises';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'warmup', label: 'Warm-up' },
  { id: 'exercises', label: 'Workout' },
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

/** Ticks on its own so the rest of the runner doesn't re-render every second. */
function ElapsedLabel({ startedAt, completed, total }: { startedAt: string; completed: number; total: number }) {
  const now = useNow(1000);
  const elapsedSeconds = (now - Date.parse(startedAt)) / 1000;
  return (
    <Text style={styles.topElapsed} accessibilityLabel={`${formatElapsed(elapsedSeconds)} elapsed, ${completed} of ${total} sets`}>
      {formatElapsed(elapsedSeconds)}
    </Text>
  );
}

const isExerciseDone = (exercise: SessionExercise) => exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);

function ActiveWorkout({ session, onFinished }: { session: WorkoutSession; onFinished: (session: WorkoutSession) => void }) {
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
  const finishWorkout = useWorkoutStore((state) => state.finishWorkout);
  const cancelWorkout = useWorkoutStore((state) => state.cancelWorkout);

  const day = ROUTINES[session.routineId];
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
          accessibilityLabel="Minimise workout"
          style={styles.iconButton}
        >
          <ChevronDown size={24} color={colors.label} />
        </Pressable>
        <View style={styles.topTitle}>
          <Text style={styles.topCode}>{session.code}</Text>
          <ElapsedLabel startedAt={session.startedAt} completed={completed} total={total} />
        </View>
        <Pressable onPress={requestFinish} accessibilityRole="button" style={styles.finishButton}>
          <Text style={styles.finishText}>Finish</Text>
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
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{item.label}</Text>
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
                      accessibilityLabel={`Exercise ${i + 1}, ${getExercise(exercise.exerciseId)?.name.en ?? ''}${done ? ', done' : ''}${exercise.skipped ? ', skipped' : ''}`}
                      style={[styles.navChip, selected && styles.navChipSelected, exercise.skipped && styles.navChipSkipped]}
                    >
                      <ExerciseThumb exerciseId={exercise.exerciseId} size={44} />
                      {done ? (
                        <View style={styles.navChipDone}>
                          <Check size={18} strokeWidth={3} color={colors.label} />
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
                onOpenVideo={setVideoExerciseId}
              />

              {next ? (
                <View style={styles.upNext}>
                  <ExerciseThumb exerciseId={next.exerciseId} size={48} />
                  <View style={styles.flex}>
                    <Text style={styles.upNextLabel}>Up next</Text>
                    <Text style={styles.upNextName} numberOfLines={1}>
                      {getExercise(next.exerciseId)?.name.en}
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
                  <Text style={styles.linkText}>{current.skipped ? 'Unskip exercise' : 'Skip exercise'}</Text>
                </Pressable>
                <Pressable onPress={() => setConfirm('discard')} accessibilityRole="button" style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: colors.destructive }]}>Discard workout</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <RestTimerPill onExpand={() => setDismissedRestKey(null)} />
        {stage === 'warmup' ? (
          <Button
            label={getRoutineProgress(session.warmupCompletedIds) >= 1 ? `Begin ${session.code}` : `Skip to ${session.code}`}
            onPress={() => setStage('exercises')}
          />
        ) : null}
        {stage === 'exercises' ? (
          <View style={styles.navButtons}>
            <Pressable
              onPress={() => goToExercise(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous exercise"
              accessibilityState={{ disabled: index === 0 }}
              style={[styles.prevButton, index === 0 && styles.disabled]}
            >
              <ChevronLeft size={22} color={colors.label} />
            </Pressable>
            <Button
              label={isLastExercise ? 'Finish workout' : 'Next exercise'}
              variant={current && isExerciseDone(current) ? 'primary' : 'tinted'}
              onPress={advance}
              style={styles.flex}
            />
          </View>
        ) : null}
      </View>

      <RestTimerModal visible={restSheetVisible} onMinimize={() => setDismissedRestKey(restKey)} />
      <VideoModal exerciseId={videoExerciseId} onClose={() => setVideoExerciseId(null)} />
      <ConfirmDialog
        visible={confirm === 'finish'}
        title="Finish workout?"
        message={`${total - completed} of ${total} sets aren't logged yet. They won't count toward volume.`}
        confirmLabel="Finish"
        onCancel={() => setConfirm(null)}
        onConfirm={finish}
      />
      <ConfirmDialog
        visible={confirm === 'discard'}
        title="Discard workout?"
        message="Everything logged in this session will be deleted."
        confirmLabel="Discard"
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

const PR_LABEL: Record<PersonalRecord['kind'], string> = {
  top_weight: 'Top weight',
  estimated_1rm: 'Est. 1RM',
};

function WorkoutCompleteModal({ session, onDone }: { session: WorkoutSession; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const history = useWorkoutStore((state) => state.history);
  const summary = session.summary;

  const previousVolume = useMemo(
    () =>
      history.find((item) => item.id !== session.id && item.routineId === session.routineId && item.status === 'completed')
        ?.summary?.totalVolumeKg ?? 0,
    [history, session.id, session.routineId],
  );

  if (!summary) return null;
  const change = percentChange(summary.totalVolumeKg, previousVolume);
  const progress = summary.totalSets > 0 ? summary.completedSets / summary.totalSets : 0;
  const exercisesDone = session.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).length;

  return (
    <Modal visible animationType="fade" onRequestClose={onDone}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.xxl }]}>
        <ScrollView contentContainerStyle={styles.summaryContent}>
          <View style={styles.summaryHeader}>
            <ProgressRing size={132} strokeWidth={12} progress={progress} color={colors.success}>
              <Text style={styles.summaryPercent}>{Math.round(progress * 100)}%</Text>
            </ProgressRing>
            <Text style={styles.summaryTitle} accessibilityRole="header">
              {session.code} complete
            </Text>
            <Text style={styles.summaryDate}>
              {formatLongDate(new Date(session.startedAt))} · {formatTime(session.startedAt)}
              {session.finishedAt ? ` – ${formatTime(session.finishedAt)}` : ''}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryTile
              label="Volume"
              value={formatKg(summary.totalVolumeKg)}
              detail={change === null ? 'First time logged' : `${change >= 0 ? '+' : ''}${change}% vs last ${session.code}`}
              positive={change !== null && change >= 0}
            />
            <SummaryTile label="Sets" value={`${summary.completedSets} / ${summary.totalSets}`} detail={`${exercisesDone} exercises`} />
            <SummaryTile
              label="Duration"
              value={formatDuration(summary.durationSeconds)}
              detail={session.warmupCompletedIds.length > 0 ? 'with warm-up' : 'no warm-up'}
            />
            <SummaryTile label="New PRs" value={String(summary.personalRecords.length)} detail="vs all history" positive={summary.personalRecords.length > 0} />
          </View>

          {summary.personalRecords.length > 0 ? (
            <View style={styles.prList}>
              {summary.personalRecords.map((record, i) => (
                <View
                  key={`${record.exerciseId}:${record.kind}`}
                  style={[styles.prRow, i < summary.personalRecords.length - 1 && styles.divider]}
                >
                  <View style={styles.prStar}>
                    <Star size={16} color={colors.tint} fill={colors.tint} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {getExercise(record.exerciseId)?.name.en}
                    </Text>
                    <Text style={styles.prDetail}>
                      {PR_LABEL[record.kind]} · was {record.previous ?? '—'} kg
                    </Text>
                  </View>
                  <Text style={styles.prValue}>{record.value} kg</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Button label="Done" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

function SummaryTile({ label, value, detail, positive = false }: { label: string; value: string; detail: string; positive?: boolean }) {
  return (
    <View style={styles.summaryTile} accessible accessibilityLabel={`${label} ${value}. ${detail}`}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={styles.summaryTileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.summaryTileDetail, positive && { color: colors.success }]}>{detail}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
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
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.label,
  },
  topElapsed: {
    ...typography.caption,
    fontSize: 13,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    minHeight: HIT,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  finishText: {
    ...typography.headline,
    color: colors.tint,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  segmentSelected: {
    backgroundColor: colors.surfaceHigh,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.labelSecondary,
  },
  segmentTextSelected: {
    fontWeight: '600',
    color: colors.label,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  navigator: {
    gap: spacing.sm,
    padding: 3,
  },
  navChip: {
    borderRadius: radii.row + 4,
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
    borderRadius: radii.row,
    backgroundColor: 'rgba(48,209,88,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navChipSelected: {
    borderColor: colors.tint,
  },
  navChipSkipped: {
    opacity: 0.35,
  },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
  },
  upNextLabel: {
    ...typography.caption,
    color: colors.labelSecondary,
  },
  upNextName: {
    ...typography.headline,
    flex: 1,
    color: colors.label,
  },
  upNextMeta: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkButton: {
    minHeight: HIT,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.link,
  },
  bottomBar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.background,
  },
  navButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prevButton: {
    width: 56,
    minHeight: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  summaryContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.xxl,
  },
  summaryHeader: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryPercent: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  summaryTitle: {
    ...typography.largeTitle,
    color: colors.label,
    marginTop: spacing.sm,
  },
  summaryDate: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryTile: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.lg,
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
    gap: 2,
  },
  summaryTileLabel: {
    ...typography.footnote,
    fontSize: 12,
    color: colors.labelSecondary,
  },
  summaryTileValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  summaryTileDetail: {
    ...typography.caption,
    color: colors.labelSecondary,
  },
  prList: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  prStar: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.tintMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prName: {
    ...typography.headline,
    color: colors.label,
  },
  prDetail: {
    ...typography.caption,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  prValue: {
    ...typography.headline,
    color: colors.tint,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 3,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.tint,
  },
});
