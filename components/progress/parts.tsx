import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HIT } from '@/constants/theme';
import type { MetricDelta } from '@/domain/analytics/aggregate';
import { useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';

/** Building blocks shared by the Progress tab and its sub-screens. */

export function Card({ title, action, onAction, children, style }: { title?: string; action?: string; onAction?: () => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {action && onAction ? (
            <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={title ? `${action}: ${title}` : action} hitSlop={10} style={styles.cardAction}>
              <Text style={styles.cardActionText}>{action}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** "+12%", "New" (no baseline), or "—" (nothing either side). */
export function deltaLabel(change: MetricDelta, newLabel: string): string {
  if (change.percent === null) return change.current > 0 ? newLabel : '—';
  return `${change.percent > 0 ? '+' : change.percent < 0 ? '−' : ''}${Math.abs(change.percent)}%`;
}

export function StatTile({ label, value, change }: { label: string; value: string; change?: MetricDelta }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const text = change ? deltaLabel(change, t('progress.new')) : null;
  const positive = change ? change.diff > 0 : false;
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} ${value}${text ? `, ${text}` : ''}`}>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.caption} numberOfLines={1}>
        {label}
      </Text>
      {text ? <Text style={[styles.delta, { color: positive ? theme.colors.success : theme.colors.labelSecondary }]}>{text}</Text> : null}
    </View>
  );
}

export function ProgressBar({ value, tone = 'tint' }: { value: number; tone?: 'tint' | 'success' }) {
  const styles = useStyles();
  const theme = useTheme();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone === 'success' ? theme.colors.success : theme.colors.tint }]} />
    </View>
  );
}

/** A tappable row inside a grouped list. */
export function ListRow({
  title,
  subtitle,
  value,
  leading,
  onPress,
  isLast,
  starred,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  starred?: boolean;
  accessibilityHint?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, !isLast && styles.divider, pressed && styles.pressed]}
    >
      {leading}
      <View style={styles.flex}>
        <Text style={styles.headline} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.caption} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {starred ? <Star size={13} color={theme.colors.tint} fill={theme.colors.tint} /> : null}
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Chevron size={18} color={theme.colors.labelTertiary} /> : null}
    </Pressable>
  );
}

export function Group({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.group}>{children}</View>;
}

/** "Push A" → "PSH A", "Full Body B" → "FB B" (same rule as the History tab). */
export function badgeFor(code: string): string {
  const words = code.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  const suffix = words.length > 1 && /^[A-Z0-9]$/i.test(words[words.length - 1]) ? ` ${words.pop()!.toUpperCase()}` : '';
  const head = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].replace(/[aeiou]/gi, '').slice(0, 3) || words[0].slice(0, 3);
  return `${head.toUpperCase()}${suffix}`;
}

export function CodeBadge({ code }: { code: string }) {
  const styles = useStyles();
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit>
        {badgeFor(code)}
      </Text>
    </View>
  );
}

/** Back chevron + large title for pushed Progress screens. */
export function ScreenHeader({ title, onBack, trailing }: { title: string; onBack: () => void; trailing?: ReactNode }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const Back = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  return (
    <View style={styles.header}>
      <View style={styles.headerBar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('progress.back')} hitSlop={8} style={styles.back}>
          <Back size={26} color={theme.colors.tint} />
        </Pressable>
        <View style={styles.flex} />
        {trailing}
      </View>
      <Text style={styles.largeTitle} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

export const useStyles = createStyles((t) =>
  StyleSheet.create({
    card: {
      padding: t.spacing.lg,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: t.spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: t.spacing.sm,
    },
    cardTitle: {
      fontFamily: t.fonts.display,
      fontSize: 24,
      lineHeight: 28,
      color: t.colors.label,
      flexShrink: 1,
    },
    cardAction: {
      minHeight: 28,
      justifyContent: 'center',
    },
    cardActionText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.link,
    },
    tile: {
      flexBasis: '47%',
      flexGrow: 1,
      padding: t.spacing.md,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      gap: 2,
    },
    tileValue: {
      fontFamily: t.fonts.display,
      fontSize: 28,
      lineHeight: 32,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    delta: {
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    caption: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
      fontVariant: ['tabular-nums'],
    },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.surfaceHigh,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 4,
    },
    group: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 58,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    pressed: {
      opacity: 0.7,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    headline: {
      ...t.typography.headline,
      color: t.colors.label,
    },
    rowValue: {
      fontFamily: t.fonts.display,
      fontSize: 20,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    badge: {
      width: 44,
      height: 44,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontFamily: t.fonts.display,
      fontSize: 16,
      color: t.colors.tint,
    },
    header: {
      gap: t.spacing.xs,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: HIT,
    },
    back: {
      minWidth: HIT,
      minHeight: HIT,
      justifyContent: 'center',
    },
    largeTitle: {
      ...t.typography.largeTitle,
      color: t.colors.label,
    },
  }),
);
