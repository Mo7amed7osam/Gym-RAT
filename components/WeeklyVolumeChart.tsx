import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import { formatKg } from '@/lib/format';

interface WeeklyVolumeChartProps {
  /** Oldest → newest. */
  volumes: readonly number[];
  /** Saturday start of each bucket, same order as `volumes`. */
  weekStarts: readonly Date[];
  height?: number;
}

const shortDate = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** Compact axis tick, e.g. "12/9" — fits an eighth of a phone-width plot. */
const axisDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

/**
 * Single-series bar chart (one hue, no legend — the title names it).
 * Thin bars anchored to the baseline; tap a bar to read its value.
 * The latest week is selected by default.
 */
export function WeeklyVolumeChart({ volumes, weekStarts, height = 140 }: WeeklyVolumeChartProps) {
  const [selected, setSelected] = useState(volumes.length - 1);
  const max = Math.max(...volumes, 1);
  const selectedIndex = Math.min(selected, volumes.length - 1);

  return (
    <View>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutValue}>{formatKg(volumes[selectedIndex] ?? 0)}</Text>
        <Text style={styles.readoutLabel}>
          Week of {weekStarts[selectedIndex] ? shortDate(weekStarts[selectedIndex]) : '—'}
        </Text>
      </View>

      <View style={[styles.plot, { height }]}>
        <View style={[styles.gridLine, { bottom: height / 2 }]} />
        {volumes.map((volume, index) => {
          const isSelected = index === selectedIndex;
          const barHeight = volume > 0 ? Math.max(4, (volume / max) * (height - 8)) : 2;
          return (
            <Pressable
              key={weekStarts[index]?.toISOString() ?? index}
              onPress={() => setSelected(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Week of ${weekStarts[index] ? shortDate(weekStarts[index]) : ''}: ${formatKg(volume)}`}
              style={styles.column}
            >
              <View
                style={[
                  styles.bar,
                  { height: barHeight },
                  volume > 0 ? (isSelected ? styles.barSelected : styles.barDefault) : styles.barEmpty,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {weekStarts.map((date, index) => (
          <Text
            key={date.toISOString()}
            style={[styles.axisLabel, index === selectedIndex && styles.axisLabelSelected]}
            numberOfLines={1}
          >
            {index === 0 || index === weekStarts.length - 1 || index === selectedIndex ? axisDate(date) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    gap: 2,
    marginBottom: spacing.md,
  },
  readoutValue: {
    ...typography.title2,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  readoutLabel: {
    ...typography.caption,
    color: colors.labelSecondary,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    opacity: 0.5,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '62%',
    maxWidth: 28,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barDefault: {
    backgroundColor: colors.tint,
    opacity: 0.45,
  },
  barSelected: {
    backgroundColor: colors.tint,
  },
  barEmpty: {
    backgroundColor: colors.surfaceHigh,
  },
  axis: {
    flexDirection: 'row',
    gap: 2,
    marginTop: spacing.xs,
  },
  axisLabel: {
    flex: 1,
    fontSize: 11,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  axisLabelSelected: {
    color: colors.label,
    fontWeight: '600',
  },
});
