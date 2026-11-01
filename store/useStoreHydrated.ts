import { useSyncExternalStore } from 'react';

import { useWorkoutStore } from './useWorkoutStore';

const subscribe = (onChange: () => void) => useWorkoutStore.persist.onFinishHydration(onChange);
const getSnapshot = () => useWorkoutStore.persist.hasHydrated();

/** True once AsyncStorage has restored history / active session. Gate screens on it. */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
