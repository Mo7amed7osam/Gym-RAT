import { X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';

export interface SheetAction {
  key: string;
  label: string;
  detail?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface ExerciseOptionsSheetProps {
  visible: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}

/** Bottom sheet of exercise actions during a workout; advanced controls live here, not on the card. */
export function ExerciseOptionsSheet({ visible, title, actions, onClose }: ExerciseOptionsSheetProps) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('library.detail.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('library.detail.close')} hitSlop={8} style={styles.closeButton}>
              <X size={18} color={theme.colors.labelSecondary} strokeWidth={2.5} />
            </Pressable>
          </View>
          <ScrollView style={styles.list} bounces={false}>
            {actions.map((action, index) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  if (action.disabled) return;
                  action.onPress();
                }}
                disabled={action.disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: action.disabled }}
                style={({ pressed }) => [styles.row, index < actions.length - 1 && styles.divider, action.disabled && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.label, action.destructive && styles.destructive]}>{action.label}</Text>
                {action.detail ? <Text style={styles.detail}>{action.detail}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim },
    sheet: { maxHeight: '80%', borderTopLeftRadius: t.radii.sheet, borderTopRightRadius: t.radii.sheet, backgroundColor: t.colors.surface, paddingTop: t.spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.sm, gap: t.spacing.sm },
    title: { ...t.typography.headline, color: t.colors.label, flex: 1 },
    closeButton: { width: 32, height: 32, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    list: { paddingHorizontal: t.spacing.xl },
    row: { minHeight: HIT + 4, justifyContent: 'center', paddingVertical: t.spacing.sm, gap: 2 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    label: { ...t.typography.body, color: t.colors.label },
    detail: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary },
    destructive: { color: t.colors.destructive },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.6 },
  }),
);
