import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthField } from '@/components/auth/AuthField';
import { BrandMark } from '@/components/auth/BrandMark';
import { BUTTON_HEIGHT, HIT } from '@/constants/theme';
import { isRtlLocale, useLocale, useT } from '@/i18n';
import { useAuthStore } from '@/store/useAuthStore';
import { createStyles, useTheme } from '@/theme';

import { isValidEmail } from './LoginScreen';

/** Always ends in the same "request received" state so the screen never reveals whether an email exists. */
export default function ForgotPasswordScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/auth/login'));
  const BackIcon = isRtlLocale(locale) ? ArrowRight : ArrowLeft;
  const emailError = touched && !isValidEmail(email) ? t('auth.login.emailInvalid') : null;

  const submit = async () => {
    setTouched(true);
    if (!isValidEmail(email)) return;
    setBusy(true);
    setFailed(false);
    const ok = await forgotPassword(email);
    setBusy(false);
    if (ok) setSent(true);
    else setFailed(true);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t('auth.forgot.backToLogin')} hitSlop={8} style={styles.back}>
          <BackIcon size={22} color={theme.colors.label} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <BrandMark compact />
        <View style={styles.card}>
          {sent ? (
            <>
              <View style={styles.sentIcon}>
                <MailCheck size={28} color={theme.colors.tint} />
              </View>
              <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
                {t('auth.forgot.sentTitle')}
              </Text>
              <Text style={styles.body}>{t('auth.forgot.sentBody', { email: email.trim() })}</Text>
              <Pressable onPress={back} accessibilityRole="button" style={({ pressed }) => [styles.submit, pressed && styles.pressed]}>
                <Text style={styles.submitLabel}>{t('auth.forgot.backToLogin')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {t('auth.forgot.title')}
              </Text>
              <Text style={styles.body}>{t('auth.forgot.body')}</Text>
              <AuthField
                label={t('auth.login.email')}
                value={email}
                onChangeText={setEmail}
                error={emailError}
                placeholder={t('auth.login.emailPlaceholder')}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                editable={!busy}
                onSubmitEditing={() => void submit()}
                testID="forgot-email"
              />
              {failed ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {t('auth.forgot.failed')}
                </Text>
              ) : null}
              <Pressable
                onPress={() => void submit()}
                disabled={busy || !isValidEmail(email)}
                accessibilityRole="button"
                accessibilityLabel={busy ? t('auth.forgot.sending') : t('auth.forgot.send')}
                accessibilityState={{ disabled: busy || !isValidEmail(email), busy }}
                style={({ pressed }) => [styles.submit, (busy || !isValidEmail(email)) && styles.disabled, pressed && styles.pressed]}
                testID="forgot-submit"
              >
                {busy ? <ActivityIndicator color={theme.colors.onTint} /> : <Text style={styles.submitLabel}>{t('auth.forgot.send')}</Text>}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    topBar: { paddingHorizontal: t.spacing.sm },
    back: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
    content: { flexGrow: 1, paddingHorizontal: t.spacing.screen },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.sheet,
      borderWidth: 1,
      borderColor: t.colors.edge,
      padding: t.spacing.xl,
      gap: t.spacing.lg,
    },
    sentIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...t.typography.title1, color: t.colors.label },
    body: { ...t.typography.subheadline, color: t.colors.labelSecondary, marginTop: -t.spacing.sm },
    error: { ...t.typography.subheadline, fontWeight: '600', color: t.colors.destructive },
    submit: {
      minHeight: BUTTON_HEIGHT,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitLabel: { fontSize: 17, fontWeight: '700', color: t.colors.onTint },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
  }),
);
