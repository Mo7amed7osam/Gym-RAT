import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { isRtlLocale, useLocale, useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';

/**
 * The sign-in wordmark: Barlow Condensed in the accent, over a soft radial
 * glow in the same hue. One restrained effect, no gradients elsewhere.
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  // Arabic letters join; tracking and upper-casing would break the word apart.
  const latin = !isRtlLocale(locale);
  const glow = theme.scheme === 'dark' ? 0.28 : 0.16;
  return (
    <View style={[styles.root, compact && styles.rootCompact]} accessibilityRole="header" accessibilityLabel={`${t('auth.brand')}. ${t('auth.eyebrow')}`}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={theme.colors.tint} stopOpacity={glow} />
            <Stop offset="1" stopColor={theme.colors.tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="160" cy="100" rx="160" ry="100" fill="url(#glow)" />
      </Svg>
      <Text style={[styles.eyebrow, latin && styles.eyebrowLatin]} accessibilityElementsHidden importantForAccessibility="no">
        {latin ? t('auth.eyebrow').toUpperCase() : t('auth.eyebrow')}
      </Text>
      <Text style={[styles.wordmark, compact && styles.wordmarkCompact]} accessibilityElementsHidden importantForAccessibility="no" allowFontScaling={false}>
        {t('auth.brand')}
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: {
      alignItems: 'center',
      paddingTop: t.spacing.xxxl,
      paddingBottom: t.spacing.xl,
      overflow: 'visible',
    },
    rootCompact: { paddingTop: t.spacing.lg, paddingBottom: t.spacing.md },
    eyebrow: {
      ...t.typography.footnote,
      color: t.colors.labelSecondary,
      marginBottom: t.spacing.xs,
    },
    eyebrowLatin: { letterSpacing: 2.5 },
    wordmark: {
      fontFamily: t.fonts.displayHeavy,
      fontSize: 72,
      lineHeight: 74,
      letterSpacing: 1,
      color: t.colors.label,
    },
    wordmarkCompact: { fontSize: 48, lineHeight: 50 },
    rule: {
      marginTop: t.spacing.md,
      width: 56,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.tint,
    },
  }),
);
