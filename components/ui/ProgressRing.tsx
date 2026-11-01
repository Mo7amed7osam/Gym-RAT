import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';

interface ProgressRingProps {
  size: number;
  strokeWidth: number;
  /** 0 → 1 */
  progress: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
}

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = colors.surfaceRaised,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
