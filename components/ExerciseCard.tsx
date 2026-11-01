import { CirclePlay, Dumbbell, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { EXERCISE_IMAGES, exerciseImageAspect } from '@/assets/exercises';

import { Chip } from '@/components/ui/Chip';
import { SET_GRID_COLUMNS, SetRow } from '@/components/SetRow';
import { HIT } from '@/constants/theme';
import { MUSCLE_LABELS, getExercise } from '@/data/exercisesData';
import { hapticSelection, hapticSetCompleted } from '@/lib/feedback';
import { formatSet, getExerciseBests, getPreviousSetAt } from '@/lib/workoutMath';
import { formatRestTime } from '@/store/useRestTimerCountdown';
import { selectPreviousExercise, useWorkoutStore, type SetValues } from '@/store/useWorkoutStore';
import type { Equipment, RestPeriod, SessionExercise } from '@/types/workout';
import { createStyles, useTheme } from '@/theme';

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  ez_bar: 'EZ Bar',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bench: 'Bench',
  bodyweight: 'Bodyweight',
};

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
  onOpenVideo: (exerciseId: string) => void;
}

export function ExerciseCard({ sessionExercise, position, total, onOpenVideo }: ExerciseCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const exercise = getExercise(sessionExercise.exerciseId);
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
  const imageSource = exercise?.thumbnailKey ? EXERCISE_IMAGES[exercise.thumbnailKey] : null;
  // Box the photo at its own shape so the whole start→finish sequence shows uncropped;
  // clamp very tall shots so the set grid stays above the fold.
  const imageAspect = exercise?.thumbnailKey ? Math.max(exerciseImageAspect(exercise.thumbnailKey), 1.2) : null;
  const cues = exercise?.formCues.slice(0, 2) ?? [];
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
        <Text style={styles.eyebrow}>
          Exercise {position} of {total}
        </Text>
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
            <Chip key={muscle} label={MUSCLE_LABELS[muscle].en} />
          ))}
          {exercise?.equipment[0] ? <Chip label={EQUIPMENT_LABELS[exercise.equipment[0]]} tone="link" /> : null}
        </View>
      </View>

      <Pressable
        onPress={() => onOpenVideo(sessionExercise.exerciseId)}
        accessibilityRole="button"
        accessibilityLabel={`Watch form tutorial for ${name}`}
        style={({ pressed }) => [
          styles.thumbnail,
          imageSource && styles.thumbnailPhoto,
          imageAspect !== null && { aspectRatio: imageAspect },
          pressed && styles.pressed,
        ]}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <>
            <Dumbbell size={56} color={theme.colors.surfaceHigh} strokeWidth={1.5} />
            <View style={styles.thumbnailCues}>
              {cues.map((cue) => (
                <Text key={cue} style={styles.thumbnailCue} numberOfLines={1}>
                  • {cue}
                </Text>
              ))}
            </View>
          </>
        )}
        <View style={styles.playBadge}>
          <CirclePlay size={18} color={theme.colors.link} />
          <Text style={styles.playText}>Form video</Text>
        </View>
      </Pressable>

      {imageSource && cues.length > 0 ? (
        <View style={styles.cues}>
          {cues.map((cue) => (
            <Text key={cue} style={styles.thumbnailCue} numberOfLines={2}>
              • {cue}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.stats}>
        <Stat label="Target" value={`${prescription.sets} × ${formatRepRange(prescription.reps.min, prescription.reps.max)}`} />
        <Stat label="Rest" value={formatRest(prescription.rest)} />
        <Stat label="Best" value={bests.bestSet ? formatSet(bests.bestSet) : '—'} />
      </View>

      <View style={styles.grid}>
        <View style={styles.gridHeader} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[styles.columnLabel, { width: SET_GRID_COLUMNS.set }]}>Set</Text>
          <Text style={[styles.columnLabel, styles.previousColumn]}>Previous</Text>
          <Text style={[styles.columnLabel, styles.centered, { width: SET_GRID_COLUMNS.weight }]}>kg</Text>
          <Text style={[styles.columnLabel, styles.centered, { width: SET_GRID_COLUMNS.reps }]}>Reps</Text>
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
          accessibilityLabel="Add set"
          style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
        >
          <Plus size={18} color={theme.colors.link} strokeWidth={2.25} />
          <Text style={styles.footerText}>Add set</Text>
        </Pressable>
        <Pressable
          onPress={() => firstIncompleteWorkingSet && handleToggleType(firstIncompleteWorkingSet.id)}
          disabled={!firstIncompleteWorkingSet}
          accessibilityRole="button"
          accessibilityLabel="Mark next set as warm-up"
          accessibilityState={{ disabled: !firstIncompleteWorkingSet }}
          style={({ pressed }) => [
            styles.footerButton,
            !firstIncompleteWorkingSet && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.footerText}>Mark warm-up</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatRepRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
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
    thumbnail: {
      height: 168,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
    },
    thumbnailPhoto: {
      height: undefined,
      width: '100%',
      // PDF photos are shot on white; match it so `contain` letterboxing is invisible.
      backgroundColor: t.colors.photoBackground,
      paddingHorizontal: 0,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    cues: {
      gap: 2,
      marginTop: -t.spacing.sm,
      paddingHorizontal: t.spacing.xxs,
    },
    thumbnailCues: {
      alignSelf: 'stretch',
      gap: 2,
    },
    thumbnailCue: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    playBadge: {
      position: 'absolute',
      top: t.spacing.md,
      right: t.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      minHeight: 32,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.background,
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
