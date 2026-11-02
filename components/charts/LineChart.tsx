import { useState } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { createStyles, useTheme } from '@/theme';

export interface LinePoint {
  /** Epoch ms (or any increasing x). */
  x: number;
  y: number;
}

interface LineChartProps {
  points: readonly LinePoint[];
  /** Optional smoothing line drawn under the main series (e.g. moving average). */
  trend?: readonly number[];
  height?: number;
  formatY: (value: number) => string;
  formatX: (x: number) => string;
  /** Spoken label for the whole chart. */
  accessibilityLabel: string;
}

const PAD_X = 10;
const PAD_Y = 12;

/**
 * Single-series line chart: time on x, value on y, one hue. Tap anywhere to
 * read the nearest point; the latest point is selected by default. Under RTL
 * the time axis runs right to left like the rest of the layout.
 */
export function LineChart({ points, trend, height = 180, formatY, formatX, accessibilityLabel }: LineChartProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const rtl = I18nManager.isRTL;

  if (points.length === 0) return null;
  const index = Math.min(selected ?? points.length - 1, points.length - 1);

  const ys = [...points.map((p) => p.y), ...(trend ?? [])];
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const spanY = maxY - minY;
  minY -= spanY * 0.08;
  maxY += spanY * 0.08;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;

  const plotW = Math.max(0, width - PAD_X * 2);
  const plotH = height - PAD_Y * 2;
  const xAt = (i: number) => {
    const ratio = maxX === minX ? 0.5 : (points[i].x - minX) / (maxX - minX);
    const x = PAD_X + ratio * plotW;
    return rtl ? width - x : x;
  };
  const yAt = (value: number) => PAD_Y + (1 - (value - minY) / (maxY - minY)) * plotH;
  const path = (values: readonly number[]) => values.map((value, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(value).toFixed(1)}`).join(' ');

  const onPress = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    let best = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(xAt(i) - x) < Math.abs(xAt(best) - x)) best = i;
    }
    setSelected(best);
  };
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const point = points[index];

  return (
    <View>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.readoutValue}>{formatY(point.y)}</Text>
        <Text style={styles.readoutLabel}>{formatX(point.x)}</Text>
      </View>
      <Pressable
        onPress={onPress}
        onLayout={onLayout}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={{ height }}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={yAt(maxY - (maxY - minY) / 2)} y2={yAt(maxY - (maxY - minY) / 2)} stroke={theme.colors.separator} strokeWidth={StyleSheet.hairlineWidth} />
            <Line x1={0} x2={width} y1={height - 1} y2={height - 1} stroke={theme.colors.separator} strokeWidth={StyleSheet.hairlineWidth} />
            {trend && trend.length === points.length && points.length > 1 ? (
              <Path d={path(trend)} stroke={theme.colors.labelSecondary} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
            ) : null}
            {points.length > 1 ? (
              <Path d={path(points.map((p) => p.y))} stroke={theme.colors.tint} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" fill="none" />
            ) : null}
            {points.length <= 24
              ? points.map((p, i) => (i === index ? null : <Circle key={`${p.x}:${i}`} cx={xAt(i)} cy={yAt(p.y)} r={2.5} fill={theme.colors.tint} opacity={0.6} />))
              : null}
            <Line x1={xAt(index)} x2={xAt(index)} y1={PAD_Y / 2} y2={height} stroke={theme.colors.tint} strokeWidth={1} opacity={0.35} />
            <Circle cx={xAt(index)} cy={yAt(point.y)} r={5} fill={theme.colors.tint} stroke={theme.colors.surface} strokeWidth={2} />
          </Svg>
        ) : null}
      </Pressable>
      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.axisLabel}>{formatX(points[0].x)}</Text>
        <Text style={styles.axisLabel}>{formatX(points[points.length - 1].x)}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    readout: {
      gap: 2,
      marginBottom: t.spacing.sm,
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
