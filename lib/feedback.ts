import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic + sound feedback, as specified in the design system:
 * .success on set, PR and finished workout · .rigid on timer end (3 pulses) ·
 * .selection on steppers · .light impact on pause/resume.
 * All calls are fire-and-forget and never throw (haptics are unavailable on web / some Android devices).
 */

const REST_COMPLETE_SOUND = require('@/assets/sounds/rest-complete.wav') as number;

let restPlayer: AudioPlayer | null = null;
let audioModeReady: Promise<void> | null = null;

function ignore(): void {
  // Feedback is best-effort.
}

function canHaptic(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function hapticSelection(): void {
  if (canHaptic()) Haptics.selectionAsync().catch(ignore);
}

export function hapticSetCompleted(): void {
  if (canHaptic()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}

export function hapticWorkoutFinished(): void {
  if (canHaptic()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}

export function hapticLight(): void {
  if (canHaptic()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

export function hapticWarning(): void {
  if (canHaptic()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
}

function getRestPlayer(): AudioPlayer {
  if (!audioModeReady) {
    // Mix with the user's gym music instead of stopping it; respect the silent switch.
    audioModeReady = setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false }).catch(ignore);
  }
  if (!restPlayer) restPlayer = createAudioPlayer(REST_COMPLETE_SOUND);
  return restPlayer;
}

export function playRestCompleteSound(): void {
  try {
    const player = getRestPlayer();
    player.seekTo(0).catch(ignore);
    player.play();
  } catch {
    ignore();
  }
}

/** Three rigid pulses + chime when rest is over. */
export function restCompleteFeedback(options: { sound: boolean; haptics: boolean }): void {
  if (options.haptics && canHaptic()) {
    [0, 180, 360].forEach((delay) => {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(ignore);
      }, delay);
    });
  }
  if (options.sound) playRestCompleteSound();
}
