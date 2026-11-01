import { useRouter } from 'expo-router';
import { ChevronRight, Play, RotateCcw, Settings } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoModal } from '@/components/VideoModal';
import { WarmupRoutine } from '@/components/WarmupRoutine';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT, colors, fonts, radii, spacing, typography } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import {
  PROGRAM_INFO,
  WEEKDAYS,
  WEEKLY_SCHEDULE,
  estimateDurationMinutes,
  getTotalSets,
  getTrainingDays,
  weekdayFromDate,
} from '@/data/scheduleData';
import { COACH_NOTES, WARMUP_STAGES } from '@/data/warmupData';
import { formatDuration, formatKg, formatLongDate, formatShortDate, isSameDay, percentChange, startOfProgramWeek } from '@/lib/format';
import { countSets, formatSet, getExerciseBests, weeklyVolumeKg } from '@/lib/workoutMath';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { CardioDay, RestDay, TrainingDay, Weekday, WorkoutSession } from '@/types/workout';

const TRAINING_DAYS = getTrainingDays();
const DAY_MS = 24 * 60 * 60 * 1000;

export default function TodayDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [videoExerciseId, setVideoExerciseId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const selectedWeekday = useWorkoutStore((state) => state.selectedWeekday);
  const history = useWorkoutStore((state) => state.history);
  const activeSession = useWorkoutStore((state) => state.activeSession);
  const selectWeekday = useWorkoutStore((state) => state.selectWeekday);
  const startWorkout = useWorkoutStore((state) => state.startWorkout);
  const cancelWorkout = useWorkoutStore((state) => state.cancelWorkout);

  const todayWeekday = weekdayFromDate(now);
  const weekday = selectedWeekday ?? todayWeekday;
  const isToday = weekday === todayWeekday;
  const day = WEEKLY_SCHEDULE[weekday];
  const weekStart = useMemo(() => startOfProgramWeek(now), [now]);

  const doneThisWeek = useMemo(() => {
    const done = new Set<Weekday>();
    for (const session of history) {
      if (session.status === 'completed' && Date.parse(session.startedAt) >= weekStart.getTime()) {
        done.add(weekdayFromDate(new Date(session.startedAt)));
      }
    }
    return done;
  }, [history, weekStart]);

  const [lastWeekVolume, thisWeekVolume] = useMemo(() => weeklyVolumeKg(history, 2, now), [history, now]);
  const volumeDelta = percentChange(thisWeekVolume, lastWeekVolume);
  const sessionsThisWeek = history.filter(
    (session) => session.status === 'completed' && Date.parse(session.startedAt) >= weekStart.getTime(),
  ).length;

  const handleStart = () => {
    if (activeSession) {
      router.push('/workout');
      return;
    }
    const result = startWorkout(weekday);
    if (result.ok) router.push('/workout');
  };

  const selectDay = (next: Weekday) => selectWeekday(next === todayWeekday ? null : next);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>
              {formatLongDate(isToday ? now : new Date(weekStart.getTime() + day.dayIndex * DAY_MS))}
            </Text>
            <Text style={styles.largeTitle} accessibilityRole="header">
              {isToday ? 'Today' : day.weekdayName.en}
            </Text>
          </View>
          {!isToday ? (
            <Pressable
              onPress={() => selectWeekday(null)}
              accessibilityRole="button"
              accessibilityLabel="Back to today"
              style={styles.todayButton}
            >
              <RotateCcw size={16} color={colors.link} />
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.settingsButton}
          >
            <Settings size={20} color={colors.labelSecondary} />
          </Pressable>
        </View>

        <WeekStrip
          weekStart={weekStart}
          selected={weekday}
          today={todayWeekday}
          done={doneThisWeek}
          onSelect={selectDay}
        />

        {/* The hero's own CTA already resumes when it shows the active routine. */}
        {activeSession && !(day.kind === 'training' && day.routineId === activeSession.routineId) ? (
          <ResumeBanner
            session={activeSession}
            onResume={() => router.push('/workout')}
            onDiscard={() => setConfirmDiscard(true)}
          />
        ) : null}

        {day.kind === 'training' ? (
          <TrainingHero
            day={day}
            history={history}
            activeSession={activeSession}
            now={now}
            canStart={isToday || !activeSession}
            onStart={handleStart}
          />
        ) : day.kind === 'cardio' ? (
          <CardioHero day={day} />
        ) : (
          <RestHero day={day} />
        )}

        <View style={styles.stats}>
          <StatCard
            label="This week"
            value={formatKg(thisWeekVolume)}
            detail={volumeDelta === null ? 'Total volume' : `${volumeDelta >= 0 ? '+' : ''}${volumeDelta}% vs last week`}
            detailTone={volumeDelta !== null && volumeDelta >= 0 ? 'success' : 'neutral'}
          />
          <StatCard
            label="Sessions"
            value={`${sessionsThisWeek} / ${TRAINING_DAYS.length}`}
            detail="Training days done"
          />
        </View>

        {day.kind === 'training' ? (
          <>
            <View style={styles.section}>
              <SectionHeader title="Warm-up" />
              <View style={styles.group}>
                {WARMUP_STAGES.map((stage, index) => (
                  <View key={stage.id} style={[styles.groupRow, index < WARMUP_STAGES.length - 1 && styles.divider]}>
                    <Text style={styles.stageIndex}>{stage.order}</Text>
                    <Text style={[styles.body, styles.flex]}>{stage.title.en}</Text>
                    <Text style={styles.secondary}>
                      {stage.durationMinutes
                        ? `${stage.durationMinutes.min}–${stage.durationMinutes.max} min`
                        : stage.routineId
                          ? '9 moves'
                          : 'first lift'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader title="Exercises" />
              <ExerciseList day={day} history={history} onOpen={setVideoExerciseId} />
            </View>
          </>
        ) : null}

        <View style={styles.coachNote}>
          <Text style={styles.coachLabel}>Coach&apos;s note</Text>
          <Text style={styles.coachText}>{COACH_NOTES[0].en}</Text>
        </View>
      </ScrollView>

      <VideoModal exerciseId={videoExerciseId} onClose={() => setVideoExerciseId(null)} />
      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard workout?"
        message="Logged sets from this session will be lost."
        confirmLabel="Discard"
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          cancelWorkout();
          setConfirmDiscard(false);
        }}
      />
    </View>
  );
}

// ─── Week strip ──────────────────────────────────────────────────────────────

function WeekStrip({
  weekStart,
  selected,
  today,
  done,
  onSelect,
}: {
  weekStart: Date;
  selected: Weekday;
  today: Weekday;
  done: ReadonlySet<Weekday>;
  onSelect: (weekday: Weekday) => void;
}) {
  return (
    <View style={styles.weekStrip} accessibilityRole="tablist">
      {WEEKDAYS.map((weekday, index) => {
        const schedule = WEEKLY_SCHEDULE[weekday];
        const date = new Date(weekStart.getTime() + index * DAY_MS);
        const isSelected = weekday === selected;
        const dotStyle = done.has(weekday)
          ? styles.dotDone
          : schedule.kind === 'cardio'
            ? styles.dotCardio
            : schedule.kind === 'rest'
              ? styles.dotRest
              : styles.dotTraining;
        return (
          <Pressable
            key={weekday}
            onPress={() => onSelect(weekday)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${schedule.weekdayName.en}, ${schedule.kind === 'training' ? schedule.code : schedule.title.en}${done.has(weekday) ? ', done' : ''}${weekday === today ? ', today' : ''}`}
            style={[styles.weekDay, isSelected && styles.weekDaySelected]}
          >
            <Text style={[styles.weekDayLabel, isSelected && styles.onTint]}>
              {schedule.weekdayName.en.slice(0, 3)}
            </Text>
            <Text style={[styles.weekDayNumber, isSelected && styles.onTint, weekday === today && !isSelected && styles.todayNumber]}>
              {date.getDate()}
            </Text>
            <View style={[styles.dot, dotStyle, isSelected && styles.dotOnTint]} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Hero cards ──────────────────────────────────────────────────────────────

function TrainingHero({
  day,
  history,
  activeSession,
  now,
  canStart,
  onStart,
}: {
  day: TrainingDay;
  history: readonly WorkoutSession[];
  activeSession: WorkoutSession | null;
  now: Date;
  canStart: boolean;
  onStart: () => void;
}) {
  const dayNumber = TRAINING_DAYS.findIndex((item) => item.routineId === day.routineId) + 1;
  const completedToday = history.some(
    (session) => session.routineId === day.routineId && session.status === 'completed' && isSameDay(new Date(session.startedAt), now),
  );
  const isActiveRoutine = activeSession?.routineId === day.routineId;
  const sessionSets = isActiveRoutine && activeSession ? countSets(activeSession) : null;
  const progress = completedToday ? 1 : sessionSets && sessionSets.total > 0 ? sessionSets.completed / sessionSets.total : 0;
  const lastSession = history.find((session) => session.routineId === day.routineId && session.status === 'completed');

  let ctaLabel = 'Start workout';
  if (isActiveRoutine) ctaLabel = 'Resume workout';
  else if (activeSession) ctaLabel = `Resume ${activeSession.code}`;
  else if (completedToday) ctaLabel = 'Train again';

  const showRing = completedToday || isActiveRoutine;
  const preview = day.exercises.slice(0, 5);
  const hiddenCount = day.exercises.length - preview.length;

  return (
    <View style={styles.hero}>
      <View style={styles.heroMeta}>
        <Text style={styles.heroEyebrow}>{PROGRAM_INFO.focusLabels[day.focus].en} day</Text>
        <Text style={styles.heroDay}>
          Day {dayNumber} of {TRAINING_DAYS.length}
        </Text>
      </View>

      <View style={styles.heroTop}>
        <View style={[styles.flex, styles.heroText]}>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {day.code}
          </Text>
          <Text style={styles.heroMuscles}>{day.muscleSummary.en}</Text>
          <Text style={[styles.arabic, styles.arabicStart]} accessibilityLanguage="ar">
            {day.muscleSummary.ar}
          </Text>
        </View>
        {showRing ? (
          <ProgressRing size={76} strokeWidth={8} progress={progress} color={completedToday ? colors.success : colors.tint}>
            <Text style={styles.ringText}>{Math.round(progress * 100)}%</Text>
          </ProgressRing>
        ) : null}
      </View>

      <View style={styles.previewRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {preview.map((item) => (
          <ExerciseThumb key={item.exerciseId} exerciseId={item.exerciseId} fill />
        ))}
        {hiddenCount > 0 ? (
          <View style={styles.previewMore}>
            <Text style={styles.previewMoreText}>+{hiddenCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.figures}>
        <Figure value={String(day.exercises.length)} label="exercises" />
        <View style={styles.figureRule} />
        <Figure value={String(getTotalSets(day))} label="sets" />
        <View style={styles.figureRule} />
        <Figure value={`~${estimateDurationMinutes(day)}`} label="minutes" />
      </View>

      {lastSession?.summary ? (
        <Text style={styles.lastSession}>
          Last time {formatShortDate(lastSession.startedAt)}: {formatKg(lastSession.summary.totalVolumeKg)} in{' '}
          {formatDuration(lastSession.summary.durationSeconds)}
        </Text>
      ) : null}

      <Button
        label={ctaLabel}
        icon={Play}
        onPress={onStart}
        disabled={!canStart}
        accessibilityHint={canStart ? undefined : 'Finish or discard the active workout first'}
      />
    </View>
  );
}

function CardioHero({ day }: { day: CardioDay }) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const toggle = (id: string) =>
    setCompletedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={[styles.heroEyebrow, { color: colors.link }]}>Cardio · Recovery</Text>
          <Text style={styles.heroTitle}>{day.title.en}</Text>
          <Text style={styles.arabic} accessibilityLanguage="ar">
            {day.title.ar}
          </Text>
          <Text style={styles.secondary}>
            {day.durationMinutes.min}–{day.durationMinutes.max} min easy · pick one
          </Text>
        </View>
        <View style={styles.groupInset}>
          {day.activities.map((activity, index) => (
            <View key={activity.id} style={[styles.groupRow, index < day.activities.length - 1 && styles.divider]}>
              <View style={styles.flex}>
                <Text style={styles.body}>{activity.name.en}</Text>
                <Text style={styles.secondary}>{activity.intensity.en}</Text>
              </View>
              <Text style={styles.secondary}>
                {activity.durationMinutes.min}–{activity.durationMinutes.max}′
              </Text>
            </View>
          ))}
        </View>
      </View>
      <WarmupRoutine variant="cooldown" completedIds={completedIds} onToggle={toggle} />
    </>
  );
}

function RestHero({ day }: { day: RestDay }) {
  const next = WEEKLY_SCHEDULE[WEEKDAYS[(day.dayIndex + 1) % WEEKDAYS.length]];
  return (
    <View style={styles.hero}>
      <View style={styles.heroText}>
        <Text style={[styles.heroEyebrow, { color: colors.labelSecondary }]}>Rest</Text>
        <Text style={styles.heroTitle}>{day.title.en}</Text>
        <Text style={styles.arabic} accessibilityLanguage="ar">
          {day.note.ar}
        </Text>
        <Text style={styles.secondary}>{day.note.en}</Text>
      </View>
      <Text style={styles.lastSession}>
        Next: {next.weekdayName.en} · {next.kind === 'training' ? next.code : next.title.en}
      </Text>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function ResumeBanner({
  session,
  onResume,
  onDiscard,
}: {
  session: WorkoutSession;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { completed, total } = countSets(session);
  return (
    <View style={styles.resume}>
      <View style={styles.flex}>
        <Text style={styles.headline}>{session.code} in progress</Text>
        <Text style={styles.secondaryNums}>
          {completed} of {total} sets logged
        </Text>
      </View>
      <Button label="Discard" variant="destructive" onPress={onDiscard} style={styles.resumeButton} />
      <Button label="Resume" variant="tinted" onPress={onResume} style={styles.resumeButton} />
    </View>
  );
}

function ExerciseList({
  day,
  history,
  onOpen,
}: {
  day: TrainingDay;
  history: readonly WorkoutSession[];
  onOpen: (exerciseId: string) => void;
}) {
  return (
    <View style={styles.group}>
      {day.exercises.map((item, index) => {
        const exercise = getExercise(item.exerciseId);
        const best = getExerciseBests(history, item.exerciseId).bestSet;
        const reps = item.reps.min === item.reps.max ? item.reps.min : `${item.reps.min}–${item.reps.max}`;
        return (
          <Pressable
            key={item.exerciseId}
            onPress={() => onOpen(item.exerciseId)}
            accessibilityRole="button"
            accessibilityLabel={`${exercise?.name.en ?? item.exerciseId}, ${item.sets} sets of ${reps}. Open form guide`}
            style={({ pressed }) => [styles.exerciseRow, index < day.exercises.length - 1 && styles.divider, pressed && styles.pressed]}
          >
            <ExerciseThumb exerciseId={item.exerciseId} />
            <View style={[styles.flex, styles.exerciseText]}>
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exercise?.name.en ?? item.exerciseId}
              </Text>
              <View style={styles.exerciseMeta}>
                <Text style={styles.secondaryNums}>
                  {item.sets} × {reps}
                </Text>
                {best ? <Text style={styles.best}>Best {formatSet(best)}</Text> : null}
              </View>
            </View>
            <ChevronRight size={18} color={colors.labelTertiary} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  detail,
  detailTone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  detailTone?: 'neutral' | 'success';
}) {
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}. ${detail}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statDetail, detailTone === 'success' && { color: colors.success }]}>{detail}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: colors.label,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: HIT,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  settingsButton: {
    width: HIT,
    height: HIT,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.link,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    minHeight: HIT,
    borderRadius: radii.tile,
    backgroundColor: colors.surface,
  },
  weekDaySelected: {
    backgroundColor: colors.tint,
  },
  weekDayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.labelSecondary,
  },
  weekDayNumber: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  todayNumber: {
    color: colors.tint,
  },
  onTint: {
    color: colors.onTint,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  dotTraining: {
    backgroundColor: colors.surfaceHigh,
  },
  dotCardio: {
    backgroundColor: colors.link,
  },
  dotRest: {
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  dotDone: {
    backgroundColor: colors.success,
  },
  dotOnTint: {
    backgroundColor: colors.onTint,
    borderColor: colors.onTint,
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.sheet,
    backgroundColor: colors.tintMuted,
  },
  resumeButton: {
    minHeight: HIT,
    paddingHorizontal: spacing.md,
  },
  hero: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroText: {
    gap: 2,
  },
  heroEyebrow: {
    ...typography.footnote,
    color: colors.tint,
  },
  heroTitle: {
    ...typography.display,
    color: colors.label,
  },
  ringText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  lastSession: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
    gap: 2,
  },
  statLabel: {
    ...typography.footnote,
    fontSize: 12,
    color: colors.labelSecondary,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  statDetail: {
    ...typography.caption,
    color: colors.labelSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  group: {
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
    overflow: 'hidden',
  },
  groupInset: {
    borderRadius: radii.tile,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  stageIndex: {
    width: 22,
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  best: {
    ...typography.subheadline,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  headline: {
    ...typography.headline,
    color: colors.label,
  },
  body: {
    ...typography.body,
    color: colors.label,
  },
  secondary: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  secondaryNums: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  arabic: {
    ...typography.arabic,
    color: colors.labelSecondary,
  },
  coachNote: {
    gap: spacing.xxs,
    paddingLeft: spacing.md,
    marginHorizontal: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.tint,
  },
  pressed: {
    opacity: 0.7,
  },
  heroMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -spacing.sm,
  },
  heroDay: {
    ...typography.footnote,
    fontWeight: '500',
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  heroMuscles: {
    ...typography.headline,
    fontWeight: '500',
    color: colors.label,
    opacity: 0.85,
  },
  arabicStart: {
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewMore: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.row,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMoreText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.labelSecondary,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  figure: {
    flex: 1,
    alignItems: 'center',
  },
  figureRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  figureValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  figureLabel: {
    ...typography.caption,
    color: colors.labelSecondary,
  },
  exerciseText: {
    gap: 3,
  },
  exerciseName: {
    ...typography.headline,
    color: colors.label,
  },
  coachLabel: {
    ...typography.footnote,
    color: colors.tint,
  },
  coachText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
});
