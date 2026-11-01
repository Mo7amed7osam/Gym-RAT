import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Lock, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT } from '@/constants/theme';
import { getTotalSets } from '@/data/plans';
import { useLocale, useT } from '@/i18n';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { PlanDay } from '@/types/workout';

/** Plan builder: name, description, days (add / reorder / remove), activation, duplication, archive. */
export default function PlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const plan = useWorkoutStore((state) => state.plans.find((item) => item.id === id));
  const renamePlan = useWorkoutStore((state) => state.renamePlan);
  const addPlanDay = useWorkoutStore((state) => state.addPlanDay);
  const removePlanDay = useWorkoutStore((state) => state.removePlanDay);
  const reorderPlanDay = useWorkoutStore((state) => state.reorderPlanDay);
  const activatePlan = useWorkoutStore((state) => state.activatePlan);
  const duplicatePlan = useWorkoutStore((state) => state.duplicatePlan);
  const setPlanArchived = useWorkoutStore((state) => state.setPlanArchived);

  const [name, setName] = useState(plan?.name.en ?? '');
  const [description, setDescription] = useState(plan?.description?.en ?? '');
  const [pendingRemove, setPendingRemove] = useState<PlanDay | null>(null);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [newDayCode, setNewDayCode] = useState('');

  if (!plan) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.missing}>{t('plan.noPlan')}</Text>
      </View>
    );
  }
  const editable = !plan.locked;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/plan'));
  const commitName = () => {
    if (!editable) return;
    const nextName = name.trim() || plan.name.en;
    const nextDescription = description.trim();
    if (nextName !== plan.name.en || nextDescription !== (plan.description?.en ?? '')) {
      renamePlan(plan.id, { en: nextName, ar: nextName }, nextDescription ? { en: nextDescription, ar: nextDescription } : null);
    }
  };
  const addDay = () => {
    const code = newDayCode.trim() || `Day ${plan.days.length + 1}`;
    const day = addPlanDay(plan.id, code);
    setNewDayCode('');
    router.push({ pathname: '/plan/[id]/day/[dayId]', params: { id: plan.id, dayId: day.id } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('onboarding.back')} hitSlop={8} style={styles.iconButton}>
          <ChevronLeft size={24} color={theme.colors.label} />
        </Pressable>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {t('plan.editor.title')}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]} keyboardShouldPersistTaps="handled">
        {plan.kind === 'active' ? <Text style={styles.activeNotice}>{t('plan.editor.active')}</Text> : null}
        {!editable ? (
          <View style={styles.lockedNotice}>
            <Lock size={16} color={theme.colors.labelSecondary} />
            <Text style={[styles.secondary, styles.flex]}>{t('plan.editor.lockedNotice')}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('plan.editor.name')}</Text>
          <TextInput value={name} onChangeText={setName} onBlur={commitName} editable={editable} style={[styles.input, !editable && styles.inputDisabled]} accessibilityLabel={t('plan.editor.name')} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('plan.editor.description')}</Text>
          <TextInput value={description} onChangeText={setDescription} onBlur={commitName} editable={editable} multiline style={[styles.input, styles.multiline, !editable && styles.inputDisabled]} accessibilityLabel={t('plan.editor.description')} />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('plan.editor.days')} />
          {plan.days.length === 0 ? <Text style={styles.secondary}>{t('plan.editor.noDays')}</Text> : null}
          <View style={plan.days.length > 0 ? styles.group : undefined}>
            {plan.days.map((day, index) => (
              <View key={day.id} style={[styles.dayRow, index < plan.days.length - 1 && styles.divider]}>
                <Pressable
                  onPress={() => router.push({ pathname: '/plan/[id]/day/[dayId]', params: { id: plan.id, dayId: day.id } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.dayMain, pressed && styles.pressed]}
                >
                  <Text style={styles.dayIndex}>{index + 1}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.headline}>{day.code}</Text>
                    {day.muscleSummary[locale] ? <Text style={styles.secondary}>{day.muscleSummary[locale]}</Text> : null}
                    <Text style={styles.secondaryNums}>{t('plan.dayMeta', { exercises: day.exercises.length, sets: getTotalSets(day) })}</Text>
                  </View>
                  <ChevronRight size={18} color={theme.colors.labelTertiary} />
                </Pressable>
                {editable ? (
                  <View style={styles.dayActions}>
                    <IconButton label={t('plan.editor.moveUp')} disabled={index === 0} onPress={() => reorderPlanDay(plan.id, day.id, index - 1)}>
                      <ChevronUp size={18} color={theme.colors.label} />
                    </IconButton>
                    <IconButton label={t('plan.editor.moveDown')} disabled={index === plan.days.length - 1} onPress={() => reorderPlanDay(plan.id, day.id, index + 1)}>
                      <ChevronDown size={18} color={theme.colors.label} />
                    </IconButton>
                    <IconButton label={t('plan.editor.removeDay')} onPress={() => setPendingRemove(day)}>
                      <Trash2 size={18} color={theme.colors.destructive} />
                    </IconButton>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          {editable ? (
            <View style={styles.addRow}>
              <TextInput
                value={newDayCode}
                onChangeText={setNewDayCode}
                placeholder={t('plan.editor.dayNamePlaceholder')}
                placeholderTextColor={theme.colors.labelTertiary}
                style={[styles.input, styles.flex]}
                accessibilityLabel={t('plan.editor.dayCode')}
              />
              <Button label={t('plan.editor.addDay')} variant="tinted" onPress={addDay} />
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {plan.kind !== 'active' ? <Button label={plan.locked ? t('plan.adopt') : t('plan.editor.activate')} onPress={() => setConfirmActivate(true)} /> : null}
          <Button
            label={t('plan.duplicate')}
            variant="secondary"
            onPress={() => {
              const copy = duplicatePlan(plan.id);
              if (copy) router.replace({ pathname: '/plan/[id]', params: { id: copy.id } });
            }}
          />
          {editable && plan.kind !== 'active' ? (
            <Button
              label={plan.archived ? t('plan.restore') : t('plan.archive')}
              variant="secondary"
              onPress={() => {
                setPlanArchived(plan.id, !plan.archived);
                if (!plan.archived) goBack();
              }}
            />
          ) : null}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={pendingRemove !== null}
        title={t('plan.editor.removeDayTitle', { code: pendingRemove?.code ?? '' })}
        message={t('plan.editor.removeDayMessage')}
        confirmLabel={t('plan.editor.remove')}
        destructive
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) removePlanDay(plan.id, pendingRemove.id);
          setPendingRemove(null);
        }}
      />
      <ConfirmDialog
        visible={confirmActivate}
        title={t(plan.locked ? 'plan.adoptTitle' : 'plan.activateTitle', { name: plan.name[locale] })}
        message={plan.locked ? t('plan.adoptMessage') : t('plan.activateMessage')}
        confirmLabel={t('plan.adoptConfirm')}
        onCancel={() => setConfirmActivate(false)}
        onConfirm={() => {
          setConfirmActivate(false);
          activatePlan(plan.id);
          goBack();
        }}
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
    content: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.sm, gap: t.spacing.xl },
    missing: { ...t.typography.body, color: t.colors.labelSecondary, textAlign: 'center', paddingTop: t.spacing.xxxl },
    activeNotice: { ...t.typography.footnote, color: t.colors.tint },
    lockedNotice: { flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center', padding: t.spacing.md, borderRadius: t.radii.tile, backgroundColor: t.colors.surfaceRaised },
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
    inputDisabled: { color: t.colors.labelSecondary },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    section: { gap: t.spacing.sm },
    group: { borderRadius: t.radii.card, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.edge, paddingHorizontal: t.spacing.lg },
    dayRow: { paddingVertical: t.spacing.md, gap: t.spacing.sm },
    dayMain: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    dayActions: { flexDirection: 'row', gap: t.spacing.sm, justifyContent: 'flex-end' },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    dayIndex: { ...t.typography.title2, color: t.colors.labelTertiary, width: 28, fontVariant: ['tabular-nums'] },
    headline: { ...t.typography.headline, color: t.colors.label },
    secondary: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    secondaryNums: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary, fontVariant: ['tabular-nums'] },
    addRow: { flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' },
    actions: { gap: t.spacing.sm },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.35 },
  }),
);
