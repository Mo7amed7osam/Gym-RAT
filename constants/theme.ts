import { Platform, type TextStyle } from 'react-native';

/**
 * Design tokens from the approved "PPL Coach" design canvas:
 * true-black OLED ground, iOS semantic grays, one orange tint,
 * monospaced digits for every number. Headlines use Barlow Condensed —
 * the tall, narrow lettering of gym signage and plate stamps — while body
 * copy, inputs and Arabic stay on the system font.
 */

export const colors = {
  background: '#000000',
  surface: '#1C1C1E', // secondarySystemGroupedBackground — cards
  surfaceRaised: '#2C2C2E', // tertiarySystemFill — inputs, chips, stat tiles
  surfaceHigh: '#3A3A3C',
  separator: 'rgba(84,84,88,0.6)',
  /** 1px edge on raised cards so they read as objects, not grey patches. */
  edge: 'rgba(255,255,255,0.07)',
  tabBar: 'rgba(22,22,24,0.9)',

  label: '#FFFFFF',
  labelSecondary: 'rgba(235,235,245,0.6)',
  labelTertiary: 'rgba(235,235,245,0.3)', // decorative only

  tint: '#FF9F0A', // systemOrange — primary actions
  tintMuted: 'rgba(255,159,10,0.18)',
  success: '#30D158',
  successMuted: 'rgba(48,209,88,0.18)',
  successRow: 'rgba(48,209,88,0.1)',
  link: '#0A84FF', // links + running rest timer
  linkMuted: 'rgba(10,132,255,0.18)',
  destructive: '#FF453A',
  destructiveMuted: 'rgba(255,69,58,0.18)',

  onTint: '#000000',
  scrim: 'rgba(0,0,0,0.6)',
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 16,
} as const;

export const radii = {
  row: 10,
  tile: 12,
  card: 14,
  sheet: 20,
  pill: 999,
} as const;

/** Minimum touch target (HIG). */
export const HIT = 44;
export const BUTTON_HEIGHT = 50;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  /** Loaded in app/_layout.tsx. Weight lives in the family name, so never pair with fontWeight. */
  display: 'BarlowCondensed_700Bold',
  displayHeavy: 'BarlowCondensed_800ExtraBold',
  displayMedium: 'BarlowCondensed_600SemiBold',
} as const;

export const typography = {
  /** Hero routine name, e.g. "Pull A". */
  display: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 64, lineHeight: 66, letterSpacing: -0.5 },
  largeTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 40, lineHeight: 44, letterSpacing: 0 },
  title1: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 32, lineHeight: 34, letterSpacing: 0 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  arabic: { fontSize: 14, lineHeight: 20, fontWeight: '500', writingDirection: 'rtl', textAlign: 'right' },
  /** Big rest-timer digits. */
  timer: { fontSize: 76, lineHeight: 84, fontWeight: '700', letterSpacing: -1, fontVariant: tabular },
  /** Weight / rep values. */
  metric: { fontSize: 22, lineHeight: 28, fontWeight: '600', fontVariant: tabular },
  /** "57.5 × 12" previous-set reference. */
  mono: { fontSize: 15, lineHeight: 20, fontWeight: '500', fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

export const tabularNums = tabular;

/** Rest timer ring colours: hue and lightness both change between states. */
export const restPhaseColors = {
  idle: colors.surfaceHigh,
  paused: colors.labelSecondary,
  running: colors.link,
  warning: colors.tint,
  overtime: colors.destructive,
} as const;
