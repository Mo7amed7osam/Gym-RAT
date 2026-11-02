import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { probeLegacyData, removeAccountData, type LegacyDataProbe } from '@/data/db/boot';
import { useT } from '@/i18n';
import { formatShortDate, formatTime } from '@/lib/format';
import { legacyPromptState } from '@/screens/auth/legacyPrompt';
import { leaseDaysLeft } from '@/services/auth/lease';
import { useAuthStore } from '@/store/useAuthStore';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createStyles, useTheme } from '@/theme';

/**
 * Settings › Account (ADR-015/016): who is signed in, how long offline access
 * lasts, sign out (keeps data), remove this account's data (confirmed), and
 * attaching pre-account workouts when the phone still has some.
 */
export function AccountSection() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const snapshot = useAuthStore((state) => state.snapshot);
  const signOut = useAuthStore((state) => state.signOut);
  const revalidate = useAuthStore((state) => state.revalidate);
  const sessionCount = useWorkoutStore((state) => state.history.length);

  const [confirm, setConfirm] = useState<'signOut' | 'remove' | null>(null);
  const [busy, setBusy] = useState<'check' | 'signOut' | 'remove' | null>(null);
  const [legacy, setLegacy] = useState<LegacyDataProbe | null>(null);

  const signedIn = snapshot.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    probeLegacyData()
      .then((probe) => {
        if (!cancelled) setLegacy(probe.hasUserData ? probe : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (snapshot.status !== 'signedIn') return null;
  const { user, lease, validatedAt, offline, leaseRemainingMs, leaseWarning, clockSuspect } = snapshot;
  const leaseEnd = `${formatShortDate(lease.expiresAt)} · ${formatTime(lease.expiresAt)}`;

  const checkNow = async () => {
    setBusy('check');
    await revalidate();
    setBusy(null);
  };
  const doSignOut = async () => {
    setConfirm(null);
    setBusy('signOut');
    await signOut('user');
    // The protected routes switch to the sign-in wall on their own.
  };
  const doRemove = async () => {
    setConfirm(null);
    setBusy('remove');
    try {
      await removeAccountData(user.id);
    } finally {
      await signOut('user');
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader title={t('auth.account.section')} />
      <View style={styles.group}>
        <View style={[styles.row, styles.divider]}>
          <View style={styles.flex}>
            <Text style={styles.rowDetail}>{t('auth.account.signedInAs')}</Text>
            <Text style={styles.rowTitle}>{user.displayName}</Text>
            <Text style={styles.rowDetail}>{user.email}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.divider]}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{t('auth.account.offlineAccess')}</Text>
            <Text style={[styles.rowDetail, leaseWarning && styles.warning]}>
              {leaseWarning ? t('auth.account.offlineWarning', { days: leaseDaysLeft(leaseRemainingMs) }) : t('auth.account.offlineUntil', { date: leaseEnd })}
            </Text>
            <Text style={styles.rowDetail}>{t('auth.account.lastChecked', { date: `${formatShortDate(validatedAt)} · ${formatTime(validatedAt)}` })}</Text>
            {offline ? <Text style={[styles.rowDetail, styles.warning]}>{t('auth.account.offlineNow')}</Text> : null}
            {clockSuspect ? <Text style={[styles.rowDetail, styles.warning]}>{t('auth.account.clockSuspect')}</Text> : null}
          </View>
          <Pressable onPress={() => void checkNow()} disabled={busy !== null} accessibilityRole="button" accessibilityState={{ disabled: busy !== null, busy: busy === 'check' }} hitSlop={8} style={styles.inlineAction}>
            {busy === 'check' ? <ActivityIndicator color={theme.colors.link} /> : <Text style={styles.link}>{t('auth.account.checkNow')}</Text>}
          </Pressable>
        </View>

        <View style={[styles.row, styles.divider]}>
          <Text style={[styles.rowDetail, styles.flex]}>{t('auth.account.deviceOnly')}</Text>
        </View>

        {legacy ? (
          <Pressable
            onPress={() => {
              if (sessionCount > 0) return;
              legacyPromptState.probe = legacy;
              router.push('/auth/legacy-data');
            }}
            disabled={sessionCount > 0 || busy !== null}
            accessibilityRole="button"
            accessibilityState={{ disabled: sessionCount > 0 || busy !== null }}
            style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}
          >
            <View style={styles.flex}>
              <Text style={sessionCount > 0 ? styles.rowTitle : styles.link}>{t('auth.account.attachLegacy')}</Text>
              <Text style={styles.rowDetail}>{sessionCount > 0 ? t('auth.account.attachLegacyBlocked') : t('auth.account.attachLegacyDetail', { count: legacy.sessions })}</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable onPress={() => setConfirm('signOut')} disabled={busy !== null} accessibilityRole="button" accessibilityState={{ disabled: busy !== null }} style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}>
          {busy === 'signOut' ? <ActivityIndicator color={theme.colors.link} /> : <Text style={styles.link}>{t('auth.account.signOut')}</Text>}
        </Pressable>
        <Pressable onPress={() => setConfirm('remove')} disabled={busy !== null} accessibilityRole="button" accessibilityState={{ disabled: busy !== null }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          {busy === 'remove' ? <ActivityIndicator color={theme.colors.destructive} /> : <Text style={styles.destructive}>{t('auth.account.removeData')}</Text>}
        </Pressable>
      </View>

      <ConfirmDialog
        visible={confirm === 'signOut'}
        title={t('auth.account.signOutTitle')}
        message={t('auth.account.signOutMessage', { count: sessionCount })}
        confirmLabel={t('auth.account.signOutConfirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doSignOut()}
      />
      <ConfirmDialog
        visible={confirm === 'remove'}
        title={t('auth.account.removeDataTitle')}
        message={t('auth.account.removeDataMessage', { count: sessionCount })}
        confirmLabel={t('auth.account.removeDataConfirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => void doRemove()}
      />
    </View>
  );
}

const useStyles = createStyles((t) =>
  StyleSheet.create({
    section: { gap: t.spacing.sm },
    group: { backgroundColor: t.colors.surface, borderRadius: t.radii.card, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, minHeight: 48 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
    flex: { flex: 1, gap: 2 },
    rowTitle: { ...t.typography.body, color: t.colors.label },
    rowDetail: { ...t.typography.footnote, fontWeight: '400', color: t.colors.labelSecondary },
    warning: { color: t.colors.tint },
    link: { ...t.typography.body, color: t.colors.link },
    destructive: { ...t.typography.body, color: t.colors.destructive },
    inlineAction: { minHeight: 44, justifyContent: 'center' },
    pressed: { opacity: 0.7 },
  }),
);
