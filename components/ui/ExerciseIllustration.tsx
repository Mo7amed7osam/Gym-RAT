import { Dumbbell } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { getExerciseMedia } from '@/data/media';
import { useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';
import type { Exercise } from '@/types/workout';

interface ExerciseIllustrationProps {
  exercise: Exercise | undefined;
  /** Compact: a single frame, no labels (workout card). Full: start/end toggle with labels (detail screen). */
  variant?: 'compact' | 'full';
  style?: StyleProp<ViewStyle>;
}

/**
 * Static illustration (ADR-004): RepDB start/end stills for exact matches,
 * the user's photo for custom exercises, or a consistent labelled fallback.
 * Never animated; "Start" / "End" are positions, not a loop.
 */
export function ExerciseIllustration({ exercise, variant = 'full', style }: ExerciseIllustrationProps) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const [frame, setFrame] = useState<'start' | 'end'>('start');
  const media = getExerciseMedia(exercise);

  if (media.kind === 'none') {
    return (
      <View style={[styles.frame, styles.fallback, style]} accessibilityLabel={t('library.noIllustration')}>
        <Dumbbell size={variant === 'full' ? 40 : 28} color={theme.colors.labelTertiary} strokeWidth={1.5} />
        <Text style={styles.fallbackText}>{t('library.noIllustration')}</Text>
      </View>
    );
  }

  const source = frame === 'end' && media.end ? media.end : media.start;
  const canToggle = variant === 'full' && media.kind === 'still_pair';

  return (
    <View style={[styles.frame, styles.artwork, style]}>
      <Pressable
        onPress={canToggle ? () => setFrame(frame === 'start' ? 'end' : 'start') : undefined}
        accessibilityRole={canToggle ? 'button' : 'image'}
        accessibilityLabel={
          media.kind === 'user_photo'
            ? t('library.userPhotoA11y')
            : t('library.illustrationA11y', { position: t(frame === 'start' ? 'library.positionStart' : 'library.positionEnd') })
        }
        accessibilityHint={canToggle ? t('library.toggleHint') : undefined}
        style={styles.pressable}
      >
        <Image source={source ?? undefined} style={styles.image} resizeMode={media.kind === 'user_photo' ? 'cover' : 'contain'} accessibilityIgnoresInvertColors />
        {canToggle ? (
          <View style={styles.toggle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {(['start', 'end'] as const).map((item) => (
              <View key={item} style={[styles.toggleItem, item === frame && styles.toggleItemSelected]}>
                <Text style={[styles.toggleText, item === frame && styles.toggleTextSelected]}>
                  {t(item === 'start' ? 'library.positionStart' : 'library.positionEnd')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    frame: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: t.radii.card,
      overflow: 'hidden',
    },
    artwork: {
      backgroundColor: t.colors.illustrationBackground,
    },
    fallback: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.edge,
    },
    fallbackText: {
      ...t.typography.footnote,
      color: t.colors.labelSecondary,
    },
    pressable: { flex: 1 },
    image: { width: '100%', height: '100%' },
    toggle: {
      position: 'absolute',
      bottom: t.spacing.md,
      alignSelf: 'center',
      flexDirection: 'row',
      padding: 3,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.scrim,
    },
    toggleItem: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xxs,
      borderRadius: t.radii.pill,
    },
    toggleItemSelected: {
      backgroundColor: t.colors.label,
    },
    toggleText: {
      ...t.typography.footnote,
      color: t.colors.label,
    },
    toggleTextSelected: {
      color: t.colors.background,
    },
  }),
);
