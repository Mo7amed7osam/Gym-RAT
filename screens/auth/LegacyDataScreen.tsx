import { useRouter } from 'expo-router';
import { Archive } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { EMPTY_PROBE, claimLegacyData, type LegacyDataProbe } from '@/data/db/boot';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/useAuthStore';
import { createStyles, useTheme } from '@/theme';

import { legacyPromptState } from './legacyPrompt';

/**
 * Pre-account data found on the phone (ADR-016). Explicit choice: attach it
 * to the signed-in account or leave it as it is. Nothing is deleted either way.
 */
export default function LegacyDataScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const snapshot = useAuthStore((state) => state.snapshot);
  const user = snapshot.status === 'signedIn' ? snapshot.user : null;
  const probe: LegacyDataProbe = legacyPromptState.probe ?? EMPTY_PROBE;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const claim = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await claimLegacyData(user.id);
      legacyPromptState.probe = null;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  const facts = [
    probe.sessions > 0 ? t('auth.legacy.sessions', { count: probe.sessions }) : null,
    probe.customExercises > 0 ? t('auth.legacy.exercises', { count: probe.customExercises }) : null,
    probe.userPlans > 0 ? t('auth.legacy.plans', { count: probe.userPlans }) : null,
    probe.bodyEntries > 0 ? t('auth.legacy.body_entries', { count: probe.bodyEntries }) : null,
    probe.goals > 0 ? t('auth.legacy.goals', { count: probe.goals }) : null,
  ].filter((item): item is string => item !== null);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.xxl, paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <View style={styles.icon}>
          <Archive size={30} color={theme.colors.tint} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('auth.legacy.title')}
        </Text>
        <Text style={styles.body}>{t('auth.legacy.body', { email: user?.email ?? '' })}</Text>
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact} style={styles.fact}>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {t('auth.legacy.failed', { error })}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => void claim()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={busy ? t('auth.legacy.working') : t('auth.legacy.claim')}
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && styles.pressed]}
            testID="legacy-claim"
          >
            {busy ? <ActivityIndicator color={theme.colors.onTint} /> : <Text style={styles.primaryLabel}>{t('auth.legacy.claim')}</Text>}
          </Pressable>
          <Button label={t('auth.legacy.later')} variant="secondary" onPress={close} disabled={busy} />
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { flexGrow: 1, paddingHorizontal: t.spacing.screen, gap: t.spacing.lg, justifyContent: 'center' },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...t.typography.largeTitle, color: t.colors.label },
    body: { ...t.typography.body, color: t.colors.labelSecondary },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    fact: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: t.colors.edge,
    },
    factText: { ...t.typography.footnote, color: t.colors.label },
    error: { ...t.typography.subheadline, fontWeight: '600', color: t.colors.destructive },
    actions: { gap: t.spacing.sm, marginTop: t.spacing.lg },
    primary: {
      minHeight: 52,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: { fontSize: 17, fontWeight: '700', color: t.colors.onTint },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
  }),
);
