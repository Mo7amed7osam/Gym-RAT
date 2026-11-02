import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the self-hosted auth API lives (ADR-015). Set `EXPO_PUBLIC_AUTH_API_URL`
 * in `.env` (see `.env.example`); Metro inlines it at bundle time. A debug
 * build with nothing configured talks to the local docker-compose stack.
 */
const DEV_DEFAULT = Platform.OS === 'android' ? 'http://10.0.2.2:3100' : 'http://127.0.0.1:3100';

export function authApiBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_AUTH_API_URL?.trim();
  if (configured) return configured;
  return __DEV__ ? DEV_DEFAULT : null;
}

/** Shown to the admin in the sessions list; no identifiers beyond model + app version. */
export function deviceLabel(): string {
  const version = Constants.expoConfig?.version ?? '0';
  const model = Constants.deviceName ?? (Platform.OS === 'ios' ? 'iPhone' : Platform.OS);
  return `${model} · Gym RAT ${version}`;
}
