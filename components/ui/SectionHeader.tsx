import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HIT } from '@/constants/theme';
import { createStyles } from '@/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.xxs,
      minHeight: 28,
    },
    title: {
      fontFamily: t.fonts.display,
      fontSize: 24,
      lineHeight: 28,
      color: t.colors.label,
    },
    action: {
      minHeight: HIT,
      justifyContent: 'center',
      marginVertical: -8,
    },
    actionText: {
      fontSize: 15,
      fontWeight: '500',
      color: t.colors.link,
    },
  }),
);
