import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

type ChipTone = 'neutral' | 'tint' | 'success' | 'link';

const TONES: Record<ChipTone, { background: string; foreground: string }> = {
  neutral: { background: colors.surfaceRaised, foreground: colors.labelSecondary },
  tint: { background: colors.tintMuted, foreground: colors.tint },
  success: { background: colors.successMuted, foreground: colors.success },
  link: { background: colors.linkMuted, foreground: colors.link },
};

interface ChipProps {
  label: string;
  tone?: ChipTone;
}

export function Chip({ label, tone = 'neutral' }: ChipProps) {
  const palette = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.foreground, fontWeight: tone === 'neutral' ? '500' : '600' }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
  },
});
