import { ChevronRight, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT } from '@/constants/theme';
import { getTotalSets } from '@/data/plans';
import { useLocale, useT } from '@/i18n';
import { selectActivePlan, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { Plan } from '@/types/workout';

/**
 * Plan tab (Phase 1 shell): the active plan's rotation, the rotation pointer,
 * and bundled templates to adopt. The plan editor lands in Phase 2.
 */
export default function PlanScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const [pendingAdopt, setPendingAdopt] = useState<Plan | null>(null);

  const plans = useWorkoutStore((state) => state.plans);
  const active = useWorkoutStore(selectActivePlan);
  const setNextDay = useWorkoutStore((state) => state.setNextDay);
  const adoptPlan = useWorkoutStore((state) => state.adoptPlan);

  const templates = plans.filter((plan) => plan.kind !== 'active');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.largeTitle} accessibilityRole="header">
          {t('plan.title')}
        </Text>

        {active ? (
          <View style={styles.section}>
            <SectionHeader title={t('plan.activePlan')} />
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>{active.name[locale]}</Text>
              {active.description ? <Text style={styles.secondary}>{active.description[locale]}</Text> : null}
              <Text style={styles.secondaryNums}>{t('plan.daysCount', { count: active.days.length })}</Text>
            </View>

            <SectionHeader title={t('plan.rotation')} />
            <View style={styles.group}>
              {active.days.map((day, index) => {
                const isNext = index === active.nextDayIndex;
                return (
                  <View key={day.id} style={[styles.dayRow, index < active.days.length - 1 && styles.divider]}>
                    <Text style={[styles.dayIndex, isNext && styles.dayIndexNext]}>{day.position + 1}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.headline}>{day.code}</Text>
                      <Text style={styles.secondary}>{day.muscleSummary[locale]}</Text>
                      <Text style={styles.secondaryNums}>{t('plan.dayMeta', { exercises: day.exercises.length, sets: getTotalSets(day) })}</Text>
                    </View>
                    {isNext ? (
                      <Text style={styles.nextBadge}>{t('plan.nextUp')}</Text>
                    ) : (
                      <Pressable onPress={() => setNextDay(index)} accessibilityRole="button" style={styles.linkButton}>
                        <Text style={styles.linkText}>{t('plan.makeNext')}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
            <Text style={styles.footnote}>{t('plan.editorSoon')}</Text>
          </View>
        ) : (
          <Text style={styles.secondary}>{t('plan.noPlan')}</Text>
        )}

        <View style={styles.section}>
          <SectionHeader title={t('plan.templates')} />
          <View style={styles.group}>
            {templates.map((plan, index) => (
              <View key={plan.id} style={[styles.templateRow, index < templates.length - 1 && styles.divider]}>
                <View style={styles.flex}>
                  <View style={styles.templateTitle}>
                    <Text style={styles.headline} numberOfLines={2}>
                      {plan.name[locale]}
                    </Text>
                    {plan.locked ? <Lock size={14} color={theme.colors.labelTertiary} /> : null}
                  </View>
                  <Text style={styles.secondaryNums}>
                    {t('plan.daysCount', { count: plan.days.length })}
                  </Text>
                </View>
                {active?.sourcePlanId === plan.id ? (
                  <ChevronRight size={18} color={theme.colors.labelTertiary} />
                ) : (
                  <Button label={t('plan.adopt')} variant="tinted" onPress={() => setPendingAdopt(plan)} style={styles.adoptButton} />
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={pendingAdopt !== null}
        title={pendingAdopt ? t('plan.adoptTitle', { name: pendingAdopt.name[locale] }) : ''}
        message={t('plan.adoptMessage')}
        confirmLabel={t('plan.adoptConfirm')}
        onCancel={() => setPendingAdopt(null)}
        onConfirm={() => {
          if (pendingAdopt) adoptPlan(pendingAdopt.id);
          setPendingAdopt(null);
        }}
      />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.screen, paddingBottom: t.spacing.xxxl * 2, gap: t.spacing.xl },
    flex: { flex: 1, minWidth: 0 },
    largeTitle: { ...t.typography.largeTitle, color: t.colors.label },
    section: { gap: t.spacing.sm },
    hero: {
      padding: t.spacing.xl,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: t.spacing.xs,
      marginBottom: t.spacing.md,
    },
    heroTitle: { ...t.typography.title1, color: t.colors.label },
    group: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 72, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm },
    templateRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 64, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm },
    templateTitle: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    dayIndex: { fontFamily: t.fonts.display, fontSize: 24, width: 28, color: t.colors.labelSecondary, fontVariant: ['tabular-nums'] },
    dayIndexNext: { color: t.colors.tint },
    headline: { ...t.typography.headline, color: t.colors.label },
    secondary: { ...t.typography.subheadline, color: t.colors.labelSecondary },
    secondaryNums: { ...t.typography.caption, color: t.colors.labelSecondary, fontVariant: ['tabular-nums'] },
    nextBadge: { ...t.typography.footnote, color: t.colors.tint },
    linkButton: { minHeight: HIT, justifyContent: 'center', paddingHorizontal: t.spacing.sm },
    linkText: { fontSize: 15, fontWeight: '600', color: t.colors.link },
    adoptButton: { minHeight: HIT, paddingHorizontal: t.spacing.md },
    footnote: { ...t.typography.caption, color: t.colors.labelTertiary, paddingHorizontal: t.spacing.xs },
  }),
);
