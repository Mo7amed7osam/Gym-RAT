import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { Button } from '@/components/ui/Button';
import { ExerciseThumb } from '@/components/ui/ExerciseThumb';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { parseReps } from '@/lib/parseNumber';
import { useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { ExercisePrescription, TrainingFocus } from '@/types/workout';

const REST_CHOICES = [60, 90, 120, 150, 180] as const;

/** Day builder: name/title/focus, exercises with sets · reps · rest, reorder, substitute, remove, add. */
export default function PlanDayEditorScreen() {
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId: string }>();
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const plan = useWorkoutStore((state) => state.plans.find((item) => item.id === id));
  const day = plan?.days.find((item) => item.id === dayId);
  const exercises = useExerciseMap();
  const updatePlanDay = useWorkoutStore((state) => state.updatePlanDay);
  const addPlanExercise = useWorkoutStore((state) => state.addPlanExercise);
  const removePlanExercise = useWorkoutStore((state) => state.removePlanExercise);
  const reorderPlanExercise = useWorkoutStore((state) => state.reorderPlanExercise);
  const substitutePlanExercise = useWorkoutStore((state) => state.substitutePlanExercise);
  const updatePlanExercise = useWorkoutStore((state) => state.updatePlanExercise);

  const [code, setCode] = useState(day?.code ?? '');
  const [muscles, setMuscles] = useState(day?.muscleSummary.en ?? '');
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'substitute'; index: number } | null>(null);

  if (!plan || !day) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>{t('plan.noPlan')}</Text>
      </View>
    );
  }
  const editable = !plan.locked;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/plan/[id]', params: { id: plan.id } }));
  const commitHeader = () => {
    if (!editable) return;
    const nextCode = code.trim() || day.code;
    const nextMuscles = muscles.trim();
    if (nextCode !== day.code || nextMuscles !== day.muscleSummary.en) {
      updatePlanDay(plan.id, day.id, { code: nextCode, title: { en: nextCode, ar: nextCode }, muscleSummary: { en: nextMuscles, ar: nextMuscles } });
    }
  };
  const setFocus = (focus: TrainingFocus | null) => editable && updatePlanDay(plan.id, day.id, { focus });
  const patch = (index: number, value: Partial<Omit<ExercisePrescription, 'exerciseId'>>) => editable && updatePlanExercise(plan.id, day.id, index, value);

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.toolbar}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('onboarding.back')} hitSlop={8} style={styles.iconButton}>
          <ChevronLeft size={24} color={theme.colors.label} />
        </Pressable>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {day.code}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]} keyboardShouldPersistTaps="handled">
        {!editable ? <Text style={styles.secondary}>{t('plan.editor.lockedNotice')}</Text> : null}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('plan.editor.dayCode')}</Text>
          <TextInput value={code} onChangeText={setCode} onBlur={commitHeader} editable={editable} style={styles.input} accessibilityLabel={t('plan.editor.dayCode')} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('plan.editor.muscleSummary')}</Text>
          <TextInput value={muscles} onChangeText={setMuscles} onBlur={commitHeader} editable={editable} style={styles.input} accessibilityLabel={t('plan.editor.muscleSummary')} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('plan.editor.focus')}</Text>
          <View style={styles.chipRow}>
            <SelectChip label={t('plan.editor.focusNone')} selected={day.focus === null} onPress={() => setFocus(null)} />
            <SelectChip label={t('plan.editor.focusStrength')} selected={day.focus === 'strength'} onPress={() => setFocus('strength')} />
            <SelectChip label={t('plan.editor.focusHypertrophy')} selected={day.focus === 'hypertrophy'} onPress={() => setFocus('hypertrophy')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('plan.editor.exercises')} />
          {day.exercises.length === 0 ? <Text style={styles.secondary}>{t('plan.editor.noExercises')}</Text> : null}
          {day.exercises.map((item, index) => {
            const exercise = exercises.get(item.exerciseId);
            return (
              <View key={`${item.exerciseId}-${index}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <ExerciseThumb exerciseId={item.exerciseId} size={48} />
                  <Text style={[styles.headline, styles.flex]} numberOfLines={2}>
                    {exercise?.name.en ?? item.exerciseId}
                  </Text>
                  {editable ? (
                    <View style={styles.cardActions}>
                      <IconButton label={t('plan.editor.moveUp')} disabled={index === 0} onPress={() => reorderPlanExercise(plan.id, day.id, index, index - 1)}>
                        <ChevronUp size={18} color={theme.colors.label} />
                      </IconButton>
                      <IconButton label={t('plan.editor.moveDown')} disabled={index === day.exercises.length - 1} onPress={() => reorderPlanExercise(plan.id, day.id, index, index + 1)}>
                        <ChevronDown size={18} color={theme.colors.label} />
                      </IconButton>
                      <IconButton label={t('plan.editor.removeExercise')} onPress={() => removePlanExercise(plan.id, day.id, index)}>
                        <Trash2 size={18} color={theme.colors.destructive} />
                      </IconButton>
                    </View>
                  ) : null}
                </View>
                <View style={styles.prescriptionRow}>
                  <NumberField label={t('plan.editor.sets')} value={item.sets} editable={editable} min={1} onChange={(sets) => patch(index, { sets })} />
                  <NumberField label={t('plan.editor.reps')} value={item.reps.min} editable={editable} min={1} onChange={(min) => patch(index, { reps: { min, max: Math.max(min, item.reps.max) } })} />
                  <Text style={styles.repsTo}>{t('plan.editor.repsTo')}</Text>
                  <NumberField label={t('plan.editor.reps')} value={item.reps.max} editable={editable} min={1} onChange={(max) => patch(index, { reps: { min: Math.min(max, item.reps.min), max } })} />
                </View>
                <View style={styles.restRow}>
                  <Text style={styles.fieldLabel}>{t('plan.editor.rest')}</Text>
                  <View style={styles.chipRow}>
                    {REST_CHOICES.map((seconds) => (
                      <SelectChip
                        key={seconds}
                        label={t('library.detail.restSeconds', { n: seconds })}
                        selected={item.rest.defaultSeconds === seconds}
                        onPress={() => patch(index, { rest: { defaultSeconds: seconds, minSeconds: seconds, maxSeconds: seconds } })}
                      />
                    ))}
                  </View>
                </View>
                {editable ? (
                  <Pressable onPress={() => setPicker({ mode: 'substitute', index })} accessibilityRole="button" style={styles.linkButton}>
                    <Text style={styles.linkText}>{t('plan.editor.substitute')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {editable ? <Button label={t('plan.editor.addExercise')} variant="tinted" onPress={() => setPicker({ mode: 'add' })} /> : null}
        </View>
      </ScrollView>

      <ExercisePickerModal
        visible={picker !== null}
        title={t('plan.editor.pickTitle')}
        excludeIds={picker?.mode === 'add' ? day.exercises.map((item) => item.exerciseId) : []}
        onClose={() => setPicker(null)}
        onPick={(exerciseId) => {
          if (picker?.mode === 'add') addPlanExercise(plan.id, day.id, exerciseId);
          else if (picker?.mode === 'substitute') substitutePlanExercise(plan.id, day.id, picker.index, exerciseId);
          setPicker(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function NumberField({ label, value, editable, min, onChange }: { label: string; value: number; editable: boolean; min: number; onChange: (value: number) => void }) {
  const styles = useStyles();
  const [text, setText] = useState(String(value));
  const commit = () => {
    const parsed = parseReps(text);
    if (parsed !== null && parsed >= min && parsed !== value) onChange(parsed);
    else setText(String(value));
  };
  return (
    <View style={styles.numberField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        editable={editable}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={label}
        style={styles.numberInput}
      />
    </View>
  );
}

function IconButton({ label, disabled = false, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButtonSmall, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1, minWidth: 0 },
    toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs, gap: t.spacing.sm },
    toolbarTitle: { ...t.typography.headline, color: t.colors.label, flex: 1, textAlign: 'center' },
    iconButton: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    iconButtonSmall: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: t.radii.row, backgroundColor: t.colors.surfaceRaised },
    content: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.sm, gap: t.spacing.lg },
    missing: { ...t.typography.body, color: t.colors.labelSecondary, textAlign: 'center', paddingTop: t.spacing.xxxl },
    field: { gap: t.spacing.xs },
    fieldLabel: { ...t.typography.footnote, color: t.colors.labelSecondary },
    input: {
      ...t.typography.body,
      color: t.colors.label,
      minHeight: HIT,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    section: { gap: t.spacing.md },
    secondary: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    headline: { ...t.typography.headline, color: t.colors.label },
    card: { gap: t.spacing.md, padding: t.spacing.lg, borderRadius: t.radii.card, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.edge },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    cardActions: { flexDirection: 'row', gap: t.spacing.xs },
    prescriptionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm },
    numberField: { gap: t.spacing.xxs, width: 72 },
    numberInput: {
      ...t.typography.metric,
      color: t.colors.label,
      minHeight: HIT,
      textAlign: 'center',
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
    },
    repsTo: { ...t.typography.subheadline, color: t.colors.labelSecondary, paddingBottom: t.spacing.md },
    restRow: { gap: t.spacing.xs },
    linkButton: { minHeight: HIT, justifyContent: 'center' },
    linkText: { ...t.typography.subheadline, fontWeight: '600', color: t.colors.link },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.35 },
  }),
);
