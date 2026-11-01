import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HIT, colors, fonts, radii, spacing, typography } from '@/constants/theme';
import { isSyncConfigured } from '@/lib/sync';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import type { WorkoutSettings } from '@/types/workout';

type ToggleKey = 'autoStartRestTimer' | 'prefillFromHistory' | 'hapticsEnabled' | 'restSoundEnabled';

const TOGGLES: { key: ToggleKey; title: string; detail: string }[] = [
  { key: 'autoStartRestTimer', title: 'Start rest timer after each set', detail: 'Counts down the prescribed rest as soon as you tick a set.' },
  { key: 'prefillFromHistory', title: 'Prefill from last session', detail: 'New workouts start with the weights and reps you logged last time.' },
  { key: 'hapticsEnabled', title: 'Haptics', detail: 'Taps when a set is logged and when rest is over.' },
  { key: 'restSoundEnabled', title: 'Rest-over sound', detail: 'Plays a chime when the rest timer reaches zero.' },
];

const WARNING_OPTIONS = [5, 10, 15, 30] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirmClear, setConfirmClear] = useState(false);

  const settings = useWorkoutStore((state) => state.settings);
  const updateSettings = useWorkoutStore((state) => state.updateSettings);
  const sessionCount = useWorkoutStore((state) => state.history.length);
  const pendingSync = useWorkoutStore((state) => state.syncQueue.length);
  const clearHistory = useWorkoutStore((state) => state.clearHistory);

  const set = (patch: Partial<WorkoutSettings>) => updateSettings(patch);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.root}>
      <View style={[styles.toolbar, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={8} style={styles.close}>
          <X size={20} color={colors.labelSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
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
                  trackColor={{ true: colors.tint, false: colors.surfaceHigh }}
                  thumbColor={colors.label}
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
            <View style={[styles.row, styles.divider]}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Server sync</Text>
                <Text style={styles.rowDetail}>
                  {!isSyncConfigured()
                    ? 'Off. Add EXPO_PUBLIC_API_URL and EXPO_PUBLIC_API_TOKEN to .env.local to back up to your server.'
                    : pendingSync > 0
                      ? `${pendingSync} change${pendingSync === 1 ? '' : 's'} waiting to upload. They send when the server is reachable.`
                      : 'Everything is backed up.'}
                </Text>
              </View>
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
        message={`All ${sessionCount} logged sessions, volume records and PRs will be removed from this phone${isSyncConfigured() ? ' and your server' : ''}.`}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.label,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.screen,
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.sm,
  },
  group: {
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.edge,
    overflow: 'hidden',
  },
  groupPadded: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT + 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowTitle: {
    ...typography.body,
    color: colors.label,
  },
  rowDetail: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: HIT + 8,
    borderRadius: radii.tile,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.tint,
  },
  segmentValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  segmentUnit: {
    ...typography.caption,
    color: colors.labelSecondary,
  },
  segmentValueSelected: {
    color: colors.onTint,
  },
  destructive: {
    ...typography.body,
    fontWeight: '600',
    color: colors.destructive,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
