import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { BrandMark } from '@/components/auth/BrandMark';
import { BUTTON_HEIGHT, HIT } from '@/constants/theme';
import { useT } from '@/i18n';
import { LEASE_DAYS } from '@/services/auth/lease';
import type { AuthErrorCode } from '@/services/auth/types';
import { useAuthStore } from '@/store/useAuthStore';
import { createStyles, useTheme } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string): boolean => EMAIL.test(value.trim());

/**
 * Members-only sign-in (ADR-015). No sign-up, no pricing. Explains why the
 * user was signed out (revoked, disabled, offline lease over) and never
 * mentions whether an email exists. After success the root layout boots the
 * account's database and the protected routes take over.
 */
export default function LoginScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const snapshot = useAuthStore((state) => state.snapshot);
  const signingIn = useAuthStore((state) => state.signingIn);
  const signInError = useAuthStore((state) => state.signInError);
  const retryAfter = useAuthStore((state) => state.signInRetryAfter);
  const configured = useAuthStore((state) => state.configured);
  const signIn = useAuthStore((state) => state.signIn);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState(snapshot.status === 'leaseExpired' ? snapshot.user.email : '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const emailError = touched && !isValidEmail(email) ? t('auth.login.emailInvalid') : null;
  const passwordError = touched && password.length === 0 ? t('auth.login.passwordRequired') : null;
  // Always pressable so a tap surfaces validation; dimmed until both fields look complete.
  const canSubmit = !signingIn && configured;
  const looksReady = isValidEmail(email) && password.length > 0;

  const submit = async () => {
    setTouched(true);
    if (!isValidEmail(email) || password.length === 0) return;
    const ok = await signIn(email, password);
    if (ok) setPassword('');
  };

  const notice = noticeFor(snapshot, t);
  const errorText = !configured ? t('auth.login.errorNotConfigured') : errorTextFor(signInError, retryAfter, t);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + theme.spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bounces={false}
      >
        <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
          <BrandMark />
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
          <Text style={styles.title} accessibilityRole="header">
            {notice ? notice.title : t('auth.login.title')}
          </Text>
          <Text style={styles.subtitle}>{notice ? notice.body : t('auth.login.subtitle')}</Text>

          <View style={styles.fields}>
            <AuthField
              label={t('auth.login.email')}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (signInError) clearError();
              }}
              error={emailError}
              placeholder={t('auth.login.emailPlaceholder')}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!signingIn}
              onSubmitEditing={() => passwordRef.current?.focus()}
              testID="login-email"
            />
            <AuthField
              ref={passwordRef}
              label={t('auth.login.password')}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (signInError) clearError();
              }}
              error={passwordError}
              placeholder={t('auth.login.passwordPlaceholder')}
              secure
              textContentType="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              editable={!signingIn}
              onSubmitEditing={() => void submit()}
              testID="login-password"
            />
          </View>

          {errorText ? (
            <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={signingIn ? t('auth.login.signingIn') : t('auth.login.signIn')}
            accessibilityState={{ disabled: !canSubmit, busy: signingIn }}
            style={({ pressed }) => [styles.submit, (!canSubmit || !looksReady) && styles.submitDisabled, pressed && canSubmit && styles.submitPressed]}
            testID="login-submit"
          >
            {signingIn ? <ActivityIndicator color={theme.colors.onTint} /> : <Text style={styles.submitLabel}>{t('auth.login.signIn')}</Text>}
          </Pressable>

          <Pressable onPress={() => router.push('/auth/forgot')} accessibilityRole="link" style={styles.forgot} hitSlop={8} disabled={signingIn}>
            <Text style={styles.forgotText}>{t('auth.login.forgot')}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: enter }]}>
          <Text style={styles.footerText}>{t('auth.login.noSignup')}</Text>
          <Text style={styles.footerText}>{t('auth.login.localData')}</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Translate = ReturnType<typeof useT>;

function noticeFor(snapshot: ReturnType<typeof useAuthStore.getState>['snapshot'], t: Translate): { title: string; body: string } | null {
  if (snapshot.status === 'leaseExpired') return { title: t('auth.login.leaseExpiredTitle'), body: t('auth.login.leaseExpired', { days: LEASE_DAYS }) };
  if (snapshot.status === 'signedOut' && snapshot.reason === 'session_revoked') return { title: t('auth.login.title'), body: t('auth.login.signedOutRevoked') };
  if (snapshot.status === 'signedOut' && snapshot.reason === 'account_disabled') return { title: t('auth.login.title'), body: t('auth.login.signedOutDisabled') };
  return null;
}

export function errorTextFor(code: AuthErrorCode | null, retryAfter: number | null, t: Translate): string | null {
  switch (code) {
    case null:
      return null;
    case 'invalid_credentials':
    case 'validation':
      return t('auth.login.errorInvalid');
    case 'account_disabled':
      return t('auth.login.errorDisabled');
    case 'rate_limited':
      return retryAfter ? t('auth.login.errorRateLimited', { seconds: retryAfter }) : t('auth.login.errorRateLimitedNoTime');
    case 'network':
      return t('auth.login.errorNetwork');
    default:
      return t('auth.login.errorServer');
  }
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { flexGrow: 1, paddingHorizontal: t.spacing.screen, justifyContent: 'center' },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.sheet,
      borderWidth: 1,
      borderColor: t.colors.edge,
      padding: t.spacing.xl,
      gap: t.spacing.lg,
    },
    title: {
      ...t.typography.title1,
      color: t.colors.label,
    },
    subtitle: {
      ...t.typography.subheadline,
      color: t.colors.labelSecondary,
      marginTop: -t.spacing.sm,
    },
    fields: { gap: t.spacing.md },
    errorBanner: {
      backgroundColor: t.colors.destructiveMuted,
      borderRadius: t.radii.row,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    errorText: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.destructive,
    },
    submit: {
      minHeight: BUTTON_HEIGHT + 2,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tint,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: t.spacing.xs,
    },
    submitDisabled: { opacity: 0.45 },
    submitPressed: { opacity: 0.8 },
    submitLabel: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: t.colors.onTint,
    },
    forgot: { alignSelf: 'center', minHeight: HIT, justifyContent: 'center' },
    forgotText: {
      ...t.typography.subheadline,
      fontWeight: '600',
      color: t.colors.link,
    },
    footer: { marginTop: t.spacing.xxl, gap: t.spacing.xs, alignItems: 'center' },
    footerText: {
      ...t.typography.caption,
      color: t.colors.labelTertiary,
      textAlign: 'center',
    },
  }),
);
