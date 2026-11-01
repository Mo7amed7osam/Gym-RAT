import { useRouter } from 'expo-router';
import { ChevronRight, Play, RotateCcw, Settings } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachCard } from '@/components/CoachCard';
import { ExerciseGuideModal } from '@/components/ExerciseGuideModal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT } from '@/constants/theme';
import { estimateDurationMinutes, getTotalSets, isSessionForDay } from '@/data/plans';
import { PDF_PROGRAM_INFO } from '@/data/seeds/pdfProgram';
import { COACH_NOTES, WARMUP_STAGES } from '@/data/warmupData';
import { formatDuration, formatKg, formatLongDate, formatShortDate, formatWeekdayShort, percentChange, startOfWeek } from '@/lib/format';
import { countSets, formatSet, getExerciseBests, weeklyVolumeKg } from '@/lib/workoutMath';
import { useLocale, useT } from '@/i18n';
import { selectActivePlan, selectNextDay, selectPreviewedDay, useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import type { Plan, PlanDay, WorkoutSession } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function TodayDashboardScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{formatLongDate(now)}</Text>
            <Text style={styles.largeTitle} accessibilityRole="header">
              {t('today.title')}
            </Text>
          </View>
          {!isNext && day ? (
            <Pressable
              onPress={() => previewDay(null)}
              accessibilityRole="button"
              accessibilityLabel={t('today.backToNext')}
              style={styles.todayButton}
            >
              <RotateCcw size={16} color={theme.colors.link} />
              <Text style={styles.todayButtonText}>{t('today.nextUp')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('common.settings')}
            style={styles.settingsButton}
          >
            <Settings size={20} color={theme.colors.labelSecondary} />
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
            <Text style={styles.heroEyebrow}>{t('today.noPlanEyebrow')}</Text>
            <Text style={styles.heroTitle}>{t('today.noPlanTitle')}</Text>
            <Text style={styles.secondary}>{t('today.noPlanBody')}</Text>
          </View>
        )}

        <WeekCalendar weekStart={weekStartDate} now={now} history={history} />

        <View style={styles.stats}>
          <StatCard
            label={t('today.thisWeek')}
            value={formatKg(thisWeekVolume)}
            detail={volumeDelta === null ? t('today.totalVolume') : t('today.vsLastWeek', { delta: `${volumeDelta >= 0 ? '+' : ''}${volumeDelta}` })}
            detailTone={volumeDelta !== null && volumeDelta >= 0 ? 'success' : 'neutral'}
          />
          <StatCard label={t('today.sessions')} value={String(sessionsThisWeek)} detail={t('today.thisWeek')} />
        </View>

        {day ? (
          <>
            <View style={styles.section}>
              <SectionHeader title={t('today.warmup')} />
              <View style={styles.group}>
                {WARMUP_STAGES.map((stage, index) => (
                  <View key={stage.id} style={[styles.groupRow, index < WARMUP_STAGES.length - 1 && styles.divider]}>
                    <Text style={styles.stageIndex}>{stage.order}</Text>
                    <Text style={[styles.body, styles.flex]}>{stage.title.en}</Text>
                    <Text style={styles.secondary}>
                      {stage.durationMinutes
                        ? t('today.stageMinutes', { min: stage.durationMinutes.min, max: stage.durationMinutes.max })
                        : stage.routineId
                          ? t('today.stageMoves')
                          : t('today.stageFirstLift')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader title={t('today.exercises')} />
              <ExerciseList day={day} history={history} onOpen={setVideoExerciseId} />
            </View>
          </>
        ) : null}

        <CoachCard now={now.getTime()} />

        <View style={styles.coachNote}>
          <Text style={styles.coachLabel}>{t('today.coachNote')}</Text>
          <Text style={styles.coachText}>{COACH_NOTES[0].en}</Text>
        </View>
      </ScrollView>

      <ExerciseGuideModal exerciseId={videoExerciseId} onClose={() => setVideoExerciseId(null)} />
      <ConfirmDialog
        visible={confirmDiscard}
        title={t('today.discardTitle')}
        message={t('today.discardMessage')}
        confirmLabel={t('common.discard')}
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
  const styles = useStyles();
  const t = useT();
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
            accessibilityLabel={`${t('today.dayA11y', { code: day.code, n: day.position + 1, total: plan.days.length })}${isNext ? t('today.nextUpSuffix') : ''}`}
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
  const styles = useStyles();
  const t = useT();
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
    <View style={styles.weekStrip} accessible accessibilityLabel={t('today.weekA11y', { count: doneDays.size })}>
      {Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart.getTime() + index * DAY_MS);
        const isToday = date.toDateString() === now.toDateString();
        return (
          <View key={index} style={[styles.weekDay, isToday && styles.weekDayToday]}>
            <Text style={styles.weekDayLabel}>{formatWeekdayShort(date)}</Text>
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
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const isActiveDay = activeSession !== null && isSessionForDay(activeSession, plan, day);
  const sessionSets = isActiveDay && activeSession ? countSets(activeSession) : null;
  const progress = sessionSets && sessionSets.total > 0 ? sessionSets.completed / sessionSets.total : 0;
  const lastSession = history.find((session) => session.status === 'completed' && isSessionForDay(session, plan, day));

  let ctaLabel = isNext ? t('today.startWorkout') : t('today.startInstead', { code: day.code });
  if (isActiveDay) ctaLabel = t('today.resumeWorkout');
  else if (activeSession) ctaLabel = t('today.resumeCode', { code: activeSession.code });

  const preview = day.exercises.slice(0, 5);
  const hiddenCount = day.exercises.length - preview.length;
  const locale = useLocale();
  const focusLabel = day.focus ? t('today.focusDay', { focus: PDF_PROGRAM_INFO.focusLabels[day.focus][locale] }) : plan.name[locale];

  return (
    <View style={styles.hero}>
      <View style={styles.heroMeta}>
        <Text style={styles.heroEyebrow}>{`${isNext ? t('common.upNext') : t('today.preview')} · ${focusLabel}`}</Text>
        <Text style={styles.heroDay}>{t('today.dayOf', { n: day.position + 1, total: plan.days.length })}</Text>
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
          <ProgressRing size={76} strokeWidth={8} progress={progress} color={theme.colors.tint}>
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
        <Figure value={String(day.exercises.length)} label={t('today.figExercises')} />
        <View style={styles.figureRule} />
        <Figure value={String(getTotalSets(day))} label={t('today.figSets')} />
        <View style={styles.figureRule} />
        <Figure value={`~${estimateDurationMinutes(day)}`} label={t('today.figMinutes')} />
      </View>

      {lastSession?.summary ? (
        <Text style={styles.lastSession}>
          {t('today.lastTime', {
            date: formatShortDate(lastSession.startedAt),
            volume: formatKg(lastSession.summary.totalVolumeKg),
            duration: formatDuration(lastSession.summary.durationSeconds),
          })}
        </Text>
      ) : null}

      <Button
        label={ctaLabel}
        icon={Play}
        onPress={onStart}
        disabled={!canStart}
        accessibilityHint={canStart ? undefined : t('today.finishFirst')}
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
  const styles = useStyles();
  const t = useT();
  const { completed, total } = countSets(session);
  return (
    <View style={styles.resume}>
      <View style={styles.flex}>
        <Text style={styles.headline}>{t('today.inProgress', { code: session.code })}</Text>
        <Text style={styles.secondaryNums}>{t('today.setsLogged', { completed, total })}</Text>
      </View>
      <Button label={t('common.discard')} variant="destructive" onPress={onDiscard} style={styles.resumeButton} />
      <Button label={t('common.resume')} variant="tinted" onPress={onResume} style={styles.resumeButton} />
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
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const exerciseMap = useExerciseMap();
  return (
    <View style={styles.group}>
      {day.exercises.map((item, index) => {
        const exercise = exerciseMap.get(item.exerciseId);
        const best = getExerciseBests(history, item.exerciseId).bestSet;
        const reps = item.reps.min === item.reps.max ? item.reps.min : `${item.reps.min}–${item.reps.max}`;
        return (
          <Pressable
            key={`${item.exerciseId}-${index}`}
            onPress={() => onOpen(item.exerciseId)}
            accessibilityRole="button"
            accessibilityLabel={t('today.exerciseA11y', { name: exercise?.name.en ?? item.exerciseId, sets: item.sets, reps })}
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
                {best ? <Text style={styles.best}>{t('today.best', { set: formatSet(best) })}</Text> : null}
              </View>
            </View>
            <ChevronRight size={18} color={theme.colors.labelTertiary} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
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
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}. ${detail}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statDetail, detailTone === 'success' && { color: theme.colors.success }]}>{detail}</Text>
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
    content: {
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.xxxl * 2,
      gap: t.spacing.xl,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: t.spacing.md,
    },
    eyebrow: {
      ...t.typography.footnote,
      color: t.colors.labelSecondary,
    },
    largeTitle: {
      ...t.typography.largeTitle,
      color: t.colors.label,
    },
    todayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: HIT,
      paddingHorizontal: 14,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surface,
    },
    settingsButton: {
      width: HIT,
      height: HIT,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.link,
    },
    rotation: {
      gap: t.spacing.sm,
      paddingVertical: 2,
    },
    rotationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surface,
    },
    rotationChipSelected: {
      backgroundColor: t.colors.tint,
    },
    rotationIndex: {
      fontFamily: t.fonts.display,
      fontSize: 20,
      lineHeight: 22,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    rotationCode: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.label,
    },
    weekStrip: {
      flexDirection: 'row',
      gap: 6,
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: t.spacing.sm,
      minHeight: HIT,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
    },
    weekDayToday: {
      borderWidth: 1,
      borderColor: t.colors.tint,
    },
    weekDayLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: t.colors.labelSecondary,
    },
    weekDayNumber: {
      fontFamily: t.fonts.display,
      fontSize: 22,
      lineHeight: 24,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    todayNumber: {
      color: t.colors.tint,
    },
    onTint: {
      color: t.colors.onTint,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: t.radii.pill,
    },
    dotRest: {
      borderWidth: 1,
      borderColor: t.colors.surfaceHigh,
    },
    dotDone: {
      backgroundColor: t.colors.success,
    },
    resume: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.lg,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.tintMuted,
    },
    resumeButton: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
    },
    hero: {
      padding: t.spacing.xl,
      paddingTop: t.spacing.lg,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: t.spacing.lg,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
    },
    heroText: {
      gap: 2,
    },
    heroEyebrow: {
      ...t.typography.footnote,
      color: t.colors.tint,
    },
    heroTitle: {
      ...t.typography.display,
      color: t.colors.label,
    },
    ringText: {
      fontFamily: t.fonts.display,
      fontSize: 22,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    lastSession: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    stats: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    statCard: {
      flex: 1,
      padding: t.spacing.lg,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: 2,
    },
    statLabel: {
      ...t.typography.footnote,
      fontSize: 12,
      color: t.colors.labelSecondary,
    },
    statValue: {
      fontFamily: t.fonts.display,
      fontSize: 34,
      lineHeight: 38,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    statDetail: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    section: {
      gap: t.spacing.sm,
    },
    group: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: HIT,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    stageIndex: {
      width: 22,
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 76,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
    },
    exerciseMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
    },
    best: {
      ...t.typography.subheadline,
      color: t.colors.success,
      fontVariant: ['tabular-nums'],
    },
    headline: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    body: {
      ...t.typography.body,
      color: t.colors.label,
    },
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    secondaryNums: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    arabic: {
      ...t.typography.arabic,
      color: t.colors.labelSecondary,
    },
    coachNote: {
      gap: t.spacing.xxs,
      paddingLeft: t.spacing.md,
      marginHorizontal: t.spacing.xs,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.tint,
    },
    pressed: {
      opacity: 0.7,
    },
    heroMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: -t.spacing.sm,
    },
    heroDay: {
      ...t.typography.footnote,
      fontWeight: '500',
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    heroMuscles: {
      ...t.typography.headline,
      fontWeight: '500',
      color: t.colors.label,
      opacity: 0.85,
    },
    arabicStart: {
      textAlign: 'left',
      alignSelf: 'flex-start',
    },
    previewRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    previewMore: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewMoreText: {
      fontFamily: t.fonts.display,
      fontSize: 20,
      color: t.colors.labelSecondary,
    },
    figures: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: t.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.separator,
    },
    figure: {
      flex: 1,
      alignItems: 'center',
    },
    figureRule: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.separator,
    },
    figureValue: {
      fontFamily: t.fonts.display,
      fontSize: 30,
      lineHeight: 32,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    figureLabel: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    exerciseText: {
      gap: 3,
    },
    exerciseName: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    coachLabel: {
      ...t.typography.footnote,
      color: t.colors.tint,
    },
    coachText: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
  }),
);
