import { Dumbbell } from 'lucide-react-native';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { EXERCISE_IMAGES } from '@/assets/exercises';
import { colors, radii } from '@/constants/theme';
import { getExercise } from '@/data/exercisesData';

interface ExerciseThumbProps {
  exerciseId: string;
  size?: number;
  /** Stretch to the parent's width as a square instead of a fixed size. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Square crop of the exercise's PDF photo on white; dumbbell glyph when there is none. */
export function ExerciseThumb({ exerciseId, size = 56, fill = false, style }: ExerciseThumbProps) {
  const key = getExercise(exerciseId)?.thumbnailKey;
  const box: ViewStyle = fill
    ? { flex: 1, aspectRatio: 1, borderRadius: radii.row }
    : { width: size, height: size, borderRadius: size >= 48 ? radii.row : 8 };

  if (!key) {
    return (
      <View style={[styles.base, styles.fallback, box, style]} accessibilityElementsHidden importantForAccessibility="no">
        <Dumbbell size={fill ? 22 : size * 0.45} color={colors.labelSecondary} strokeWidth={1.75} />
      </View>
    );
  }

  return (
    <View style={[styles.base, styles.photo, box, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Image source={EXERCISE_IMAGES[key]} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    backgroundColor: '#ffffff',
  },
  fallback: {
    backgroundColor: colors.surfaceRaised,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
