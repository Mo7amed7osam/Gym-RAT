import { Lightbulb, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildInsights } from '@/domain/coach';
import { useT } from '@/i18n';
import { selectActivePlan, useExerciseMap, useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

/** Today's coach card (Phase 3 W3): up to three rule-based, dismissable insights from the user's own history. */
export function CoachCard({ now }: { now: number }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const history = useWorkoutStore((state) => state.history);
  const exercises = useWorkoutStore((state) => state.exercises);
  const activePlan = useWorkoutStore(selectActivePlan);
  const enabled = useWorkoutStore((state) => state.settings.coachEnabled);
  const dismissed = useWorkoutStore((state) => state.settings.dismissedInsights);
  const dismissInsight = useWorkoutStore((state) => state.dismissInsight);
  const exerciseMap = useExerciseMap();

  const insights = useMemo(
    () => (enabled ? buildInsights({ history, exercises, activePlan, now: new Date(now).toISOString(), dismissed }) : []),
    [enabled, history, exercises, activePlan, now, dismissed],
  );
  if (insights.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Lightbulb size={16} color={theme.colors.tint} />
        <Text style={styles.title}>{t('coach.title')}</Text>
      </View>
      {insights.map((insight, index) => {
        const name = insight.exerciseId ? (exerciseMap.get(insight.exerciseId)?.name.en ?? insight.exerciseId) : '';
        const params = { ...insight.params, name };
        return (
          <View key={insight.key} style={[styles.row, index < insights.length - 1 && styles.divider]}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{t(`coach.insight.${insight.kind}`, params)}</Text>
              <Text style={styles.rowBody}>{t(`coach.insight.${insight.kind}Body`, params)}</Text>
            </View>
            <Pressable onPress={() => dismissInsight(insight.key)} accessibilityRole="button" accessibilityLabel={t('coach.dismiss')} hitSlop={8} style={styles.dismiss}>
              <X size={16} color={theme.colors.labelSecondary} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    card: { borderRadius: t.radii.card, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.edge, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, paddingBottom: t.spacing.xs },
    title: { ...t.typography.footnote, color: t.colors.tint },
    flex: { flex: 1, minWidth: 0 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm, paddingVertical: t.spacing.sm },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    rowTitle: { ...t.typography.headline, color: t.colors.label },
    rowBody: { ...t.typography.subheadline, color: t.colors.labelSecondary, marginTop: 2 },
    dismiss: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceRaised },
  }),
);
