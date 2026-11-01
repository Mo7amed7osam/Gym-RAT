import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { formatKg } from '@/lib/format';
import { createStyles } from '@/theme';

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
  const t = useT();
  const styles = useStyles();
  const [selected, setSelected] = useState(volumes.length - 1);
  const max = Math.max(...volumes, 1);
  const selectedIndex = Math.min(selected, volumes.length - 1);

  return (
    <View>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutValue}>{formatKg(volumes[selectedIndex] ?? 0)}</Text>
        <Text style={styles.readoutLabel}>{t('history.weekOf', { date: weekStarts[selectedIndex] ? shortDate(weekStarts[selectedIndex]) : t('common.none') })}</Text>
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
              accessibilityLabel={t('history.weekA11y', { date: weekStarts[index] ? shortDate(weekStarts[index]) : '', volume: formatKg(volume) })}
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

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
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
    gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.separator,
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
      gap: 2,
      marginTop: t.spacing.xs,
    },
    axisLabel: {
      flex: 1,
      fontSize: 11,
      color: t.colors.labelSecondary,
      textAlign: 'center',
    },
    axisLabelSelected: {
      color: t.colors.label,
      fontWeight: '600',
    },
  }),
);
