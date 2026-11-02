import { ChevronRight, Pencil } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExerciseVideo } from '@/components/ExerciseVideo';
import { ExerciseIllustration } from '@/components/ui/ExerciseIllustration';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/data/exercisesData';
import { getExerciseMedia } from '@/data/media';
import { curatedVideo } from '@/data/youtubeVideos';
import { computeExerciseRecords } from '@/domain/records';
import { rankSubstitutes } from '@/domain/substitution';
import { useLocale, useT } from '@/i18n';
import { formatDayMonthYear } from '@/lib/analyticsFormat';
import { formatKg } from '@/lib/format';
import { RECORD_KIND_LABEL_KEY, formatRecordPrevious, formatRecordValue } from '@/lib/recordFormat';
import { formatSet, getExerciseBests, getPreviousPerformance, isCountedSet } from '@/lib/workoutMath';
import { selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { Exercise } from '@/types/workout';

const REST_OPTIONS: (number | null)[] = [null, 60, 90, 120, 150, 180];

interface ExerciseDetailProps {
  exercise: Exercise;
  onOpenExercise: (exerciseId: string) => void;
  onEdit?: () => void;
}

/**
 * Everything the Library knows about one exercise: illustration, muscles,
 * technique, mistakes, alternatives, the user's notes and rest preference,
 * and their history with it. Shared by the Library route and the in-workout guide sheet.
 */
export function ExerciseDetail({ exercise, onOpenExercise, onEdit }: ExerciseDetailProps) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const history = useWorkoutStore((state) => state.history);
  const activePlan = useWorkoutStore(selectActivePlan);
  const updateExerciseUser = useWorkoutStore((state) => state.updateExerciseUser);
  const [notes, setNotes] = useState(exercise.userNotes);

  const media = getExerciseMedia(exercise);
  const bests = useMemo(() => getExerciseBests(history, exercise.id), [history, exercise.id]);
  const previous = useMemo(() => getPreviousPerformance(history, exercise.id), [history, exercise.id]);
  const sessionCount = useMemo(
    () => history.filter((session) => session.exercises.some((item) => item.exerciseId === exercise.id && item.sets.some(isCountedSet))).length,
    [history, exercise.id],
  );
  const usedIn = useMemo(
    () => (activePlan?.days ?? []).filter((day) => day.exercises.some((item) => item.exerciseId === exercise.id)).map((day) => day.code),
    [activePlan, exercise.id],
  );
  const hiddenRecordKinds = useWorkoutStore((state) => state.settings.hiddenRecordKinds);
  const records = useMemo(() => computeExerciseRecords(history, exercise.id, exercise.weightType), [history, exercise.id, exercise.weightType]);
  const allExercises = useWorkoutStore((state) => state.exercises);
  const ranked = useMemo(() => rankSubstitutes(exercise, allExercises), [exercise, allExercises]);
  const alternatives = ranked.filter((item) => item.listed || item.equivalence === 'equivalent').slice(0, 6);
  const formatDate = (iso: string) => formatDayMonthYear(new Date(iso));

  const commitNotes = () => {
    if (notes !== exercise.userNotes) updateExerciseUser(exercise.id, { userNotes: notes });
  };

  return (
    <View style={styles.root}>
      <ExerciseIllustration exercise={exercise} variant="full" />
      {media.attribution ? <Text style={styles.attribution}>{t('library.attribution')}</Text> : null}

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {exercise.name.en}
          </Text>
          {onEdit ? (
            <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={t('library.detail.edit')} hitSlop={8} style={styles.iconButton}>
              <Pencil size={18} color={theme.colors.link} />
            </Pressable>
          ) : null}
        </View>
        {exercise.name.ar && exercise.name.ar !== exercise.name.en ? (
          <Text style={styles.arabic} accessibilityLanguage="ar">
            {exercise.name.ar}
          </Text>
        ) : null}
        <View style={styles.chips}>
          {exercise.origin === 'custom' ? <Chip label={t('library.customBadge')} tone="link" /> : null}
          {exercise.archived ? <Chip label={t('library.archivedBadge')} /> : null}
          {exercise.equipment.map((item) => (
            <Chip key={item} label={EQUIPMENT_LABELS[item][locale]} />
          ))}
          <Chip label={t(`library.weightType.${exercise.weightType}`)} tone="tint" />
          {exercise.isUnilateral ? <Chip label={t('library.detail.unilateral')} tone="success" /> : null}
        </View>
        {usedIn.length > 0 ? <Text style={styles.secondary}>{t('library.detail.programmedIn', { days: usedIn.join(', ') })}</Text> : null}
        {exercise.archived ? <Text style={styles.notice}>{t('library.detail.archivedNotice')}</Text> : null}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('library.detail.muscles')} />
        <View style={styles.card}>
          <LabelRow label={t('library.detail.primary')} value={exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m][locale]).join(' · ')} />
          {exercise.secondaryMuscles.length > 0 ? (
            <LabelRow label={t('library.detail.secondary')} value={exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m][locale]).join(' · ')} last />
          ) : null}
        </View>
      </View>

      {exercise.instructions.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t('library.detail.instructions')} />
          <View style={styles.card}>
            {exercise.instructions.map((step, index) => (
              <View key={index} style={[styles.step, index < exercise.instructions.length - 1 && styles.divider]}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.body}>{step[locale] || step.en}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {exercise.breathing || exercise.rangeOfMotion ? (
        <View style={styles.section}>
          <View style={styles.card}>
            {exercise.breathing ? <LabelRow label={t('library.detail.breathing')} value={exercise.breathing[locale] || exercise.breathing.en} last={!exercise.rangeOfMotion} /> : null}
            {exercise.rangeOfMotion ? <LabelRow label={t('library.detail.rangeOfMotion')} value={exercise.rangeOfMotion[locale] || exercise.rangeOfMotion.en} last /> : null}
          </View>
        </View>
      ) : null}

      {exercise.commonMistakes.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t('library.detail.mistakes')} />
          <View style={styles.card}>
            {exercise.commonMistakes.map((item, index) => (
              <View key={index} style={[styles.step, index < exercise.commonMistakes.length - 1 && styles.divider]}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.body}>{item[locale] || item.en}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {alternatives.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t('library.detail.alternatives')} />
          <View style={styles.card}>
            {alternatives.map((item, index) => (
              <Pressable
                key={item.exercise.id}
                onPress={() => onOpenExercise(item.exercise.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.linkRow, index < alternatives.length - 1 && styles.divider, pressed && styles.pressed]}
              >
                <Text style={[styles.body, styles.flex]}>{item.exercise.name.en}</Text>
                <Chip
                  label={t(`library.equivalence.${item.equivalence}`)}
                  tone={item.equivalence === 'equivalent' ? 'success' : item.equivalence === 'similar' ? 'tint' : 'neutral'}
                />
                <ChevronRight size={18} color={theme.colors.labelTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={t('library.detail.restPreference')} />
        <View style={styles.chipRow}>
          {REST_OPTIONS.map((seconds) => (
            <SelectChip
              key={seconds ?? 'plan'}
              label={seconds === null ? t('library.detail.restPlan') : t('library.detail.restSeconds', { n: seconds })}
              selected={exercise.userRestSeconds === seconds}
              onPress={() => updateExerciseUser(exercise.id, { userRestSeconds: seconds })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('library.detail.notes')} />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onEndEditing={commitNotes}
          onBlur={commitNotes}
          multiline
          placeholder={t('library.detail.notesPlaceholder')}
          placeholderTextColor={theme.colors.labelTertiary}
          accessibilityLabel={t('library.detail.notes')}
          style={styles.notes}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('coach.records.title')} />
        <View style={styles.card}>
          {!records.topWeight && records.repsAtWeight.length === 0 ? (
            <Text style={[styles.secondary, styles.padded]}>{t('coach.records.none')}</Text>
          ) : (
            <>
              {records.topWeight && !hiddenRecordKinds.includes('top_weight') ? (
                <LabelRow label={t('coach.records.topWeight')} value={`${formatKg(records.topWeight.value)} · ${formatDate(records.topWeight.date)}`} />
              ) : null}
              {records.bestEstimated1rm && !hiddenRecordKinds.includes('estimated_1rm') ? (
                <LabelRow label={t('coach.records.estimated1rm')} value={`${formatKg(records.bestEstimated1rm.value)} · ${formatDate(records.bestEstimated1rm.date)}`} />
              ) : null}
              {records.bestSetVolume && !hiddenRecordKinds.includes('set_volume') ? (
                <LabelRow label={t('coach.records.setVolume')} value={`${formatKg(records.bestSetVolume.value)} · ${formatDate(records.bestSetVolume.date)}`} />
              ) : null}
              {!hiddenRecordKinds.includes('reps_at_weight') ? (
                <LabelRow label={t('coach.records.repsAtWeight')} value={records.repsAtWeight.slice(0, 3).map((item) => formatRecordValue('reps_at_weight', item.value, item.weightKg)).join(' · ')} last={records.events.length === 0} />
              ) : null}
              {records.events.length > 0 ? (
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{t('coach.records.history')}</Text>
                  {[...records.events]
                    .reverse()
                    .filter((event) => !hiddenRecordKinds.includes(event.kind))
                    .slice(0, 8)
                    .map((event) => (
                      <Text key={`${event.kind}-${event.setId}`} style={styles.secondary}>
                        {formatDate(event.date)} · {t(RECORD_KIND_LABEL_KEY[event.kind])}: {formatRecordValue(event.kind, event.value, event.weightKg)}
                        {event.previous !== null ? ` (${t('history.wasLabel', { previous: formatRecordPrevious(event.kind, event.previous) })})` : ''}
                      </Text>
                    ))}
                </View>
              ) : null}
            </>
          )}
          <Text style={[styles.secondary, styles.padded]}>{t('coach.records.estimateNote')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('library.detail.history')} />
        <View style={styles.card}>
          <LabelRow label={t('library.detail.bestSet')} value={bests.bestSet ? formatSet(bests.bestSet) : t('library.detail.never')} />
          <LabelRow
            label={t('library.detail.lastDone')}
            value={previous ? formatDate(previous.session.startedAt) : t('library.detail.never')}
          />
          <LabelRow label={t('library.detail.sessions', { count: sessionCount })} value="" last />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('library.detail.video')} />
        <ExerciseVideo video={exercise.origin === 'builtin' ? curatedVideo(exercise.id) : null} />
      </View>
    </View>
  );
}

function LabelRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.labelRow, !last && styles.divider]}>
      <Text style={styles.label}>{label}</Text>
      {value ? <Text style={[styles.body, styles.flex]}>{value}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.xl },
    flex: { flex: 1, minWidth: 0 },
    attribution: { ...t.typography.caption, color: t.colors.labelTertiary, marginTop: -t.spacing.md },
    titleBlock: { gap: t.spacing.sm },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm },
    title: { ...t.typography.title1, color: t.colors.label, flex: 1 },
    iconButton: { minWidth: HIT, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
    arabic: { ...t.typography.arabic, color: t.colors.labelSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    secondary: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    notice: { ...t.typography.footnote, color: t.colors.tint },
    section: { gap: t.spacing.sm },
    card: {
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
      paddingHorizontal: t.spacing.lg,
    },
    padded: { paddingVertical: t.spacing.md },
    step: { flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.md, alignItems: 'flex-start' },
    stepNumber: { ...t.typography.headline, color: t.colors.tint, width: 20, fontVariant: ['tabular-nums'] },
    bullet: { ...t.typography.headline, color: t.colors.labelTertiary, width: 20 },
    body: { ...t.typography.body, color: t.colors.label, flex: 1 },
    labelRow: { paddingVertical: t.spacing.md, gap: t.spacing.xxs },
    label: { ...t.typography.footnote, color: t.colors.labelSecondary },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: HIT, paddingVertical: t.spacing.sm },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    pressed: { opacity: 0.6 },
    notes: {
      ...t.typography.body,
      color: t.colors.label,
      minHeight: 96,
      padding: t.spacing.lg,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
      textAlignVertical: 'top',
    },
  }),
);
