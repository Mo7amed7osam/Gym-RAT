import * as WebBrowser from 'expo-web-browser';
import { CirclePlay, ExternalLink, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EXERCISE_IMAGES, exerciseImageAspect } from '@/assets/exercises';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { HIT, colors, fonts, radii, spacing, typography } from '@/constants/theme';
import { MUSCLE_LABELS, getExercise } from '@/data/exercisesData';
import { ROUTINES } from '@/data/scheduleData';
import type { Exercise } from '@/types/workout';

interface VideoModalProps {
  /** Exercise to show; null hides the modal. */
  exerciseId: string | null;
  onClose: () => void;
}

/**
 * Form-guide sheet: names, target muscles, cues, and the YouTube tutorial —
 * in an in-app browser (SFSafariViewController / Custom Tabs) or the YouTube app.
 */
export function VideoModal({ exerciseId, onClose }: VideoModalProps) {
  const insets = useSafeAreaInsets();
  const exercise = exerciseId ? getExercise(exerciseId) : undefined;

  return (
    <Modal
      visible={exercise !== undefined}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {exercise ? <VideoSheetContent exercise={exercise} onClose={onClose} bottomInset={insets.bottom} /> : null}
    </Modal>
  );
}

function VideoSheetContent({
  exercise,
  onClose,
  bottomInset,
}: {
  exercise: Exercise;
  onClose: () => void;
  bottomInset: number;
}) {
  const [openError, setOpenError] = useState<string | null>(null);

  const usedIn = useMemo(
    () =>
      Object.values(ROUTINES)
        .filter((routine) => routine.exercises.some((item) => item.exerciseId === exercise.id))
        .map((routine) => routine.code),
    [exercise.id],
  );

  const openInApp = async () => {
    setOpenError(null);
    try {
      await WebBrowser.openBrowserAsync(exercise.videoUrl, {
        controlsColor: colors.tint,
        toolbarColor: colors.background,
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch {
      setOpenError("Couldn't open the in-app browser. Try the YouTube app instead.");
    }
  };

  const openExternally = async () => {
    setOpenError(null);
    try {
      // Universal link: opens the YouTube app when installed, otherwise the browser.
      await Linking.openURL(exercise.videoUrl);
    } catch {
      setOpenError("Couldn't open YouTube on this device.");
    }
  };

  const muscles = [...exercise.primaryMuscles, ...exercise.secondaryMuscles];

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Form guide</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close form guide"
          hitSlop={8}
          style={styles.closeButton}
        >
          <X size={20} color={colors.labelSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xxl }]}>
        <Pressable
          onPress={openInApp}
          accessibilityRole="button"
          accessibilityLabel={`Play ${exercise.name.en} tutorial`}
          style={({ pressed }) => [
            styles.player,
            exercise.thumbnailKey ? styles.playerPhoto : styles.playerEmpty,
            exercise.thumbnailKey && { aspectRatio: Math.max(exerciseImageAspect(exercise.thumbnailKey), 1.2) },
            pressed && styles.pressed,
          ]}
        >
          {exercise.thumbnailKey ? (
            <Image source={EXERCISE_IMAGES[exercise.thumbnailKey]} style={styles.photo} resizeMode="cover" />
          ) : (
            <>
              <CirclePlay size={64} color={colors.label} strokeWidth={1.5} />
              <Text style={styles.playerCaption}>Tutorials on YouTube</Text>
            </>
          )}
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {exercise.name.en}
          </Text>
          <Text style={styles.arabic} accessibilityLanguage="ar">
            {exercise.name.ar}
          </Text>
          <View style={styles.chips}>
            {muscles.map((muscle, index) => (
              <Chip
                key={muscle}
                label={MUSCLE_LABELS[muscle].en}
                tone={index < exercise.primaryMuscles.length ? 'tint' : 'neutral'}
              />
            ))}
          </View>
          {usedIn.length > 0 ? <Text style={styles.usedIn}>Programmed in {formatList(usedIn)}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Button label="Watch tutorial" icon={CirclePlay} onPress={openInApp} />
          <Button label="Open in YouTube" icon={ExternalLink} variant="secondary" onPress={openExternally} />
          {openError ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {openError}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Form cues</Text>
          <View style={styles.cues}>
            {exercise.formCues.map((cue, index) => (
              <View key={cue} style={[styles.cueRow, index < exercise.formCues.length - 1 && styles.cueDivider]}>
                <View style={styles.cueNumber}>
                  <Text style={styles.cueNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.cueText}>{cue}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function formatList(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  toolbarTitle: {
    ...typography.headline,
    color: colors.label,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.screen,
    gap: spacing.xl,
  },
  player: {
    aspectRatio: 16 / 9,
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playerEmpty: {
    maxHeight: 240,
  },
  playerPhoto: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  playerCaption: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  header: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.title1,
    color: colors.label,
  },
  arabic: {
    ...typography.arabic,
    fontSize: 15,
    color: colors.labelSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  usedIn: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
  error: {
    ...typography.subheadline,
    color: colors.destructive,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: colors.label,
    paddingHorizontal: spacing.xxs,
  },
  cues: {
    borderRadius: radii.sheet,
    backgroundColor: colors.surface,
  },
  cueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cueDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  cueNumber: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.tintMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.tint,
  },
  cueText: {
    ...typography.body,
    flex: 1,
    color: colors.label,
  },
  pressed: {
    opacity: 0.75,
  },
});
