import { createContext, createElement, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';

import * as base from '@/constants/theme';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { AccentId, AppearanceSettings, Density, TextScale, ThemeMode } from '@/types/workout';

/**
 * Runtime theme. `constants/theme.ts` holds the base tokens (the original
 * true-black palette and the type scale); this module derives light / dark /
 * true-black variants, applies the accent, text scale and density, and hands
 * the result to components through `useTheme` / `createStyles`.
 */

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = { [K in keyof typeof base.colors]: string } & { photoBackground: string };

export interface Theme {
  /** Stable key for memoization: mode + accent + scale + density. */
  id: string;
  mode: Exclude<ThemeMode, 'system'>;
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof base.spacing;
  radii: typeof base.radii;
  typography: typeof base.typography;
  fonts: typeof base.fonts;
  restPhaseColors: Record<keyof typeof base.restPhaseColors, string>;
}

// ─── Palettes ────────────────────────────────────────────────────────────────

/** The app's original look: true-black OLED ground. */
const TRUE_BLACK: ThemeColors = { ...base.colors, photoBackground: '#ffffff' };

/** Same hierarchy on a soft dark grey ground. */
const DARK: ThemeColors = {
  ...TRUE_BLACK,
  background: '#0E0E10',
  surface: '#1E1E21',
  surfaceRaised: '#2C2C2E',
  surfaceHigh: '#3A3A3C',
  tabBar: 'rgba(28,28,30,0.9)',
};

const LIGHT: ThemeColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceRaised: '#E9E9EE',
  surfaceHigh: '#D1D1D6',
  separator: 'rgba(60,60,67,0.29)',
  edge: 'rgba(0,0,0,0.06)',
  tabBar: 'rgba(249,249,249,0.92)',
  label: '#000000',
  labelSecondary: 'rgba(60,60,67,0.6)',
  labelTertiary: 'rgba(60,60,67,0.3)',
  tint: '#FF9500',
  tintMuted: 'rgba(255,149,0,0.16)',
  success: '#34C759',
  successMuted: 'rgba(52,199,89,0.16)',
  successRow: 'rgba(52,199,89,0.1)',
  link: '#007AFF',
  linkMuted: 'rgba(0,122,255,0.14)',
  destructive: '#FF3B30',
  destructiveMuted: 'rgba(255,59,48,0.14)',
  onTint: '#000000',
  scrim: 'rgba(0,0,0,0.4)',
  photoBackground: '#ffffff',
};

/** Accent colours: iOS system colours, dark and light variants. */
export const ACCENTS: Record<AccentId, { label: string; dark: string; light: string }> = {
  orange: { label: 'Orange', dark: '#FF9F0A', light: '#FF9500' },
  blue: { label: 'Blue', dark: '#0A84FF', light: '#007AFF' },
  green: { label: 'Green', dark: '#30D158', light: '#34C759' },
  purple: { label: 'Purple', dark: '#BF5AF2', light: '#AF52DE' },
  pink: { label: 'Pink', dark: '#FF375F', light: '#FF2D55' },
  teal: { label: 'Teal', dark: '#64D2FF', light: '#5AC8FA' },
};

export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

const TEXT_SCALE: Record<TextScale, number> = { default: 1, large: 1.1, xlarge: 1.2 };
const DENSITY: Record<Density, number> = { comfortable: 1, compact: 0.85 };

// ─── Derivation ──────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Black text on bright accents, white on deep ones (WCAG-style luminance split). */
function onColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.35 ? '#000000' : '#FFFFFF';
}

function scaleTypography(typography: typeof base.typography, scale: number): typeof base.typography {
  if (scale === 1) return typography;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [name, style] of Object.entries(typography)) {
    const next: Record<string, unknown> = { ...style };
    if (typeof style.fontSize === 'number') next.fontSize = Math.round(style.fontSize * scale);
    if (typeof style.lineHeight === 'number') next.lineHeight = Math.round(style.lineHeight * scale);
    out[name] = next;
  }
  return out as typeof base.typography;
}

function scaleSpacing(spacing: typeof base.spacing, factor: number): typeof base.spacing {
  if (factor === 1) return spacing;
  const out: Record<string, number> = {};
  for (const [name, value] of Object.entries(spacing)) {
    // Screen margins stay put so content never hugs the edge.
    out[name] = name === 'screen' ? value : Math.round(value * factor);
  }
  return out as typeof base.spacing;
}

export function resolveMode(mode: ThemeMode, systemScheme: ColorScheme | null | undefined): Exclude<ThemeMode, 'system'> {
  if (mode !== 'system') return mode;
  // System dark resolves to true black so the original look is the default.
  return systemScheme === 'light' ? 'light' : 'trueBlack';
}

export function buildTheme(appearance: AppearanceSettings, systemScheme: ColorScheme | null | undefined): Theme {
  const mode = resolveMode(appearance.mode, systemScheme);
  const scheme: ColorScheme = mode === 'light' ? 'light' : 'dark';
  const palette = mode === 'light' ? LIGHT : mode === 'dark' ? DARK : TRUE_BLACK;
  const accent = ACCENTS[appearance.accent][scheme];
  const colors: ThemeColors = {
    ...palette,
    tint: accent,
    tintMuted: rgba(accent, scheme === 'dark' ? 0.18 : 0.16),
    onTint: onColor(accent),
  };
  return {
    id: `${mode}:${appearance.accent}:${appearance.textScale}:${appearance.density}`,
    mode,
    scheme,
    colors,
    spacing: scaleSpacing(base.spacing, DENSITY[appearance.density]),
    radii: base.radii,
    typography: scaleTypography(base.typography, TEXT_SCALE[appearance.textScale]),
    fonts: base.fonts,
    restPhaseColors: {
      idle: colors.surfaceHigh,
      paused: colors.labelSecondary,
      running: colors.link,
      warning: colors.tint,
      overtime: colors.destructive,
    },
  };
}

/** The original look; used when no provider is mounted (tests) and as the fallback. */
export const DEFAULT_THEME: Theme = buildTheme(
  { mode: 'trueBlack', accent: 'orange', textScale: 'default', density: 'comfortable' },
  'dark',
);

// ─── React ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const appearance = useWorkoutStore((state) => state.settings.appearance);
  const systemScheme = useColorScheme();
  const theme = useMemo(() => buildTheme(appearance, systemScheme), [appearance, systemScheme]);

  // Forced modes also steer native UI (alerts, keyboard, pickers).
  useEffect(() => {
    Appearance.setColorScheme(appearance.mode === 'system' ? 'unspecified' : theme.scheme);
  }, [appearance.mode, theme.scheme]);

  return createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext) ?? DEFAULT_THEME;
}

/**
 * Component stylesheet bound to the theme. Define at module level:
 *   const useStyles = createStyles((t) => StyleSheet.create({ ... }));
 * and call `const styles = useStyles();` inside the component.
 */
export function createStyles<T extends Record<string, object>>(factory: (theme: Theme) => T): () => T {
  const cache = new Map<string, T>();
  return function useStyles(): T {
    const theme = useTheme();
    const cached = cache.get(theme.id);
    if (cached) return cached;
    const styles = factory(theme);
    cache.set(theme.id, styles);
    return styles;
  };
}

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  trueBlack: 'True Black',
};
