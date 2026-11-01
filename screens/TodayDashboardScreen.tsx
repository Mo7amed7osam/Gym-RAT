import { useRouter } from 'expo-router';
import { ChevronRight, Play, RotateCcw, Settings } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoModal } from '@/components/VideoModal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT, colors, fonts, radii, spacing, typography } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';
import { estimateDurationMinutes, getTotalSets, isSessionForDay } from '@/data/plans';
import { PDF_PROGRAM_INFO } from '@/data/seeds/pdfProgram';
import { COACH_NOTES, WARMUP_STAGES } from '@/data/warmupData';
import { formatDuration, formatKg, formatLongDate, formatShortDate, percentChange, startOfWeek } from '@/lib/format';
import { countSets, formatSet, getExerciseBests, weeklyVolumeKg } from '@/lib/workoutMath';
import { selectActivePlan, selectNextDay, selectPreviewedDay, useWorkoutStore } from '@/store/useWorkoutStore';
import type { Plan, PlanDay, WorkoutSession } from '@/types/workout';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TodayDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [videoExerciseId, setVideoExerciseId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const history = useWorkoutStore((state) => state.history);
  const activeSession = useWorkoutStore((state) => state.activeSession);
  const weekStart = useWorkoutStore((state) => state.settings.weekStart);
  const plan = useWorkoutStore(selectActivePlan);
  const nextDay = useWorkoutStore(selectNextDay);
  const day = useWorkoutStore(selectPreviewedDay);
  const previewDay = useWorkoutStore((state) => state.previewDay);
  const startWorkout = useWorkoutStore((state) => state.startWorkout);
  const cancelWorkout = useWorkoutStore((state) => state.cancelWorkout);

  const weekStartDate = useMemo(() => startOfWeek(now, weekStart), [now, weekStart]);
  const isNext = day !== null && day.id === nextDay?.id;

  const [lastWeekVolume, thisWeekVolume] = useMemo(() => weeklyVolumeKg(history, 2, now, weekStart), [history, now, weekStart]);
  const volumeDelta = percentChange(thisWeekVolume, lastWeekVolume);
  const sessionsThisWeek = history.filter(
    (session) => session.status === 'completed' && Date.parse(session.startedAt) >= weekStartDate.getTime(),
  ).length;

  const handleStart = () => {
    if (activeSession) {
      router.push('/workout');
      return;
    }
    if (!day) return;
    const result = startWorkout({ dayIndex: day.position });
    if (result.ok) router.push('/workout');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{formatLongDate(now)}</Text>
            <Text style={styles.largeTitle} accessibilityRole="header">
              Today
            </Text>
          </View>
          {!isNext && day ? (
            <Pressable
              onPress={() => previewDay(null)}
              accessibilityRole="button"
              accessibilityLabel="Back to the next workout"
              style={styles.todayButton}
            >
              <RotateCcw size={16} color={colors.link} />
              <Text style={styles.todayButtonText}>Next up</Text>
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

        {plan ? (
          <RotationStrip plan={plan} selectedDayId={day?.id ?? null} nextDayId={nextDay?.id ?? null} onSelect={previewDay} />
        ) : null}

        {/* The hero's own CTA already resumes when it shows the active session's day. */}
        {activeSession && !(plan && day && isSessionForDay(activeSession, plan, day)) ? (
          <ResumeBanner
            session={activeSession}
            onResume={() => router.push('/workout')}
            onDiscard={() => setConfirmDiscard(true)}
          />
        ) : null}

        {plan && day ? (
          <DayHero
            plan={plan}
            day={day}
            isNext={isNext}
            history={history}
            activeSession={activeSession}
            canStart={activeSession === null || isSessionForDay(activeSession, plan, day)}
            onStart={handleStart}
          />
        ) : (
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>No active plan</Text>
            <Text style={styles.heroTitle}>Set up</Text>
            <Text style={styles.secondary}>Choose a plan to start training. Plan setup arrives with onboarding.</Text>
          </View>
        )}

        <WeekCalendar weekStart={weekStartDate} now={now} history={history} />

        <View style={styles.stats}>
          <StatCard
            label="This week"
            value={formatKg(thisWeekVolume)}
            detail={volumeDelta === null ? 'Total volume' : `${volumeDelta >= 0 ? '+' : ''}${volumeDelta}% vs last week`}
            detailTone={volumeDelta !== null && volumeDelta >= 0 ? 'success' : 'neutral'}
          />
          <StatCard label="Sessions" value={String(sessionsThisWeek)} detail="This week" />
        </View>

        {day ? (
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

// ─── Rotation strip ──────────────────────────────────────────────────────────

/** The plan's days in rotation order. The next one is highlighted; tap any to preview it. */
function RotationStrip({
  plan,
  selectedDayId,
  nextDayId,
  onSelect,
}: {
  plan: Plan;
  selectedDayId: string | null;
  nextDayId: string | null;
  onSelect: (index: number | null) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rotation} accessibilityRole="tablist">
      {plan.days.map((day) => {
        const isSelected = day.id === selectedDayId;
        const isNext = day.id === nextDayId;
        return (
          <Pressable
            key={day.id}
            onPress={() => onSelect(isNext ? null : day.position)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${day.code}, day ${day.position + 1} of ${plan.days.length}${isNext ? ', next up' : ''}`}
            style={[styles.rotationChip, isSelected && styles.rotationChipSelected]}
          >
            <Text style={[styles.rotationIndex, isSelected && styles.onTint, isNext && !isSelected && styles.todayNumber]}>
              {day.position + 1}
            </Text>
            <Text style={[styles.rotationCode, isSelected && styles.onTint]} numberOfLines={1}>
              {day.code}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Week calendar ───────────────────────────────────────────────────────────

/** Seven days of the current week; a green dot marks days with a completed session (actual dates). */
function WeekCalendar({ weekStart, now, history }: { weekStart: Date; now: Date; history: readonly WorkoutSession[] }) {
  const doneDays = useMemo(() => {
    const done = new Set<number>();
    for (const session of history) {
      if (session.status !== 'completed') continue;
      const started = new Date(session.startedAt);
      const dayOffset = Math.floor((started.getTime() - weekStart.getTime()) / DAY_MS);
      if (dayOffset >= 0 && dayOffset < 7) done.add(dayOffset);
    }
    return done;
  }, [history, weekStart]);

  return (
    <View style={styles.weekStrip} accessible accessibilityLabel={`This week: ${doneDays.size} training days done`}>
      {Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart.getTime() + index * DAY_MS);
        const isToday = date.toDateString() === now.toDateString();
        return (
          <View key={index} style={[styles.weekDay, isToday && styles.weekDayToday]}>
            <Text style={styles.weekDayLabel}>{WEEKDAY_SHORT[date.getDay()]}</Text>
            <Text style={[styles.weekDayNumber, isToday && styles.todayNumber]}>{date.getDate()}</Text>
            <View style={[styles.dot, doneDays.has(index) ? styles.dotDone : styles.dotRest]} />
          </View>
        );
      })}
    </View>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function DayHero({
  plan,
  day,
  isNext,
  history,
  activeSession,
  canStart,
  onStart,
}: {
  plan: Plan;
  day: PlanDay;
  isNext: boolean;
  history: readonly WorkoutSession[];
  activeSession: WorkoutSession | null;
  canStart: boolean;
  onStart: () => void;
}) {
  const isActiveDay = activeSession !== null && isSessionForDay(activeSession, plan, day);
  const sessionSets = isActiveDay && activeSession ? countSets(activeSession) : null;
  const progress = sessionSets && sessionSets.total > 0 ? sessionSets.completed / sessionSets.total : 0;
  const lastSession = history.find((session) => session.status === 'completed' && isSessionForDay(session, plan, day));

  let ctaLabel = isNext ? 'Start workout' : `Start ${day.code} instead`;
  if (isActiveDay) ctaLabel = 'Resume workout';
  else if (activeSession) ctaLabel = `Resume ${activeSession.code}`;

  const preview = day.exercises.slice(0, 5);
  const hiddenCount = day.exercises.length - preview.length;
  const focusLabel = day.focus ? `${PDF_PROGRAM_INFO.focusLabels[day.focus].en} day` : plan.name.en;

  return (
    <View style={styles.hero}>
      <View style={styles.heroMeta}>
        <Text style={styles.heroEyebrow}>{isNext ? 'Up next' : 'Preview'} · {focusLabel}</Text>
        <Text style={styles.heroDay}>
          Day {day.position + 1} of {plan.days.length}
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
        {isActiveDay ? (
          <ProgressRing size={76} strokeWidth={8} progress={progress} color={colors.tint}>
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
  day: PlanDay;
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
            key={`${item.exerciseId}-${index}`}
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
  rotation: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  rotationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: HIT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  rotationChipSelected: {
    backgroundColor: colors.tint,
  },
  rotationIndex: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  rotationCode: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.label,
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
  weekDayToday: {
    borderWidth: 1,
    borderColor: colors.tint,
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
  dotRest: {
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  dotDone: {
    backgroundColor: colors.success,
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
