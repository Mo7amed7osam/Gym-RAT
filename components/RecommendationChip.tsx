import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { SessionExercise } from '@/types/workout';

interface RecommendationChipProps {
  sessionExercise: SessionExercise;
  onEdit: () => void;
}

/**
 * Overload suggestion for one exercise (Phase 3 W4). Sits above the stat
 * tiles, outside the protected grid. Accept rewrites prefills on sets not yet
 * logged; Edit opens the session targets sheet; Ignore hides it for this workout.
 */
export function RecommendationChip({ sessionExercise, onEdit }: RecommendationChipProps) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const recommendationFor = useWorkoutStore((state) => state.recommendationFor);
  const applyRecommendation = useWorkoutStore((state) => state.applyRecommendation);
  const dismissRecommendation = useWorkoutStore((state) => state.dismissRecommendation);
  // Subscribe to the inputs so the chip re-evaluates when history or settings change.
  useWorkoutStore((state) => state.history);
  useWorkoutStore((state) => state.settings.recommendationsEnabled);
  const [expanded, setExpanded] = useState(false);

  const decision = sessionExercise.recommendation?.decision ?? null;
  if (decision === 'dismissed') return null;
  const recommendation = recommendationFor(sessionExercise.id);
  if (!recommendation || recommendation.action === 'insufficient_data') return null;

  const target =
    recommendation.weightKg !== null
      ? t('coach.targetLine', { weight: recommendation.weightKg, reps: recommendation.reps.min === recommendation.reps.max ? recommendation.reps.min : `${recommendation.reps.min}–${recommendation.reps.max}` })
      : t('coach.targetLineNoWeight', { reps: recommendation.reps.min === recommendation.reps.max ? recommendation.reps.min : `${recommendation.reps.min}–${recommendation.reps.max}` });
  const explanation = t(recommendation.explanationKey, recommendation.params);

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`${t('coach.suggestion')} ${target}. ${explanation}`}>
      <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" style={styles.header}>
        <Sparkles size={16} color={theme.colors.tint} />
        <Text style={styles.label}>{t('coach.suggestion')}</Text>
        <Text style={styles.target}>{target}</Text>
      </Pressable>
      <Text style={styles.explanation} numberOfLines={expanded ? undefined : 2}>
        {explanation}
      </Text>
      <Text style={styles.meta}>{t('coach.basedOn', { count: recommendation.basedOnSessions })}</Text>
      {decision === 'accepted' ? (
        <Text style={styles.applied}>{t('coach.applied')}</Text>
      ) : (
        <View style={styles.actions}>
          <Pressable onPress={() => applyRecommendation(sessionExercise.id)} accessibilityRole="button" style={[styles.action, styles.actionPrimary]}>
            <Text style={styles.actionPrimaryText}>{t('coach.accept')}</Text>
          </Pressable>
          <Pressable onPress={onEdit} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionText}>{t('coach.edit')}</Text>
          </Pressable>
          <Pressable onPress={() => dismissRecommendation(sessionExercise.id)} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionText}>{t('coach.ignore')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    card: { gap: t.spacing.xs, padding: t.spacing.md, borderRadius: t.radii.tile, backgroundColor: t.colors.tintMuted },
    header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, minHeight: 28 },
    label: { ...t.typography.footnote, color: t.colors.tint },
    target: { ...t.typography.headline, color: t.colors.label, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
    explanation: { ...t.typography.subheadline, color: t.colors.label },
    meta: { ...t.typography.caption, color: t.colors.labelSecondary },
    applied: { ...t.typography.footnote, color: t.colors.success },
    actions: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.xxs },
    action: { minHeight: 34, paddingHorizontal: t.spacing.md, borderRadius: t.radii.pill, justifyContent: 'center', backgroundColor: t.colors.surface },
    actionPrimary: { backgroundColor: t.colors.tint },
    actionText: { ...t.typography.footnote, color: t.colors.label },
    actionPrimaryText: { ...t.typography.footnote, color: t.colors.onTint },
  }),
);
