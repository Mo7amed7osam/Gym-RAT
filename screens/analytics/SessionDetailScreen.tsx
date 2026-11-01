import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Star, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { I18nManager, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ScreenHeader, StatTile } from '@/components/progress/parts';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HIT } from '@/constants/theme';
import { sessionStats } from '@/domain/analytics/aggregate';
import { addDays, startOfDay } from '@/domain/analytics/dates';
import {
  addHistorySet,
  patchHistorySet,
  removeHistoryExercise,
  removeHistorySet,
  setHistoryNotes,
  setHistoryTimes,
  type HistoryEditError,
} from '@/domain/history/edit';
import { endTimeMs } from '@/domain/session/reducer';
import { useT } from '@/i18n';
import { formatDayMonthYear, formatHoursMinutes, formatLongDateLatin, formatNumber, formatTimeLatin, parseTimeInput, toTimeInput } from '@/lib/analyticsFormat';
import { formatKg } from '@/lib/format';
import { formatInputNumber, parseReps, parseWeight } from '@/lib/parseNumber';
import { deleteHistorySession, saveHistorySession } from '@/store/historyActions';
import { useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { ExerciseSet, SessionExercise, WorkoutSession } from '@/types/workout';

interface TimeDraft {
  day: Date;
  time: string;
  minutes: string;
}

const durationMinutes = (session: WorkoutSession) =>
  Math.max(1, Math.round((endTimeMs(session, Date.parse(session.startedAt)) - Date.parse(session.startedAt)) / 60_000));

/**
 * One finished workout: review (stats, records, every set, notes) and
 * correction. Edits happen on a draft; Save validates, recomputes this and
 * every later session's summary and writes it all in one transaction.
 */
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const exerciseMap = useExerciseMap();
  const session = useWorkoutStore((state) => state.history.find((item) => item.id === id));

  const [draft, setDraft] = useState<WorkoutSession | null>(null);
  const [times, setTimes] = useState<TimeDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const shown = draft ?? session;
  const stats = useMemo(() => (shown ? sessionStats(shown) : null), [shown]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/progress'));

  if (!shown || !stats) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.screen }]}>
        <ScreenHeader title={t('progress.session.missing')} onBack={goBack} />
      </View>
    );
  }

  const editing = draft !== null;
  const prSetIds = new Set(session?.summary?.personalRecords.map((record) => record.setId));
  const update = (change: (current: WorkoutSession) => WorkoutSession) => setDraft((current) => (current ? change(current) : current));

  const startEditing = () => {
    if (!session) return;
    setDraft(session);
    setTimes({ day: startOfDay(Date.parse(session.startedAt)), time: toTimeInput(new Date(session.startedAt)), minutes: String(durationMinutes(session)) });
    setErrors([]);
  };
  const stopEditing = () => {
    setDraft(null);
    setTimes(null);
    setErrors([]);
  };

  const save = () => {
    if (!draft || !times || !session) return;
    let next = draft;
    const clock = parseTimeInput(times.time);
    const minutes = Number.parseInt(times.minutes, 10);
    if (!clock || !Number.isFinite(minutes) || minutes <= 0) {
      setErrors([t('progress.session.errors.invalid_time')]);
      return;
    }
    const start = new Date(times.day.getFullYear(), times.day.getMonth(), times.day.getDate(), clock.hours, clock.minutes);
    const end = new Date(start.getTime() + minutes * 60_000);
    const originalStart = new Date(session.startedAt);
    const unchangedTimes =
      start.getTime() === new Date(originalStart.getFullYear(), originalStart.getMonth(), originalStart.getDate(), originalStart.getHours(), originalStart.getMinutes()).getTime() &&
      minutes === durationMinutes(session);
    if (!unchangedTimes) next = setHistoryTimes(next, start.toISOString(), end.toISOString());

    const result = saveHistorySession(next);
    if (result.ok) {
      stopEditing();
      return;
    }
    if ('persistenceError' in result) {
      setErrors([t('progress.session.errors.write', { message: result.persistenceError })]);
      return;
    }
    setErrors(describeErrors(result.errors, next, t));
  };

  const prs = session?.summary?.personalRecords ?? [];

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title={shown.code}
            onBack={() => (editing ? setConfirmDiscard(true) : goBack())}
            trailing={
              editing ? null : (
                <Pressable onPress={startEditing} accessibilityRole="button" accessibilityLabel={t('progress.session.edit')} hitSlop={8} style={styles.iconButton}>
                  <Pencil size={20} color={theme.colors.tint} />
                </Pressable>
              )
            }
          />
          <Text style={styles.secondary}>
            {formatLongDateLatin(new Date(shown.startedAt))} · {formatTimeLatin(shown.startedAt)}
            {shown.kind !== 'plan' ? ` · ${t(shown.kind === 'template' ? 'plan.templateBadge' : 'plan.extraBadge')}` : ''}
          </Text>

          {editing && times ? (
            <Card title={t('progress.session.when')}>
              <View style={styles.dateRow}>
                <StepButton direction="back" label={t('progress.session.dayEarlier')} onPress={() => setTimes({ ...times, day: addDays(times.day, -1) })} />
                <Text style={styles.dateText}>{formatDayMonthYear(times.day)}</Text>
                <StepButton direction="forward" label={t('progress.session.dayLater')} onPress={() => setTimes({ ...times, day: addDays(times.day, 1) })} />
              </View>
              <View style={styles.fieldRow}>
                <Field label={t('progress.session.startTime')} value={times.time} onChange={(time) => setTimes({ ...times, time })} keyboard="numbers-and-punctuation" />
                <Field label={t('progress.session.durationMinutes')} value={times.minutes} onChange={(minutes) => setTimes({ ...times, minutes })} keyboard="number-pad" />
              </View>
            </Card>
          ) : (
            <View style={styles.tiles}>
              <StatTile label={t('progress.tiles.volume')} value={formatKg(stats.volumeKg)} />
              <StatTile label={t('progress.tiles.sets')} value={String(stats.workingSets)} />
              <StatTile label={t('progress.session.duration')} value={shown.summary ? formatHoursMinutes(shown.summary.durationSeconds, t) : '—'} />
              <StatTile label={t('progress.tiles.activeTime')} value={shown.summary ? formatHoursMinutes(shown.summary.activeSeconds, t) : '—'} />
            </View>
          )}

          {!editing && prs.length > 0 ? (
            <Card title={t('progress.session.records')}>
              {prs.map((record) => (
                <View key={`${record.exerciseId}:${record.kind}`} style={styles.recordRow}>
                  <Star size={14} color={theme.colors.tint} fill={theme.colors.tint} />
                  <Text style={[styles.body, styles.flex]} numberOfLines={2}>
                    {exerciseMap.get(record.exerciseId)?.name.en ?? record.exerciseId} · {t(`progress.session.recordKinds.${record.kind}`)}
                  </Text>
                  <Text style={styles.recordValue}>
                    {formatKg(record.value)}
                    {record.previous !== null ? <Text style={styles.caption}> {t('progress.session.was', { value: formatKg(record.previous) })}</Text> : null}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {errors.length > 0 ? (
            <View style={styles.errorBox} accessibilityLiveRegion="assertive">
              {errors.map((message) => (
                <Text key={message} style={styles.errorText}>
                  {message}
                </Text>
              ))}
            </View>
          ) : null}

          {shown.exercises.map((exercise) => (
            <ExerciseBlock
              key={exercise.id}
              exercise={exercise}
              name={exerciseMap.get(exercise.exerciseId)?.name.en ?? exercise.exerciseId}
              editing={editing}
              prSetIds={prSetIds}
              onPatch={(setId, patch) => update((current) => patchHistorySet(current, exercise.id, setId, patch))}
              onAddSet={() => update((current) => addHistorySet(current, exercise.id, randomUUID()))}
              onRemoveSet={(setId) => update((current) => removeHistorySet(current, exercise.id, setId))}
              onRemoveExercise={() => update((current) => removeHistoryExercise(current, exercise.id))}
            />
          ))}

          {editing ? (
            <Card title={t('progress.session.notes')}>
              <TextInput
                value={shown.notes}
                onChangeText={(notes) => update((current) => setHistoryNotes(current, notes))}
                multiline
                placeholder={t('progress.session.notesPlaceholder')}
                placeholderTextColor={theme.colors.labelTertiary}
                style={[styles.input, styles.notes]}
                accessibilityLabel={t('progress.session.notes')}
              />
            </Card>
          ) : shown.notes ? (
            <Card title={t('progress.session.notes')}>
              <Text style={styles.body}>{shown.notes}</Text>
            </Card>
          ) : null}

          {editing ? (
            <View style={styles.actions}>
              <Button label={t('progress.session.save')} icon={Check} onPress={save} />
              <Button label={t('common.cancel')} variant="secondary" onPress={() => setConfirmDiscard(true)} />
              <Text style={styles.caption}>{t('progress.session.recomputeNote')}</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button label={t('progress.session.edit')} variant="tinted" icon={Pencil} onPress={startEditing} />
              <Button label={t('history.deleteSession')} variant="destructive" icon={Trash2} onPress={() => setConfirmDelete(true)} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('history.deleteTitle')}
        message={t('history.deleteMessage', { code: shown.code, date: formatDayMonthYear(Date.parse(shown.startedAt)) })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (deleteHistorySession(shown.id)) goBack();
        }}
      />
      <ConfirmDialog
        visible={confirmDiscard}
        title={t('progress.session.discardTitle')}
        message={t('progress.session.discardMessage')}
        confirmLabel={t('common.discard')}
        cancelLabel={t('progress.session.keepEditing')}
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          stopEditing();
        }}
      />
    </View>
  );
}

function describeErrors(errors: HistoryEditError[], session: WorkoutSession, t: (key: string, options?: Record<string, unknown>) => string): string[] {
  const setLabel = (setId: string | undefined) => {
    for (const exercise of session.exercises) {
      const set = exercise.sets.find((item) => item.id === setId);
      if (set) return t('progress.session.setLabel', { number: set.setNumber });
    }
    return '';
  };
  const messages = errors.map((error) => {
    const base = t(`progress.session.errors.${error.code}`);
    return error.setId ? `${setLabel(error.setId)}: ${base}` : base;
  });
  return [...new Set(messages)];
}

function StepButton({ direction, label, onPress }: { direction: 'back' | 'forward'; label: string; onPress: () => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const backIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const forwardIcon = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  const Icon = direction === 'back' ? backIcon : forwardIcon;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.stepButton}>
      <Icon size={22} color={theme.colors.tint} />
    </Pressable>
  );
}

