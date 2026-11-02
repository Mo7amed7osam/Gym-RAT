import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { BUTTON_HEIGHT } from '@/constants/theme';
import { CHROME_MAX_FONT_SCALE, createStyles, useTheme, type Theme } from '@/theme';

export type ButtonVariant = 'primary' | 'tinted' | 'secondary' | 'destructive';

const variants = ({ colors }: Theme): Record<ButtonVariant, { background: string; foreground: string }> => ({
  primary: { background: colors.tint, foreground: colors.onTint },
  tinted: { background: colors.tintMuted, foreground: colors.tint },
  secondary: { background: colors.surfaceRaised, foreground: colors.link },
  destructive: { background: colors.surfaceRaised, foreground: colors.destructive },
});

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const theme = useTheme();
  const palette = variants(theme)[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {Icon ? <Icon size={18} color={palette.foreground} strokeWidth={2.25} /> : null}
      <Text style={[styles.label, { color: palette.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    button: {
      minHeight: BUTTON_HEIGHT,
      borderRadius: t.radii.pill,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    label: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  }),
);
