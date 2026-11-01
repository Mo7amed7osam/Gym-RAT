import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import appConfig from '@/app.json';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { resetAllData } from '@/data/db/boot';
import { SCHEMA_VERSION } from '@/data/db/migrations';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT } from '@/constants/theme';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { applyLayoutDirection, resolveLocale, useT } from '@/i18n';
import { ACCENTS, ACCENT_IDS, createStyles, useTheme } from '@/theme';
import type { AppearanceSettings, Density, LanguageSetting, TextScale, ThemeMode, WorkoutSettings } from '@/types/workout';

type ToggleKey = 'autoStartRestTimer' | 'prefillFromHistory' | 'hapticsEnabled' | 'restSoundEnabled';

const TOGGLES: { key: ToggleKey; title: string; detail: string }[] = [
  { key: 'autoStartRestTimer', title: 'settings.autoRestTitle', detail: 'settings.autoRestDetail' },
  { key: 'prefillFromHistory', title: 'settings.prefillTitle', detail: 'settings.prefillDetail' },
  { key: 'hapticsEnabled', title: 'settings.hapticsTitle', detail: 'settings.hapticsDetail' },
  { key: 'restSoundEnabled', title: 'settings.soundTitle', detail: 'settings.soundDetail' },
];

const WARNING_OPTIONS = [5, 10, 15, 30] as const;
const WARMUP_REST_OPTIONS = [30, 45, 60, 90] as const;
const INACTIVITY_OPTIONS = [0, 10, 20, 30] as const;
const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'settings.modeSystem' },
  { value: 'light', label: 'settings.modeLight' },
  { value: 'dark', label: 'settings.modeDark' },
  { value: 'trueBlack', label: 'settings.modeTrueBlack' },
];
const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: 'default', label: 'settings.scaleDefault' },
  { value: 'large', label: 'settings.scaleLarge' },
  { value: 'xlarge', label: 'settings.scaleXlarge' },
];
const DENSITIES: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'settings.densityComfortable' },
  { value: 'compact', label: 'settings.densityCompact' },
];
const LANGUAGES: { value: LanguageSetting; label: string }[] = [
  { value: 'system', label: 'settings.langSystem' },
  { value: 'en', label: 'settings.langEn' },
  { value: 'ar', label: 'settings.langAr' },
];

