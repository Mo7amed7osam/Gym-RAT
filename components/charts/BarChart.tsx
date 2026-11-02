import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createStyles } from '@/theme';

interface BarChartProps {
  /** Oldest → newest. */
  values: readonly number[];
  /** Bucket start for each value, same order. */
  labels: readonly Date[];
  formatValue: (value: number) => string;
  /** Readout caption for a bucket, e.g. "Week of 2 Nov". */
  formatLabel: (date: Date) => string;
  /** Compact axis tick. */
  formatTick: (date: Date) => string;
  height?: number;
}

/**
 * Single-series bar chart, one hue, tap a bar to read it (latest selected by
 * default). Generalises the History tab's weekly volume chart for any metric;
 * flex rows mirror under RTL so time runs with the reading direction.
 */
export function BarChart({ values, labels, formatValue, formatLabel, formatTick, height = 120 }: BarChartProps) {
  const styles = useStyles();
  const [selected, setSelected] = useState(values.length - 1);
  const max = Math.max(...values, 1);
  const index = Math.min(selected, values.length - 1);

  return (
    <View>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutValue}>{formatValue(values[index] ?? 0)}</Text>
        <Text style={styles.readoutLabel}>{labels[index] ? formatLabel(labels[index]) : ''}</Text>
      </View>
      <View style={[styles.plot, { height }]}>
        {values.map((value, i) => {
          const isSelected = i === index;
          const barHeight = value > 0 ? Math.max(4, (value / max) * (height - 8)) : 2;
          return (
            <Pressable
              key={labels[i]?.getTime() ?? i}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${labels[i] ? formatLabel(labels[i]) : ''}: ${formatValue(value)}`}
              style={styles.column}
            >
              <View style={[styles.bar, { height: barHeight }, value > 0 ? (isSelected ? styles.barSelected : styles.barDefault) : styles.barEmpty]} />
            </Pressable>
          );
        })}
      </View>
      {/* Oldest and newest ticks only: per-column labels truncate at 12 weeks ("31…"). */}
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.axisLabel}>{labels[0] ? formatTick(labels[0]) : ''}</Text>
        <Text style={styles.axisLabel}>{labels.length > 1 ? formatTick(labels[labels.length - 1]) : ''}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    readout: {
      gap: 2,
      marginBottom: t.spacing.md,
    },
    readoutValue: {
      ...t.typography.title2,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    readoutLabel: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    plot: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
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
      backgroundColor: t.colors.tint,
      opacity: 0.45,
    },
    barSelected: {
      backgroundColor: t.colors.tint,
    },
    barEmpty: {
      backgroundColor: t.colors.surfaceHigh,
    },
    axis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: t.spacing.xs,
    },
    axisLabel: {
      fontSize: 11,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
  }),
);
