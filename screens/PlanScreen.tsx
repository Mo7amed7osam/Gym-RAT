import { useRouter } from 'expo-router';
import { ChevronRight, Lock, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SelectChip } from '@/components/ui/SelectChip';
import { HIT } from '@/constants/theme';
import { getTotalSets } from '@/data/plans';
import { useLocale, useT } from '@/i18n';
import { selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { Plan } from '@/types/workout';

type Pending = { kind: 'activate'; plan: Plan } | { kind: 'start'; plan: Plan } | { kind: 'create' } | null;

/**
 * Plan tab: the active plan and its rotation, the user's own plans, bundled
 * templates (activate, duplicate, or start an extra workout from), and the
 * archive. Editing happens in the plan builder routes.
 */
export default function PlanScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [newName, setNewName] = useState('');
  const [startDay, setStartDay] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  const plans = useWorkoutStore((state) => state.plans);
  const active = useWorkoutStore(selectActivePlan);
  const activeSession = useWorkoutStore((state) => state.activeSession);
  const setNextDay = useWorkoutStore((state) => state.setNextDay);
  const activatePlan = useWorkoutStore((state) => state.activatePlan);
  const createPlan = useWorkoutStore((state) => state.createPlan);
  const duplicatePlan = useWorkoutStore((state) => state.duplicatePlan);
  const setPlanArchived = useWorkoutStore((state) => state.setPlanArchived);
  const startWorkout = useWorkoutStore((state) => state.startWorkout);

  const mine = plans.filter((plan) => plan.kind === 'template' && !plan.locked && !plan.archived);
  const bundled = plans.filter((plan) => plan.kind === 'template' && plan.locked);
  const archived = plans.filter((plan) => plan.archived);

  const openEditor = (plan: Plan) => router.push({ pathname: '/plan/[id]', params: { id: plan.id } });
  const duplicate = (plan: Plan) => {
    const copy = duplicatePlan(plan.id);
    if (copy) openEditor(copy);
  };
  const startFromTemplate = () => {
    if (pending?.kind !== 'start') return;
    const result = startWorkout({ planId: pending.plan.id, dayIndex: startDay, kind: 'template' });
    setPending(null);
    if (result.ok) router.push('/workout');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.largeTitle} accessibilityRole="header">
            {t('plan.title')}
          </Text>
          <Pressable
            onPress={() => {
              setNewName('');
              setPending({ kind: 'create' });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('plan.newPlan')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Plus size={22} color={theme.colors.onTint} strokeWidth={2.5} />
          </Pressable>
        </View>

        {active ? (
          <View style={styles.section}>
            <SectionHeader title={t('plan.activePlan')} actionLabel={active.locked ? undefined : t('plan.edit')} onAction={active.locked ? undefined : () => openEditor(active)} />
            <Pressable onPress={() => openEditor(active)} accessibilityRole="button" style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
              <Text style={styles.heroTitle}>{active.name[locale]}</Text>
              {active.description ? <Text style={styles.secondary}>{active.description[locale]}</Text> : null}
              <Text style={styles.secondaryNums}>{t('plan.daysCount', { count: active.days.length })}</Text>
            </Pressable>

            <SectionHeader title={t('plan.rotation')} />
            <View style={styles.group}>
              {active.days.map((day, index) => {
                const isNext = index === active.nextDayIndex;
                return (
                  <View key={day.id} style={[styles.dayRow, index < active.days.length - 1 && styles.divider]}>
                    <Text style={[styles.dayIndex, isNext && styles.dayIndexNext]}>{day.position + 1}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.headline}>{day.code}</Text>
                      {day.muscleSummary[locale] ? <Text style={styles.secondary}>{day.muscleSummary[locale]}</Text> : null}
                      <Text style={styles.secondaryNums}>{t('plan.dayMeta', { exercises: day.exercises.length, sets: getTotalSets(day) })}</Text>
                    </View>
                    {isNext ? (
                      <Text style={styles.nextBadge}>{t('plan.nextUp')}</Text>
                    ) : (
                      <Pressable onPress={() => setNextDay(index)} accessibilityRole="button" accessibilityLabel={`${t('plan.makeNext')}: ${day.code}`} style={styles.linkButton}>
                        <Text style={styles.linkText}>{t('plan.makeNext')}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={styles.secondary}>{t('plan.noPlan')}</Text>
        )}

        {mine.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('plan.myPlans')} />
            <View style={styles.group}>
              {mine.map((plan, index) => (
                <PlanRow key={plan.id} plan={plan} last={index === mine.length - 1} onOpen={() => openEditor(plan)}>
                  <Button label={t('plan.editor.activate')} variant="tinted" onPress={() => setPending({ kind: 'activate', plan })} style={styles.smallButton} />
                </PlanRow>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title={t('plan.templates')} />
          <View style={styles.group}>
            {bundled.map((plan, index) => (
              <View key={plan.id} style={[styles.templateCard, index < bundled.length - 1 && styles.divider]}>
                <View style={styles.templateTitle}>
                  <Text style={styles.headline} numberOfLines={2}>
                    {plan.name[locale]}
                  </Text>
                  <Lock size={14} color={theme.colors.labelTertiary} />
                </View>
                <Text style={styles.secondaryNums}>{t('plan.daysCount', { count: plan.days.length })}</Text>
                <View style={styles.actionRow}>
                  {active?.sourcePlanId === plan.id ? (
                    <Text style={styles.secondary}>{t('plan.editor.active')}</Text>
                  ) : (
                    <Button label={t('plan.adopt')} accessibilityLabel={`${t('plan.adopt')}: ${plan.name[locale]}`} variant="tinted" onPress={() => setPending({ kind: 'activate', plan })} style={styles.smallButton} />
                  )}
                  <Button label={t('plan.duplicate')} accessibilityLabel={`${t('plan.duplicate')}: ${plan.name[locale]}`} variant="secondary" onPress={() => duplicate(plan)} style={styles.smallButton} />
                  <Button
                    label={t('plan.startFromTemplate')}
                    accessibilityLabel={`${t('plan.startFromTemplate')}: ${plan.name[locale]}`}
                    variant="secondary"
                    disabled={activeSession !== null}
                    onPress={() => {
                      setStartDay(0);
                      setPending({ kind: 'start', plan });
                    }}
                    style={styles.smallButton}
                  />
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.footnote}>{t('plan.templateSessionHint')}</Text>
        </View>

        {archived.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('plan.archivedPlans')} actionLabel={showArchived ? t('plan.editor.done') : `${archived.length}`} onAction={() => setShowArchived(!showArchived)} />
            {showArchived ? (
              <View style={styles.group}>
                {archived.map((plan, index) => (
                  <PlanRow key={plan.id} plan={plan} last={index === archived.length - 1} onOpen={() => openEditor(plan)}>
                    <Button label={t('plan.restore')} variant="secondary" onPress={() => setPlanArchived(plan.id, false)} style={styles.smallButton} />
                  </PlanRow>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={pending?.kind === 'activate'}
        title={pending?.kind === 'activate' ? t(pending.plan.locked ? 'plan.adoptTitle' : 'plan.activateTitle', { name: pending.plan.name[locale] }) : ''}
        message={pending?.kind === 'activate' && pending.plan.locked ? t('plan.adoptMessage') : t('plan.activateMessage')}
        confirmLabel={t('plan.adoptConfirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind === 'activate') activatePlan(pending.plan.id);
          setPending(null);
        }}
      />

      <ConfirmDialog
        visible={pending?.kind === 'create'}
        title={t('plan.newPlanTitle')}
        message=""
        confirmLabel={t('plan.create')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const name = newName.trim();
          if (!name) return;
          const plan = createPlan({ en: name, ar: name });
          setPending(null);
          openEditor(plan);
        }}
      >
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder={t('plan.newPlanPlaceholder')}
          placeholderTextColor={theme.colors.labelTertiary}
          autoFocus
          accessibilityLabel={t('plan.editor.name')}
          style={styles.input}
        />
      </ConfirmDialog>

      <ConfirmDialog
        visible={pending?.kind === 'start'}
        title={t('plan.pickDay')}
        message={t('plan.templateSessionHint')}
        confirmLabel={t('plan.startFromTemplate')}
        onCancel={() => setPending(null)}
        onConfirm={startFromTemplate}
      >
        <View style={styles.chipRow}>
          {pending?.kind === 'start'
            ? pending.plan.days.map((day, index) => <SelectChip key={day.id} label={day.code} selected={startDay === index} onPress={() => setStartDay(index)} />)
            : null}
        </View>
      </ConfirmDialog>
    </View>
  );
}

function PlanRow({ plan, last, onOpen, children }: { plan: Plan; last: boolean; onOpen: () => void; children: React.ReactNode }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  return (
    <View style={[styles.templateCard, !last && styles.divider]}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [styles.planRowTop, pressed && styles.pressed]}>
        <View style={styles.flex}>
          <Text style={styles.headline} numberOfLines={2}>
            {plan.name[locale]}
          </Text>
          <Text style={styles.secondaryNums}>{t('plan.daysCount', { count: plan.days.length })}</Text>
        </View>
        <ChevronRight size={18} color={theme.colors.labelTertiary} />
      </Pressable>
      <View style={styles.actionRow}>{children}</View>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.screen, paddingBottom: t.spacing.xxxl * 2, gap: t.spacing.xl },
    flex: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    largeTitle: { ...t.typography.largeTitle, color: t.colors.label },
    addButton: { width: HIT, height: HIT, borderRadius: t.radii.pill, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
    section: { gap: t.spacing.sm },
    hero: {
      padding: t.spacing.xl,
      borderRadius: t.radii.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.edge,
      gap: t.spacing.xs,
    },
    heroTitle: { ...t.typography.title1, color: t.colors.label },
    group: { borderRadius: t.radii.card, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.edge, paddingHorizontal: t.spacing.lg },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    dayIndex: { ...t.typography.title2, color: t.colors.labelTertiary, width: 28, fontVariant: ['tabular-nums'] },
    dayIndexNext: { color: t.colors.tint },
    headline: { ...t.typography.headline, color: t.colors.label },
    secondary: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    secondaryNums: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary, fontVariant: ['tabular-nums'] },
    nextBadge: { ...t.typography.footnote, color: t.colors.tint },
    linkButton: { minHeight: HIT, justifyContent: 'center' },
    linkText: { ...t.typography.subheadline, fontWeight: '600', color: t.colors.link },
    templateCard: { paddingVertical: t.spacing.md, gap: t.spacing.sm },
    templateTitle: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    planRowTop: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, alignItems: 'center' },
    smallButton: { minWidth: 120, flexGrow: 1 },
    footnote: { ...t.typography.caption, color: t.colors.labelTertiary },
    pressed: { opacity: 0.7 },
    input: {
      ...t.typography.body,
      color: t.colors.label,
      minHeight: HIT,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  }),
);
