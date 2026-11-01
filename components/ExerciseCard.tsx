import { BookOpen, Ellipsis, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { ExerciseIllustration } from '@/components/ui/ExerciseIllustration';
import { SET_GRID_COLUMNS, SetRow } from '@/components/SetRow';
import { HIT } from '@/constants/theme';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/data/exercisesData';
import { hapticSelection, hapticSetCompleted } from '@/lib/feedback';
import { formatSet, getExerciseBests, getPreviousSetAt } from '@/lib/workoutMath';
import { useLocale, useT } from '@/i18n';
import { formatRestTime } from '@/store/useRestTimerCountdown';
import { selectPreviousExercise, useExercise, useWorkoutStore, type SetValues } from '@/store/useWorkoutStore';
import type { RestPeriod, SessionExercise } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

function formatRest(rest: RestPeriod): string {
  return rest.minSeconds === rest.maxSeconds
    ? formatRestTime(rest.defaultSeconds)
    : `${formatRestTime(rest.minSeconds)}–${formatRestTime(rest.maxSeconds)}`;
}

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
  /** 1-based position in the session, e.g. "2 of 9". */
  position: number;
  total: number;
  onOpenGuide: (exerciseId: string) => void;
  /** Opens the exercise options sheet (reorder, substitute, targets, set kinds…). Absent in previews. */
  onOpenOptions?: () => void;
}

