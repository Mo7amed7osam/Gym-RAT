import { Dumbbell } from 'lucide-react-native';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { getExerciseMedia } from '@/data/media';
import { useExercise } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

interface ExerciseThumbProps {
  exerciseId: string;
  size?: number;
  /** Stretch to the parent's width as a square instead of a fixed size. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Square start-position still (or the custom photo); dumbbell glyph when the exercise has no illustration. */
export function ExerciseThumb({ exerciseId, size = 56, fill = false, style }: ExerciseThumbProps) {
  const styles = useStyles();
  const theme = useTheme();
  const exercise = useExercise(exerciseId);
  const media = getExerciseMedia(exercise);
  const box: ViewStyle = fill
    ? { flex: 1, aspectRatio: 1, borderRadius: theme.radii.row }
    : { width: size, height: size, borderRadius: size >= 48 ? theme.radii.row : 8 };

  if (media.kind === 'none' || !media.start) {
    return (
      <View style={[styles.base, styles.fallback, box, style]} accessibilityElementsHidden importantForAccessibility="no">
        <Dumbbell size={fill ? 22 : size * 0.45} color={theme.colors.labelSecondary} strokeWidth={1.75} />
      </View>
    );
  }

  return (
    <View style={[styles.base, media.kind === 'user_photo' ? styles.photo : styles.artwork, box, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Image source={media.start} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    base: {
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photo: {
      backgroundColor: t.colors.photoBackground,
    },
    artwork: {
      backgroundColor: t.colors.illustrationBackground,
    },
    fallback: {
      backgroundColor: t.colors.surfaceRaised,
    },
    image: {
      width: '100%',
      height: '100%',
    },
  }),
);