function Field({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (text: string) => void; keyboard: 'number-pad' | 'numbers-and-punctuation' }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.caption}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboard} style={styles.input} accessibilityLabel={label} selectTextOnFocus />
    </View>
  );
}

/** Keeps the raw text while typing ("57." stays "57.") and reports the parsed number. */
function NumberField({ value, parse, onCommit, label, invalid }: { value: number | null; parse: (raw: string) => number | null; onCommit: (value: number | null) => void; label: string; invalid?: boolean }) {
  const styles = useStyles();
  const [text, setText] = useState(formatInputNumber(value));
  return (
    <TextInput
      value={text}
      onChangeText={(raw) => {
        setText(raw);
        onCommit(parse(raw));
      }}
      keyboardType="decimal-pad"
      selectTextOnFocus
      accessibilityLabel={label}
      style={[styles.input, styles.setInput, invalid && styles.inputInvalid]}
    />
  );
}

function ExerciseBlock({
  exercise,
  name,
  editing,
  prSetIds,
  onPatch,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}: {
  exercise: SessionExercise;
  name: string;
  editing: boolean;
  prSetIds: Set<string>;
  onPatch: (setId: string, patch: Partial<Pick<ExerciseSet, 'weightKg' | 'reps' | 'completed' | 'type'>>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const volume = exercise.sets.reduce((total, set) => total + (set.completed && set.type === 'working' ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0), 0);
  if (!editing && !exercise.sets.some((set) => set.completed)) {
    return (
      <View style={styles.exercise}>
        <Text style={styles.exerciseName}>{name}</Text>
        <Text style={styles.caption}>{exercise.skipped ? t('progress.session.skipped') : t('progress.session.notLogged')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.exercise}>
      <View style={styles.exerciseHeader}>
        <Text style={[styles.exerciseName, styles.flex]}>{name}</Text>
        {editing ? (
          <Pressable onPress={onRemoveExercise} accessibilityRole="button" accessibilityLabel={t('progress.session.removeExercise', { name })} hitSlop={8} style={styles.iconButton}>
            <Trash2 size={18} color={theme.colors.destructive} />
          </Pressable>
        ) : (
          <Text style={styles.caption}>{formatKg(volume)}</Text>
        )}
      </View>
      {exercise.sets.map((set) =>
        editing ? (
          <View key={set.id} style={styles.editRow}>
            <Pressable
              onPress={() => onPatch(set.id, { type: set.type === 'working' ? 'warmup' : 'working' })}
              accessibilityRole="button"
              accessibilityLabel={t('progress.session.toggleWarmup', { number: set.setNumber })}
              style={[styles.setNumber, set.type === 'warmup' && styles.setNumberWarmup]}
            >
              <Text style={[styles.setNumberText, set.type === 'warmup' && styles.setNumberTextWarmup]}>{set.type === 'warmup' ? 'W' : set.setNumber}</Text>
            </Pressable>
            <NumberField value={set.weightKg} parse={parseWeight} onCommit={(weightKg) => onPatch(set.id, { weightKg })} label={t('progress.session.weightFor', { number: set.setNumber })} />
            <Text style={styles.times}>×</Text>
            <NumberField
              value={set.reps}
              parse={parseReps}
              onCommit={(reps) => onPatch(set.id, { reps })}
              label={t('progress.session.repsFor', { number: set.setNumber })}
              invalid={set.completed && set.reps === null}
            />
            <Pressable
              onPress={() => onPatch(set.id, { completed: !set.completed })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.completed }}
              accessibilityLabel={t('progress.session.doneFor', { number: set.setNumber })}
              style={[styles.check, set.completed && styles.checkOn]}
            >
              {set.completed ? <Check size={16} color={theme.colors.onTint} strokeWidth={3} /> : null}
            </Pressable>
            <Pressable onPress={() => onRemoveSet(set.id)} accessibilityRole="button" accessibilityLabel={t('progress.session.removeSet', { number: set.setNumber })} hitSlop={6} style={styles.iconButton}>
              <X size={18} color={theme.colors.labelSecondary} />
            </Pressable>
          </View>
        ) : (
          <View key={set.id} style={[styles.viewRow, !set.completed && styles.dim]}>
            <Text style={[styles.setNumberInline, set.type === 'warmup' && styles.warmupInline]}>{set.type === 'warmup' ? 'W' : set.setNumber}</Text>
            <Text style={[styles.mono, styles.flex]}>
              {set.reps === null ? '—' : set.weightKg ? `${formatNumber(set.weightKg, 2)} kg × ${set.reps}` : `BW × ${set.reps}`}
              {set.rpe !== null ? `  RPE ${set.rpe}` : ''}
            </Text>
            {prSetIds.has(set.id) ? <Star size={13} color={theme.colors.tint} fill={theme.colors.tint} /> : null}
          </View>
        ),
      )}
      {editing ? (
        <Pressable onPress={onAddSet} accessibilityRole="button" style={styles.addSet}>
          <Plus size={16} color={theme.colors.link} />
          <Text style={styles.addSetText}>{t('progress.session.addSet')}</Text>
        </Pressable>
      ) : exercise.notes ? (
        <Text style={styles.caption}>{exercise.notes}</Text>
      ) : null}
    </View>
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
    body: {
      ...t.typography.body,
      color: t.colors.label,
    },
    tiles: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    iconButton: {
      minWidth: HIT,
      minHeight: HIT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    recordValue: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    exercise: {
      padding: t.spacing.lg,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: t.spacing.xs,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    exerciseName: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    viewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: 28,
    },
    dim: {
      opacity: 0.45,
    },
    setNumberInline: {
      width: 22,
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    warmupInline: {
      color: t.colors.tint,
    },
    mono: {
      ...t.typography.mono,
      fontSize: 15,
      color: t.colors.label,
    },
    editRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
    },
    setNumber: {
      width: 36,
      height: 36,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setNumberWarmup: {
      backgroundColor: t.colors.tintMuted,
    },
    setNumberText: {
      fontWeight: '700',
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    setNumberTextWarmup: {
      color: t.colors.tint,
    },
    input: {
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
      color: t.colors.label,
      fontSize: 17,
      fontVariant: ['tabular-nums'],
    },
    setInput: {
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
    },
    inputInvalid: {
      borderWidth: 1,
      borderColor: t.colors.destructive,
    },
    times: {
      color: t.colors.labelSecondary,
      fontSize: 15,
    },
    check: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: t.colors.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: {
      backgroundColor: t.colors.success,
      borderColor: t.colors.success,
    },
    addSet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      minHeight: HIT,
    },
    addSetText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.link,
    },
    notes: {
      minHeight: 88,
      paddingTop: t.spacing.md,
      textAlignVertical: 'top',
    },
    actions: {
      gap: t.spacing.sm,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    stepButton: {
      minWidth: HIT,
      minHeight: HIT,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radii.row,
      backgroundColor: t.colors.surfaceRaised,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    field: {
      flex: 1,
      gap: 4,
    },
    errorBox: {
      padding: t.spacing.md,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.destructiveMuted,
      gap: 4,
    },
    errorText: {
      ...t.typography.subheadline,
      color: t.colors.destructive,
    },
  }),
);
