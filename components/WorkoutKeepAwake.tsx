import { useLowPowerMode } from 'expo-battery';
import { useKeepAwake } from 'expo-keep-awake';

import { useWorkoutStore } from '@/store/useWorkoutStore';

const KEEP_AWAKE_TAG = 'gymrat-active-workout';

/** Screen stays on while lifting; a paused workout or Low Power Mode lets it sleep. */
export function shouldKeepAwake(enabled: boolean, paused: boolean, lowPowerMode: boolean): boolean {
  return enabled && !paused && !lowPowerMode;
}

/** Mounted by the workout runner; holds the keep-awake lock only while `shouldKeepAwake`. */
export function WorkoutKeepAwake({ paused }: { paused: boolean }) {
  const enabled = useWorkoutStore((state) => state.settings.keepScreenAwake);
  const lowPowerMode = useLowPowerMode();
  return shouldKeepAwake(enabled, paused, lowPowerMode) ? <KeepAwakeLock /> : null;
}

function KeepAwakeLock() {
  useKeepAwake(KEEP_AWAKE_TAG);
  return null;
}
