import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { createStyles } from '@/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Cross-platform confirm (Alert.alert has no buttons on web). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel} />
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create(  {
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.xxl,
      backgroundColor: t.colors.scrim,
    },
    dialog: {
      width: '100%',
      maxWidth: 360,
      gap: t.spacing.md,
      padding: t.spacing.xl,
      borderRadius: t.radii.sheet,
      backgroundColor: t.colors.surface,
    },
    title: {
      ...t.typography.title3,
      color: t.colors.label,
    },
    message: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
    action: {
      flex: 1,
    },
  }),
);
