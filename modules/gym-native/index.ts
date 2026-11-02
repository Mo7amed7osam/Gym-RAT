import { requireOptionalNativeModule } from 'expo-modules-core';

export type HealthAuthorization = 'notDetermined' | 'denied' | 'authorized' | 'unavailable';

export interface HealthWorkoutInput {
  sessionId: string;
  startMs: number;
  endMs: number;
  pauses: { fromMs: number; toMs: number }[];
}

export interface GymHealthNative {
  isAvailable(): boolean;
  authorizationStatus(): HealthAuthorization;
  requestAuthorization(): Promise<HealthAuthorization>;
  saveWorkout(input: HealthWorkoutInput): Promise<{ uuid: string; replaced: number }>;
  deleteWorkout(sessionId: string): Promise<number>;
}

export type FileProtectionLevel = 'complete' | 'completeUnlessOpen' | 'completeUntilFirstUserAuthentication';

export interface GymFileProtectionNative {
  protectDirectory(path: string, level: FileProtectionLevel): string[];
  protectionOf(path: string): string | null;
}

/** Null outside an iOS development build (Jest, web, Expo Go). */
export const GymHealth = requireOptionalNativeModule<GymHealthNative>('GymHealth');
export const GymFileProtection = requireOptionalNativeModule<GymFileProtectionNative>('GymFileProtection');
