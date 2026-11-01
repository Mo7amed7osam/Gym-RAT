import { useRouter } from 'expo-router';
import { Archive, ArchiveRestore, Dumbbell, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { Card, ProgressBar, ScreenHeader } from '@/components/progress/parts';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { isCompleted } from '@/domain/analytics/aggregate';
import { addDays } from '@/domain/analytics/dates';
import {
  currentGoalValue,
  evaluateGoal,
  isRecurringGoal,
  newlyAchievedGoalIds,
  validateGoalInput,
  type GoalEvaluation,
  type GoalTarget,
} from '@/domain/analytics/goals';
import { useT } from '@/i18n';
import { formatDayMonthYear } from '@/lib/analyticsFormat';
import { parseWeight } from '@/lib/parseNumber';
import { useFocusNow } from '@/lib/useFocusNow';
import { useProgressStore } from '@/store/useProgressStore';
import { useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import { BODY_METRIC_KINDS, GOAL_KINDS, type BodyMetricKind, type Goal, type GoalKind } from '@/types/progress';

import { formatGoalValue, goalTitle, goalValueText } from './goalText';

const DEADLINE_WEEKS = [null, 4, 8, 12, 26] as const;
const MEASUREMENTS = BODY_METRIC_KINDS.filter((kind) => kind !== 'bodyweight');

/** Strength, body and weekly goals: progress against target, create, archive, delete. */
export default function GoalsScreen() {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useFocusNow();
  const exerciseMap = useExerciseMap();
  const history = useWorkoutStore((state) => state.history);
  const weekStart = useWorkoutStore((state) => state.settings.weekStart);
  const goals = useProgressStore((state) => state.goals);
  const bodyEntries = useProgressStore((state) => state.bodyEntries);
  const createGoal = useProgressStore((state) => state.createGoal);
  const setGoalArchived = useProgressStore((state) => state.setGoalArchived);
  const deleteGoal = useProgressStore((state) => state.deleteGoal);
  const markGoalsAchieved = useProgressStore((state) => state.markGoalsAchieved);

  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

  const completed = useMemo(() => history.filter(isCompleted), [history]);
  const context = useMemo(() => ({ history: completed, bodyEntries, now, weekStart }), [completed, bodyEntries, now, weekStart]);
  const evaluations = useMemo(() => goals.map((goal) => evaluateGoal(goal, context)), [goals, context]);
  const active = evaluations.filter((e) => !e.goal.archived && !(e.achieved && !isRecurringGoal(e.goal.kind)));
  const achieved = evaluations.filter((e) => !e.goal.archived && e.achieved && !isRecurringGoal(e.goal.kind));
  const archived = evaluations.filter((e) => e.goal.archived);

  useEffect(() => {
    const ids = newlyAchievedGoalIds(evaluations.filter((e) => !e.goal.archived));
    if (ids.length > 0) markGoalsAchieved(ids, new Date().toISOString());
  }, [evaluations, markGoalsAchieved]);

  const renderGoal = (evaluation: GoalEvaluation) => (
    <GoalCard
      key={evaluation.goal.id}
      evaluation={evaluation}
      title={goalTitle(evaluation.goal, t, exerciseMap)}
      onArchive={() => setGoalArchived(evaluation.goal.id, !evaluation.goal.archived)}
      onDelete={() => setPendingDelete(evaluation.goal)}
    />
  );

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title={t('progress.goals.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />

          {creating ? (
            <NewGoalForm context={context} onDone={() => setCreating(false)} createGoal={createGoal} />
          ) : (
            <Button label={t('progress.goals.add')} icon={Plus} onPress={() => setCreating(true)} />
          )}

          {active.length === 0 && achieved.length === 0 && !creating ? <Text style={styles.secondary}>{t('progress.goals.empty')}</Text> : null}
          {active.map(renderGoal)}

          {achieved.length > 0 ? (
            <>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {t('progress.goals.achievedSection')}
              </Text>
              {achieved.map(renderGoal)}
            </>
          ) : null}

          {archived.length > 0 ? (
            <Pressable onPress={() => setShowArchived(!showArchived)} accessibilityRole="button" style={styles.toggle}>
              <Text style={styles.link}>{t(showArchived ? 'progress.goals.hideArchived' : 'progress.goals.showArchived', { count: archived.length })}</Text>
            </Pressable>
          ) : null}
          {showArchived ? archived.map(renderGoal) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('progress.goals.deleteTitle')}
        message={pendingDelete ? goalTitle(pendingDelete, t, exerciseMap) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteGoal(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </View>
  );
}

function GoalCard({ evaluation, title, onArchive, onDelete }: { evaluation: GoalEvaluation; title: string; onArchive: () => void; onDelete: () => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const { goal } = evaluation;
  const recurring = isRecurringGoal(goal.kind);
  const ArchiveIcon = goal.archived ? ArchiveRestore : Archive;
  return (
    <Card>
      <View style={styles.goalHeader}>
        <Text style={[styles.goalTitle, styles.flex]}>{title}</Text>
        {evaluation.overdue ? <Chip label={t('progress.goals.overdue')} tone="tint" /> : null}
        {evaluation.achieved && !recurring ? <Chip label={t('progress.goals.achieved')} tone="success" /> : null}
      </View>
      <ProgressBar value={evaluation.progress} tone={evaluation.achieved ? 'success' : 'tint'} />
      <Text style={styles.caption}>
        {goalValueText(evaluation, t)}
        {evaluation.remaining !== null && !evaluation.achieved ? ` · ${t('progress.goals.toGo', { value: formatGoalValue(goal.kind, goal.bodyMetric, evaluation.remaining, t) })}` : ''}
        {recurring ? ` · ${t('progress.goals.thisWeek')}` : ''}
        {goal.deadline ? ` · ${t('progress.goals.by', { date: formatDayMonthYear(Date.parse(goal.deadline)) })}` : ''}
        {goal.achievedAt && !recurring ? ` · ${t('progress.goals.achievedOn', { date: formatDayMonthYear(Date.parse(goal.achievedAt)) })}` : ''}
      </Text>
      <View style={styles.goalActions}>
        <Pressable onPress={onArchive} accessibilityRole="button" accessibilityLabel={t(goal.archived ? 'progress.goals.unarchive' : 'progress.goals.archive')} style={styles.iconButton}>
          <ArchiveIcon size={18} color={theme.colors.labelSecondary} />
        </Pressable>
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={t('progress.goals.delete')} style={styles.iconButton}>
          <Trash2 size={18} color={theme.colors.destructive} />
        </Pressable>
      </View>
    </Card>
  );
}

function NewGoalForm({
  context,
  onDone,
  createGoal,
}: {
  context: Parameters<typeof currentGoalValue>[1];
  onDone: () => void;
  createGoal: ReturnType<typeof useProgressStore.getState>['createGoal'];
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const exerciseMap = useExerciseMap();
  const [kind, setKind] = useState<GoalKind>('exercise_e1rm');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [bodyMetric, setBodyMetric] = useState<BodyMetricKind>('waist');
  const [targetText, setTargetText] = useState('');
  const [deadlineWeeks, setDeadlineWeeks] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const needsExercise = kind === 'exercise_e1rm' || kind === 'exercise_weight';
  const isBody = kind === 'bodyweight' || kind === 'body_measurement';
  const target: GoalTarget = { kind, exerciseId: needsExercise ? exerciseId : null, bodyMetric: kind === 'body_measurement' ? bodyMetric : null };
  const current = currentGoalValue(target, context);

  const submit = () => {
    const value = parseWeight(targetText);
    const baseline = isRecurringGoal(kind) ? null : current;
    const problems: string[] = validateGoalInput(target, value ?? Number.NaN, baseline).map((code) => t(`progress.goals.errors.${code}`));
    if (isBody && current === null) problems.push(t('progress.goals.errors.needs_measurement'));
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    const goal = createGoal({
      kind,
      exerciseId: target.exerciseId,
      bodyMetric: target.bodyMetric,
      targetValue: value!,
      baselineValue: baseline ?? (needsExercise ? 0 : null),
      deadline: deadlineWeeks ? addDays(context.now, deadlineWeeks * 7).toISOString() : null,
    });
    if (goal) onDone();
    else setErrors([t('progress.session.errors.write', { message: useProgressStore.getState().persistenceError ?? '' })]);
  };

  return (
    <Card title={t('progress.goals.newTitle')}>
      <View style={styles.wrap}>
        {GOAL_KINDS.map((key) => (
          <SelectChip
            key={key}
            label={t(`progress.goals.kinds.${key}`)}
            selected={kind === key}
            onPress={() => {
              setKind(key);
              setErrors([]);
            }}
          />
        ))}
      </View>

      {needsExercise ? (
        <Pressable onPress={() => setPicking(true)} accessibilityRole="button" style={styles.pickRow}>
          <Dumbbell size={18} color={theme.colors.tint} />
          <Text style={[styles.pickText, styles.flex]} numberOfLines={1}>
            {exerciseId ? (exerciseMap.get(exerciseId)?.name.en ?? exerciseId) : t('progress.goals.chooseExercise')}
          </Text>
        </Pressable>
      ) : null}

      {kind === 'body_measurement' ? (
        <View style={styles.wrap}>
          {MEASUREMENTS.map((key) => (
            <SelectChip key={key} label={t(`progress.body.kinds.${key}`)} selected={bodyMetric === key} onPress={() => setBodyMetric(key)} />
          ))}
        </View>
      ) : null}

      <Text style={styles.caption}>
        {current === null ? t('progress.goals.currentNone') : t('progress.goals.currentValue', { value: formatGoalValue(kind, target.bodyMetric, current, t) })}
      </Text>

      <TextInput
        value={targetText}
        onChangeText={setTargetText}
        keyboardType="decimal-pad"
        placeholder={t('progress.goals.targetPlaceholder')}
        placeholderTextColor={theme.colors.labelTertiary}
        style={styles.input}
        accessibilityLabel={t('progress.goals.targetPlaceholder')}
      />

      {!isRecurringGoal(kind) ? (
        <>
          <Text style={styles.caption}>{t('progress.goals.deadline')}</Text>
          <View style={styles.wrap}>
            {DEADLINE_WEEKS.map((weeks) => (
              <SelectChip
                key={weeks ?? 'none'}
                label={weeks === null ? t('progress.goals.noDeadline') : t('progress.goals.weeks', { count: weeks })}
                selected={deadlineWeeks === weeks}
                onPress={() => setDeadlineWeeks(weeks)}
              />
            ))}
          </View>
        </>
      ) : null}

      {errors.length > 0 ? (
        <View accessibilityLiveRegion="assertive">
          {errors.map((message) => (
            <Text key={message} style={styles.error}>
              {message}
            </Text>
          ))}
        </View>
      ) : null}

      <Button label={t('progress.goals.create')} onPress={submit} disabled={targetText.trim() === ''} />
      <Button label={t('common.cancel')} variant="secondary" onPress={onDone} />

      <ExercisePickerModal
        visible={picking}
        title={t('progress.goals.chooseExercise')}
        onPick={(id) => {
          setExerciseId(id);
          setPicking(false);
          setErrors([]);
        }}
        onClose={() => setPicking(false)}
      />
    </Card>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    content: {
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.xxxl * 2,
      gap: t.spacing.md,
    },
    secondary: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    sectionTitle: {
      ...t.typography.title3,
      color: t.colors.label,
      marginTop: t.spacing.sm,
    },
    goalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    goalTitle: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    goalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    iconButton: {
      minWidth: HIT,
      minHeight: HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggle: {
      minHeight: HIT,
      justifyContent: 'center',
    },
    link: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.link,
    },
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
    },
    pickText: {
      ...t.typography.body,
      color: t.colors.label,
    },
    input: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      color: t.colors.label,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
    },
    error: {
      ...t.typography.subheadline,
      color: t.colors.destructive,
    },
  }),
);
