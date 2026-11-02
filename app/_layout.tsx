// Per-weight entry points: the package root would bundle all 18 .ttf files.
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, LocaleProvider, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { isRtlLocale, setCurrentLocale, useLocale } from '@/i18n';
import { attachIntegrations } from '@/services/integrations';
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

// Keep the splash up until the workout log and display font are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrated = useStoreHydrated();
  // A failed font load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  const ready = hydrated && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    // Rest alerts, Live Activity and Health export follow the hydrated store (ADR-013).
    attachIntegrations();
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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
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
      </NavigationThemeProvider>
    </LocaleProvider>
  );
}
