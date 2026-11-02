import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { HIT } from '@/constants/theme';
import { useT, useLocale } from '@/i18n';
import { useExerciseMap } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';
import type { SessionExercise } from '@/types/workout';
import { localName } from '@/lib/exerciseName';

/**
 * Picks neighbouring exercises to perform back to back: two make a superset,
 * three or more a giant set. Groups stay contiguous (the session engine rests
 * only after the last member in order), so a selection always covers the
 * whole range between the first and last tapped exercise.
 */

/** Indices covered by a selection: every exercise between the lowest and highest picked. */
export function groupRange(picked: ReadonlySet<number>): number[] {
  if (picked.size === 0) return [];
  const indices = [...picked];
  const from = Math.min(...indices);
  const to = Math.max(...indices);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

interface GroupExercisesSheetProps {
  visible: boolean;
  exercises: readonly SessionExercise[];
  /** Pre-selected exercise (the one whose options were opened). Mount the sheet per use so the pick resets. */
  initialIndex: number;
  onConfirm: (sessionExerciseIds: string[]) => void;
  onClose: () => void;
}

export function GroupExercisesSheet({ visible, exercises, initialIndex, onConfirm, onClose }: GroupExercisesSheetProps) {
  const t = useT();
  const locale = useLocale();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const exerciseMap = useExerciseMap();
  const [picked, setPicked] = useState<Set<number>>(() => new Set([initialIndex]));

  const range = groupRange(picked);
  const inRange = new Set(range);
  const toggle = (index: number) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('library.detail.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('workout.groupTitle')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('library.detail.close')} hitSlop={8} style={styles.closeButton}>
              <X size={18} color={theme.colors.labelSecondary} strokeWidth={2.5} />
            </Pressable>
          </View>
          <Text style={styles.hint}>{t('workout.groupHint')}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {exercises.map((exercise, index) => {
              const selected = inRange.has(index);
              const name = localName(exerciseMap.get(exercise.exerciseId)?.name, locale, exercise.exerciseId);
              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => toggle(index)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${index + 1}. ${name}`}
                  style={({ pressed }) => [styles.row, index < exercises.length - 1 && styles.divider, pressed && styles.pressed]}
                >
                  <View style={[styles.box, selected && styles.boxSelected]}>{selected ? <Check size={16} color={theme.colors.onTint} strokeWidth={3} /> : null}</View>
                  <Text style={styles.label} numberOfLines={2}>{`${index + 1}. ${name}`}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Button
              label={range.length >= 3 ? t('workout.groupGiant', { count: range.length }) : t('workout.groupSuperset')}
              disabled={range.length < 2}
              onPress={() => onConfirm(range.map((index) => exercises[index].id))}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim },
    sheet: { maxHeight: '85%', borderTopLeftRadius: t.radii.sheet, borderTopRightRadius: t.radii.sheet, backgroundColor: t.colors.surface, paddingTop: t.spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.xl, gap: t.spacing.sm },
    title: { ...t.typography.headline, color: t.colors.label, flex: 1 },
    closeButton: { width: 32, height: 32, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    hint: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary, paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm },
    list: { paddingHorizontal: t.spacing.xl },
    row: { minHeight: HIT + 4, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.colors.labelSecondary, alignItems: 'center', justifyContent: 'center' },
    boxSelected: { backgroundColor: t.colors.tint, borderColor: t.colors.tint },
    label: { ...t.typography.body, color: t.colors.label, flex: 1 },
    footer: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md },
    pressed: { opacity: 0.6 },
  }),
);
