import { colors as baseColors, spacing as baseSpacing, typography as baseTypography } from '@/constants/theme';
import { ACCENTS, DEFAULT_THEME, buildTheme, resolveMode } from '@/theme';

const appearance = { mode: 'system' as const, accent: 'orange' as const, textScale: 'default' as const, density: 'comfortable' as const };

describe('theme', () => {
  it('resolves system to true black in dark and light in light, and keeps the original palette for true black', () => {
    expect(resolveMode('system', 'dark')).toBe('trueBlack');
    expect(resolveMode('system', null)).toBe('trueBlack');
    expect(resolveMode('system', 'light')).toBe('light');
    expect(resolveMode('dark', 'light')).toBe('dark');
    const theme = buildTheme(appearance, 'dark');
    expect(theme.mode).toBe('trueBlack');
    expect(theme.colors.background).toBe(baseColors.background);
    expect(theme.colors.tint).toBe(baseColors.tint);
    expect(theme.colors.onTint).toBe(baseColors.onTint);
    expect(theme.typography).toBe(baseTypography);
    expect(theme.spacing).toBe(baseSpacing);
    expect(theme.id).toBe(DEFAULT_THEME.id);
  });

  it('applies accents with a readable foreground', () => {
    expect(buildTheme({ ...appearance, accent: 'blue' }, 'dark').colors.tint).toBe(ACCENTS.blue.dark);
    expect(buildTheme({ ...appearance, accent: 'blue' }, 'dark').colors.onTint).toBe('#FFFFFF');
    expect(buildTheme({ ...appearance, accent: 'green' }, 'light').colors.onTint).toBe('#000000');
    expect(buildTheme({ ...appearance, accent: 'purple' }, 'light').colors.tintMuted).toMatch(/^rgba\(/);
  });

  it('scales type and spacing but never the screen margin', () => {
    const large = buildTheme({ ...appearance, textScale: 'xlarge', density: 'compact' }, 'dark');
    expect(large.typography.body.fontSize).toBe(Math.round(baseTypography.body.fontSize * 1.2));
    expect(large.spacing.lg).toBe(Math.round(baseSpacing.lg * 0.85));
    expect(large.spacing.screen).toBe(baseSpacing.screen);
    expect(large.id).not.toBe(DEFAULT_THEME.id);
  });

  it('light mode uses a light scheme and dark navigation colours flip', () => {
    const light = buildTheme({ ...appearance, mode: 'light' }, 'dark');
    expect(light.scheme).toBe('light');
    expect(light.colors.label).toBe('#000000');
    expect(light.restPhaseColors.running).toBe(light.colors.link);
  });
});