export function ExerciseCard({ sessionExercise, position, total, onOpenGuide, onOpenOptions }: ExerciseCardProps) {
  const t = useT();
  const locale = useLocale();
  const styles = useStyles();
  const theme = useTheme();
  const exercise = useExercise(sessionExercise.exerciseId);
  const { prescription, sets } = sessionExercise;

  const previousExercise = useWorkoutStore(selectPreviousExercise(sessionExercise.exerciseId));
  const history = useWorkoutStore((state) => state.history);
  const hapticsEnabled = useWorkoutStore((state) => state.settings.hapticsEnabled);
  const updateSet = useWorkoutStore((state) => state.updateSet);
  const completeSet = useWorkoutStore((state) => state.completeSet);
  const uncompleteSet = useWorkoutStore((state) => state.uncompleteSet);
  const addSet = useWorkoutStore((state) => state.addSet);
  const removeSet = useWorkoutStore((state) => state.removeSet);
  const toggleSetType = useWorkoutStore((state) => state.toggleSetType);

  const bests = useMemo(() => getExerciseBests(history, sessionExercise.exerciseId), [history, sessionExercise.exerciseId]);
  const activeSetId = sets.find((item) => !item.completed)?.id ?? null;
  const firstIncompleteWorkingSet = sets.find((item) => !item.completed && item.type === 'working');

  const name = exercise?.name.en ?? sessionExercise.exerciseId;
  const cues = exercise?.instructions.slice(0, 2).map((step) => step[locale] || step.en) ?? [];
  const muscles = exercise ? [...exercise.primaryMuscles, ...exercise.secondaryMuscles].slice(0, 3) : [];

  const handleComplete = (setId: string, values: SetValues) => {
    completeSet(sessionExercise.id, setId, values);
    if (hapticsEnabled) hapticSetCompleted();
  };

  const handleToggleType = (setId: string) => {
    toggleSetType(sessionExercise.id, setId);
    if (hapticsEnabled) hapticSelection();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Text style={[styles.eyebrow, styles.flex]}>{t('exercise.position', { n: position, total })}</Text>
          {sessionExercise.groupKind ? <Chip label={t(sessionExercise.groupKind === 'giant' ? 'workout.giantBadge' : 'workout.groupBadge')} tone="tint" /> : null}
          {onOpenOptions ? (
            <Pressable onPress={onOpenOptions} accessibilityRole="button" accessibilityLabel={t('workout.optionsA11y', { name })} hitSlop={8} style={styles.optionsButton}>
              <Ellipsis size={20} color={theme.colors.labelSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {name}
        </Text>
        {exercise ? (
          <Text style={styles.arabic} accessibilityLanguage="ar">
            {exercise.name.ar}
          </Text>
        ) : null}
        <View style={styles.chips}>
          {muscles.map((muscle) => (
            <Chip key={muscle} label={MUSCLE_LABELS[muscle][locale]} />
          ))}
          {exercise?.equipment[0] ? <Chip label={EQUIPMENT_LABELS[exercise.equipment[0]][locale]} tone="link" /> : null}
        </View>
      </View>

      <Pressable
        onPress={() => onOpenGuide(sessionExercise.exerciseId)}
        accessibilityRole="button"
        accessibilityLabel={t('exercise.openGuide', { name })}
        style={({ pressed }) => [styles.guideRow, pressed && styles.pressed]}
      >
        <ExerciseIllustration exercise={exercise} variant="compact" style={styles.illustration} />
        <View style={styles.guideText}>
          {cues.map((cue) => (
            <Text key={cue} style={styles.thumbnailCue} numberOfLines={2}>
              • {cue}
            </Text>
          ))}
          <View style={styles.playBadge}>
            <BookOpen size={16} color={theme.colors.link} />
            <Text style={styles.playText}>{t('exercise.guide')}</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.stats}>
        <Stat label={t('exercise.target')} value={`${prescription.sets} × ${formatRepRange(prescription.reps.min, prescription.reps.max)}`} />
        <Stat label={t('exercise.rest')} value={formatRest(prescription.rest)} />
        <Stat label={t('exercise.best')} value={bests.bestSet ? formatSet(bests.bestSet) : t('common.none')} />
      </View>

      <View style={styles.grid}>
        <View style={styles.gridHeader} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[styles.columnLabel, { width: SET_GRID_COLUMNS.set }]}>{t('exercise.columnSet')}</Text>
          <Text style={[styles.columnLabel, styles.previousColumn]}>{t('exercise.columnPrevious')}</Text>
          <Text style={[styles.columnLabel, styles.centered, { width: SET_GRID_COLUMNS.weight }]}>{t('exercise.columnKg')}</Text>
          <Text style={[styles.columnLabel, styles.centered, { width: SET_GRID_COLUMNS.reps }]}>{t('exercise.columnReps')}</Text>
          <View style={{ width: SET_GRID_COLUMNS.check }} />
        </View>

        {sets.map((item, index) => (
          <SetRow
            key={item.id}
            set={item}
            previous={getPreviousSetAt(previousExercise, item.setNumber)}
            isActive={item.id === activeSetId}
            isLast={index === sets.length - 1}
            onCommit={(values) => updateSet(sessionExercise.id, item.id, values)}
            onComplete={(values) => handleComplete(item.id, values)}
            onUncomplete={() => uncompleteSet(sessionExercise.id, item.id)}
            onToggleType={() => handleToggleType(item.id)}
            onRemove={() => removeSet(sessionExercise.id, item.id)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => addSet(sessionExercise.id)}
          accessibilityRole="button"
          accessibilityLabel={t('exercise.addSet')}
          style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
        >
          <Plus size={18} color={theme.colors.link} strokeWidth={2.25} />
          <Text style={styles.footerText}>{t('exercise.addSet')}</Text>
        </Pressable>
        <Pressable
          onPress={() => firstIncompleteWorkingSet && handleToggleType(firstIncompleteWorkingSet.id)}
          disabled={!firstIncompleteWorkingSet}
          accessibilityRole="button"
          accessibilityLabel={t('exercise.markWarmupA11y')}
          accessibilityState={{ disabled: !firstIncompleteWorkingSet }}
          style={({ pressed }) => [
            styles.footerButton,
            !firstIncompleteWorkingSet && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.footerText}>{t('exercise.markWarmup')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatRepRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useT();
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={t('exercise.statA11y', { label, value })}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    container: {
      gap: t.spacing.lg,
    },
    header: {
      gap: t.spacing.xxs,
    },
    eyebrow: {
      ...t.typography.footnote,
      color: t.colors.tint,
    },
    title: {
      ...t.typography.title1,
      fontSize: 36,
      lineHeight: 38,
      color: t.colors.label,
    },
    arabic: {
      ...t.typography.arabic,
      fontSize: 15,
      color: t.colors.labelSecondary,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
    thumbnailCue: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    flex: { flex: 1, minWidth: 0 },
    optionsButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceRaised },
    guideRow: {
      flexDirection: 'row',
      gap: t.spacing.md,
      alignItems: 'stretch',
    },
    illustration: {
      width: 128,
      alignSelf: 'flex-start',
    },
    guideText: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'space-between',
      gap: t.spacing.xs,
      paddingVertical: t.spacing.xxs,
    },
    playBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.linkMuted,
    },
    playText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.colors.link,
    },
    stats: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    stat: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
    },
    statLabel: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    statValue: {
      fontFamily: t.fonts.display,
      fontSize: 24,
      lineHeight: 28,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    grid: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    gridHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    columnLabel: {
      ...t.typography.footnote,
      fontSize: 12,
      color: t.colors.labelSecondary,
    },
    previousColumn: {
      flex: 1,
    },
    centered: {
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    footerButton: {
      flex: 1,
      minHeight: HIT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surface,
    },
    footerText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.link,
    },
    disabled: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.7,
    },
  }),
);