export default function SettingsScreen() {
  const t = useT();
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const settings = useWorkoutStore((state) => state.settings);
  const updateSettings = useWorkoutStore((state) => state.updateSettings);
  const sessionCount = useWorkoutStore((state) => state.history.length);
  const persistenceError = useWorkoutStore((state) => state.persistenceError);

  const set = (patch: Partial<WorkoutSettings>) => updateSettings(patch);
  const setAppearance = (patch: Partial<AppearanceSettings>) =>
    updateSettings({ appearance: { ...settings.appearance, ...patch } });
  const setLanguage = (language: LanguageSetting) => {
    updateSettings({ language });
    applyLayoutDirection(resolveLocale(language));
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <View style={[styles.toolbar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title')}
        </Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('settings.close')} hitSlop={8} style={styles.close}>
          <X size={20} color={theme.colors.labelSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}>
        <View style={styles.section}>
          <SectionHeader title={t('settings.appearance')} />
          <View style={[styles.group, styles.groupPadded]}>
            <Text style={styles.rowTitle}>{t('settings.language')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {LANGUAGES.map((option) => {
                const selected = settings.language === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setLanguage(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(option.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.rowDetail}>{t('settings.languageRestart')}</Text>

            <Text style={styles.rowTitle}>{t('settings.theme')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {MODES.map((option) => {
                const selected = settings.appearance.mode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setAppearance({ mode: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(option.label)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rowTitle}>{t('settings.accent')}</Text>
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
                    accessibilityLabel={t('settings.accentA11y', { name: ACCENTS[accent].label })}
                    style={[styles.swatch, { backgroundColor: swatch }, selected && styles.swatchSelected]}
                  />
                );
              })}
            </View>

            <Text style={styles.rowTitle}>{t('settings.textSize')}</Text>
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
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(option.label)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rowTitle}>{t('settings.density')}</Text>
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
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(option.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings.duringWorkout')} />
          <View style={styles.group}>
            {TOGGLES.map((toggle, index) => (
              <View key={toggle.key} style={[styles.row, index < TOGGLES.length - 1 && styles.divider]}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{t(toggle.title)}</Text>
                  <Text style={styles.rowDetail}>{t(toggle.detail)}</Text>
                </View>
                <Switch
                  value={settings[toggle.key]}
                  onValueChange={(value) => set({ [toggle.key]: value })}
                  trackColor={{ true: theme.colors.tint, false: theme.colors.surfaceHigh }}
                  thumbColor={theme.colors.label}
                  accessibilityLabel={t(toggle.title)}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings.restWarning')} />
          <View style={[styles.group, styles.groupPadded]}>
            <Text style={styles.rowDetail}>{t('settings.restWarningDetail')}</Text>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {WARNING_OPTIONS.map((seconds) => {
                const selected = settings.restWarningSeconds === seconds;
                return (
                  <Pressable
                    key={seconds}
                    onPress={() => set({ restWarningSeconds: seconds })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('settings.seconds', { n: seconds })}
                    style={[styles.segment, selected && styles.segmentSelected]}
                  >
                    <Text style={[styles.segmentValue, selected && styles.segmentValueSelected]}>{seconds}</Text>
                    <Text style={[styles.segmentUnit, selected && styles.segmentValueSelected]}>{t('settings.sec')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings.warmupRest')} />
          <View style={[styles.group, styles.groupPadded]}><View style={styles.segmented} accessibilityRole="radiogroup">
            {WARMUP_REST_OPTIONS.map((seconds) => {
              const selected = settings.warmupRestSeconds === seconds;
              return (
                <Pressable
                  key={seconds}
                  onPress={() => set({ warmupRestSeconds: seconds })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('settings.seconds', { n: seconds })}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text style={[styles.segmentValue, selected && styles.segmentValueSelected]}>{seconds}</Text>
                  <Text style={[styles.segmentUnit, selected && styles.segmentValueSelected]}>{t('settings.sec')}</Text>
                </Pressable>
              );
            })}
          </View></View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings.inactivityPrompt')} />
          <View style={[styles.group, styles.groupPadded]}><View style={styles.segmented} accessibilityRole="radiogroup">
            {INACTIVITY_OPTIONS.map((minutes) => {
              const selected = settings.inactivityPromptMinutes === minutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => set({ inactivityPromptMinutes: minutes })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={minutes === 0 ? t('settings.inactivityOff') : t('settings.minutes', { n: minutes })}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text style={[styles.segmentValue, selected && styles.segmentValueSelected]}>{minutes === 0 ? t('settings.inactivityOff') : minutes}</Text>
                  {minutes > 0 ? <Text style={[styles.segmentUnit, selected && styles.segmentValueSelected]}>{t('settings.minutes', { n: '' }).trim()}</Text> : null}
                </Pressable>
              );
            })}
          </View></View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings.yourData')} />
          <View style={styles.group}>
            <View style={[styles.row, styles.divider]}>
              <Text style={[styles.rowTitle, styles.flex]}>{t('settings.loggedSessions')}</Text>
              <Text style={styles.rowValue}>{sessionCount}</Text>
            </View>
            <View style={[styles.row, styles.divider]}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{t('settings.storage')}</Text>
                <Text style={[styles.rowDetail, persistenceError ? styles.errorText : null]}>
                  {persistenceError ? t('settings.storageError', { error: persistenceError }) : t('settings.storageOk', { version: SCHEMA_VERSION })}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setConfirmReset(true)}
              disabled={resetting}
              accessibilityRole="button"
              accessibilityState={{ disabled: resetting }}
              style={({ pressed }) => [styles.row, resetting && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.destructive}>{t('settings.resetAll')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings.about')} />
          <View style={styles.group}>
            <View style={[styles.row, styles.divider]}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{t('settings.creditsRepdb')}</Text>
                <Text style={styles.rowDetail}>{t('settings.creditsRepdbDetail')}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => void Linking.openURL('https://repdb.co')}
              accessibilityRole="link"
              style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}
            >
              <Text style={styles.link}>{t('settings.openLink')}</Text>
            </Pressable>
            <View style={styles.row}>
              <Text style={styles.rowDetail}>{t('settings.version', { version: appConfig.expo.version })}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmReset}
        title={t('settings.resetAllTitle')}
        message={t('settings.resetAllMessage', { count: sessionCount })}
        confirmLabel={t('settings.resetAllConfirm')}
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setResetting(true);
          void resetAllData().finally(() => {
            setResetting(false);
            // Onboarding is now pending; the protected routes redirect to it.
            router.replace('/');
          });
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
    errorText: {
      color: t.colors.destructive,
    },
    link: {
      ...t.typography.body,
      color: t.colors.link,
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
