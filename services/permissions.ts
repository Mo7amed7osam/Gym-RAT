import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { GymHealth } from '@/modules/gym-native';

import type { HealthAuthorization } from './healthExport';

/**
 * Permission prompts are only ever shown from a Settings toggle the user
 * just turned on, never at launch or mid-workout.
 */

export type NotificationAccess = 'granted' | 'denied' | 'undetermined';

function access(settings: Notifications.NotificationPermissionsStatus): NotificationAccess {
  const status = settings.ios?.status;
  if (status === Notifications.IosAuthorizationStatus.AUTHORIZED || status === Notifications.IosAuthorizationStatus.PROVISIONAL || status === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'granted';
  if (status === Notifications.IosAuthorizationStatus.NOT_DETERMINED) return 'undetermined';
  if (status === undefined) return settings.granted ? 'granted' : settings.canAskAgain ? 'undetermined' : 'denied';
  return 'denied';
}

export async function notificationAccess(): Promise<NotificationAccess> {
  if (Platform.OS !== 'ios') return 'denied';
  try {
    return access(await Notifications.getPermissionsAsync());
  } catch {
    return 'denied';
  }
}

/** Asks once (alerts + sound, no badge); later calls return the stored answer. */
export async function requestNotificationAccess(): Promise<NotificationAccess> {
  if (Platform.OS !== 'ios') return 'denied';
  try {
    return access(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  } catch {
    return 'denied';
  }
}

export function healthAccess(): HealthAuthorization {
  if (!GymHealth) return 'unavailable';
  try {
    return GymHealth.authorizationStatus();
  } catch {
    return 'unavailable';
  }
}

/** Write-only request for workouts. iOS shows its sheet only the first time. */
export async function requestHealthAccess(): Promise<HealthAuthorization> {
  if (!GymHealth) return 'unavailable';
  try {
    return await GymHealth.requestAuthorization();
  } catch (error) {
    console.warn('[health] authorization failed', error);
    return healthAccess();
  }
}
