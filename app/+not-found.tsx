import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { createStyles } from '@/theme';


export default function NotFoundScreen() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
      <Link href="/" style={styles.link}>
        Go to Today
      </Link>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.lg,
      padding: t.spacing.xl,
      backgroundColor: t.colors.background,
    },
    title: {
      ...t.typography.title3,
      color: t.colors.label,
    },
    link: {
      ...t.typography.headline,
      color: t.colors.link,
      paddingVertical: t.spacing.md,
    },
  }),
);
