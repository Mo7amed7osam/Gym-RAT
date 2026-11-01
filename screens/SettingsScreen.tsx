import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT } from '@/constants/theme';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { ACCENTS, ACCENT_IDS, THEME_MODE_LABELS, createStyles, useTheme } from '@/theme';
import type { AppearanceSettings, Density, TextScale, ThemeMode, WorkoutSettings } from '@/types/workout';

type ToggleKey = 'autoStartRestTimer' | 'prefillFromHistory' | 'hapticsEnabled' | 'restSoundEnabled';

const TOGGLES: { key: ToggleKey; title: string; detail: string }[] = [
  { key: 'autoStartRestTimer', title: 'Start rest timer after each set', detail: 'Counts down the prescribed rest as soon as you tick a set.' },
  { key: 'prefillFromHistory', title: 'Prefill from last session', detail: 'New workouts start with the weights and reps you logged last time.' },
  { key: 'hapticsEnabled', title: 'Haptics', detail: 'Taps when a set is logged and when rest is over.' },
  { key: 'restSoundEnabled', title: 'Rest-over sound', detail: 'Plays a chime when the rest timer reaches zero.' },
];

const WARNING_OPTIONS = [5, 10, 15, 30] as const;
const MODES: ThemeMode[] = ['system', 'light', 'dark', 'trueBlack'];
const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Larger' },
];
const DENSITIES: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

export default function SettingsScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirmClear, setConfirmClear] = useState(false);

  const settings = useWorkoutStore((state) => state.settings);
  const updateSettings = useWorkoutStore((state) => state.updateSettings);
  const sessionCount = useWorkoutStore((state) => state.history.length);
  const clearHistory = useWorkoutStore((state) => state.clearHistory);

  const set = (patch: Partial<WorkoutSettings>) => updateSettings(patch);
  const setAppearance = (patch: Partial<AppearanceSettings>) =>
    updateSettings({ appearance: { ...settings.appearance, ...patch } });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <View style={[styles.toolbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={8} style={styles.close}>
          <X size={20} color={theme.colors.labelSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}>
        <View style={styles.section}>
          <SectionHeader title="Appearance" />
          <View style={[styles.group, styles.groupPadded]}>
            <Text style={styles.rowTitle}>Theme</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {MODES.map((mode) => {
                const selected = settings.appearance.mode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setAppearance({ mode })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{THEME_MODE_LABELS[mode]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rowTitle}>Accent</Text>
            <View style={styles.swatches} accessibilityRole="radiogroup">
              {ACCENT_IDS.map((accent) => {
                const selected = settings.appearance.accent === accent;
                const swatch = ACCENTS[accent][theme.scheme];
                return (
                  <Pressable
                    key={accent}
                    onPress={() => setAppearance({ accent })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${ACCENTS[accent].label} accent`}
                    style={[styles.swatch, { backgroundColor: swatch }, selected && styles.swatchSelected]}
                  />
                );
              })}
            </View>

            <Text style={styles.rowTitle}>Text size</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {TEXT_SCALES.map((option) => {
                const selected = settings.appearance.textScale === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setAppearance({ textScale: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rowTitle}>Density</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {DENSITIES.map((option) => {
                const selected = settings.appearance.density === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setAppearance({ density: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="During a workout" />
          <View style={styles.group}>
            {TOGGLES.map((toggle, index) => (
              <View key={toggle.key} style={[styles.row, index < TOGGLES.length - 1 && styles.divider]}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{toggle.title}</Text>
                  <Text style={styles.rowDetail}>{toggle.detail}</Text>
                </View>
                <Switch
                  value={settings[toggle.key]}
                  onValueChange={(value) => set({ [toggle.key]: value })}
                  trackColor={{ true: theme.colors.tint, false: theme.colors.surfaceHigh }}
                  thumbColor={theme.colors.label}
                  accessibilityLabel={toggle.title}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Rest timer warning" />
          <View style={[styles.group, styles.groupPadded]}>
            <Text style={styles.rowDetail}>The ring turns orange when this much rest is left.</Text>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {WARNING_OPTIONS.map((seconds) => {
                const selected = settings.restWarningSeconds === seconds;
                return (
                  <Pressable
                    key={seconds}
                    onPress={() => set({ restWarningSeconds: seconds })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${seconds} seconds`}
                    style={[styles.segment, selected && styles.segmentSelected]}
                  >
                    <Text style={[styles.segmentValue, selected && styles.segmentValueSelected]}>{seconds}</Text>
                    <Text style={[styles.segmentUnit, selected && styles.segmentValueSelected]}>sec</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Your data" />
          <View style={styles.group}>
            <View style={[styles.row, styles.divider]}>
              <Text style={[styles.rowTitle, styles.flex]}>Logged sessions</Text>
              <Text style={styles.rowValue}>{sessionCount}</Text>
            </View>
            <Pressable
              onPress={() => setConfirmClear(true)}
              disabled={sessionCount === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: sessionCount === 0 }}
              style={({ pressed }) => [styles.row, sessionCount === 0 && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.destructive}>Delete all history</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmClear}
        title="Delete all history?"
        message={`All ${sessionCount} logged sessions, volume records and PRs will be removed from this phone.`}
        confirmLabel="Delete all"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory();
          setConfirmClear(false);
        }}
      />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flex: {
      flex: 1,
      minWidth: 0,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.screen,
      paddingBottom: t.spacing.md,
    },
    title: {
      ...t.typography.largeTitle,
      color: t.colors.label,
    },
    close: {
      width: 32,
      height: 32,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: t.spacing.screen,
      gap: t.spacing.xxl,
    },
    section: {
      gap: t.spacing.sm,
    },
    group: {
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.edge,
      overflow: 'hidden',
    },
    groupPadded: {
      padding: t.spacing.lg,
      gap: t.spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: HIT + 12,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.separator,
    },
    rowTitle: {
      ...t.typography.body,
      color: t.colors.label,
    },
    rowDetail: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      marginTop: 2,
    },
    rowValue: {
      fontFamily: t.fonts.display,
      fontSize: 22,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.sm,
    },
    chip: {
      minHeight: 36,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: t.colors.tint,
    },
    chipText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.colors.label,
    },
    chipTextSelected: {
      color: t.colors.onTint,
    },
    swatches: {
      flexDirection: 'row',
      gap: t.spacing.md,
    },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: t.radii.pill,
    },
    swatchSelected: {
      borderWidth: 3,
      borderColor: t.colors.label,
    },
    segmented: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    segment: {
      flex: 1,
      minHeight: HIT + 8,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentSelected: {
      backgroundColor: t.colors.tint,
    },
    segmentValue: {
      fontFamily: t.fonts.display,
      fontSize: 22,
      lineHeight: 24,
      color: t.colors.label,
      fontVariant: ['tabular-nums'],
    },
    segmentUnit: {
      ...t.typography.caption,
      color: t.colors.labelSecondary,
    },
    segmentValueSelected: {
      color: t.colors.onTint,
    },
    destructive: {
      ...t.typography.body,
      fontWeight: '600',
      color: t.colors.destructive,
    },
    disabled: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.7,
    },
  }),
);
