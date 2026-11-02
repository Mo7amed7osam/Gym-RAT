import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { createStyles, useTheme } from '@/theme';

interface AuthFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  error?: string | null;
  secure?: boolean;
}

/**
 * Labelled input for the sign-in forms: 52 pt tall, accent focus ring,
 * inline error announced to VoiceOver, optional show / hide for passwords.
 */
export const AuthField = forwardRef<ComponentRef<typeof TextInput>, AuthFieldProps>(function AuthField({ label, error, secure = false, editable = true, ...input }, ref) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.root}>
      <Text style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null, !editable && styles.boxDisabled]}>
        <TextInput
          ref={ref}
          {...input}
          editable={editable}
          secureTextEntry={secure && !revealed}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${label}-label`}
          placeholderTextColor={theme.colors.labelTertiary}
          selectionColor={theme.colors.tint}
          cursorColor={theme.colors.tint}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
            accessibilityState={{ selected: revealed }}
            hitSlop={8}
            style={styles.eye}
          >
            {revealed ? <EyeOff size={20} color={theme.colors.labelSecondary} /> : <Eye size={20} color={theme.colors.labelSecondary} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.xs },
    label: {
      ...t.typography.footnote,
      color: t.colors.labelSecondary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginStart: t.spacing.xxs,
    },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      borderRadius: t.radii.tile,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.edge,
      paddingStart: t.spacing.lg,
    },
    boxFocused: { borderColor: t.colors.tint },
    boxError: { borderColor: t.colors.destructive },
    boxDisabled: { opacity: 0.6 },
    input: {
      flex: 1,
      ...t.typography.body,
      color: t.colors.label,
      paddingVertical: t.spacing.md,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    eye: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    error: {
      ...t.typography.caption,
      color: t.colors.destructive,
      marginStart: t.spacing.xxs,
    },
  }),
);
