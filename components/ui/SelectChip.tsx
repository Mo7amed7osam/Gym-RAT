import { Pressable, StyleSheet, Text } from 'react-native';

import { createStyles } from '@/theme';

interface SelectChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `radio` for single-choice groups, `checkbox` for multi-select. */
  role?: 'radio' | 'checkbox';
}

/** Tappable pill for filter rows and multi-select fields. */
export function SelectChip({ label, selected, onPress, role = 'radio' }: SelectChipProps) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    chip: {
      minHeight: 34,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: t.colors.tint,
    },
    pressed: { opacity: 0.7 },
    label: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.label,
    },
    labelSelected: {
      color: t.colors.onTint,
    },
  }),
);
