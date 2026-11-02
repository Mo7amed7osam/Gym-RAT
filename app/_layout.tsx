// Per-weight entry points: the package root would bundle all 18 .ttf files.
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, LocaleProvider, Stack, ThemeProvider as NavigationThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { BrandMark } from '@/components/auth/BrandMark';
import { closeDatabase } from '@/data/db/boot';
import { isRtlLocale, setCurrentLocale, useLocale } from '@/i18n';
import { shouldOfferLegacyData } from '@/screens/auth/legacyPrompt';
import { secureAuthStorage } from '@/services/auth/storage';
import { attachIntegrations } from '@/services/integrations';
import { useAuthStore } from '@/store/useAuthStore';
import { useStoreHydrated } from '@/store/useStoreHydrated';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { ThemeProvider, useTheme } from '@/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Keep the splash up until the session is restored and the display font is ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // A failed font load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  const authStatus = useAuthStore((state) => state.snapshot.status);
  const restore = useAuthStore((state) => state.restore);

  // Keychain first (no database): the sign-in wall or the account's database follows (ADR-015/016).
  useEffect(() => {
    void restore();
  }, [restore]);

  const ready = authStatus !== 'restoring' && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <ThemedNavigation />
    </ThemeProvider>
  );
}

function ThemedNavigation() {
  const theme = useTheme();
  const locale = useLocale();
  setCurrentLocale(locale);
  const snapshot = useAuthStore((state) => state.snapshot);
  const signedIn = snapshot.status === 'signedIn';
  const userId = snapshot.status === 'signedIn' ? snapshot.user.id : null;
  const onboarded = useWorkoutStore((state) => state.settings.onboardingComplete);
  const navigationBase = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...navigationBase,
    colors: {
      ...navigationBase.colors,
      primary: theme.colors.tint,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.label,
      border: theme.colors.separator,
    },
  };
  return (
    <LocaleProvider direction={isRtlLocale(locale) ? 'rtl' : 'ltr'}>
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.fill}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="auth/login" options={{ gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen name="auth/forgot" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
              {/* Reachable before onboarding: a first sign-in on a phone with pre-account data offers the claim right away (ADR-016). */}
              <Stack.Screen name="auth/legacy-data" options={{ gestureEnabled: false, animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && !onboarded}>
              <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false, animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && onboarded}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="exercise/[id]" />
              <Stack.Screen name="exercise/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="plan/[id]/index" />
              <Stack.Screen name="plan/[id]/day/[dayId]" />
              <Stack.Screen name="analytics/history" />
              <Stack.Screen name="analytics/session/[id]" />
              <Stack.Screen name="analytics/calendar" />
              <Stack.Screen name="analytics/exercises" />
              <Stack.Screen name="analytics/exercise/[id]" />
              <Stack.Screen name="analytics/body" />
              <Stack.Screen name="analytics/goals" />
            </Stack.Protected>
          </Stack>
          {userId ? <AccountSession key={userId} userId={userId} /> : <SignedOut />}
        </View>
      </NavigationThemeProvider>
    </LocaleProvider>
  );
}

/**
 * Mounted while an account is signed in: boots that account's database,
 * attaches the iOS integrations once the store holds real data, revalidates
 * the session when the app returns to the foreground and offers pre-account
 * data once. Remounts (by key) when the account changes.
 */
function AccountSession({ userId }: { userId: string }) {
  const hydrated = useStoreHydrated({ userId });
  const router = useRouter();
  const revalidate = useAuthStore((state) => state.revalidate);
  const sessionCount = useWorkoutStore((state) => state.history.length);
  const offered = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    // Rest alerts, Live Activity and Health export follow the hydrated store (ADR-013).
    attachIntegrations();
  }, [hydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void revalidate();
    });
    return () => subscription.remove();
  }, [revalidate]);

  useEffect(() => {
    if (!hydrated || offered.current) return;
    offered.current = true;
    // A beat after sign-in so iOS can finish its own "Save password?" sheet first; presenting
    // another screen underneath that sheet leaves it stuck and swallowing touches.
    const timer = setTimeout(() => {
      void shouldOfferLegacyData(userId, sessionCount, secureAuthStorage).then((probe) => {
        if (probe) router.push('/auth/legacy-data');
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [hydrated, router, sessionCount, userId]);

  return <BootOverlay visible={!hydrated} />;
}

/** Signed out: close whatever account file was open. Deletes nothing (ADR-016). */
function SignedOut() {
  useEffect(() => {
    void closeDatabase();
  }, []);
  return null;
}

/** Covers the brief moment between sign-in and the account's database being ready. */
function BootOverlay({ visible }: { visible: boolean }) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: visible ? 0 : 260, useNativeDriver: true }).start();
  }, [opacity, visible]);
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: theme.colors.background, opacity }]}
    >
      <BrandMark compact />
      <ActivityIndicator color={theme.colors.tint} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { alignItems: 'center', justifyContent: 'center', gap: 24 },
});
