import { useSyncExternalStore } from 'react';

import { ensureBooted, getBootStatus, subscribeBoot } from '@/data/db/boot';

const subscribe = (onChange: () => void) => {
  const unsubscribe = subscribeBoot(onChange);
  void ensureBooted();
  return unsubscribe;
};
const getSnapshot = () => {
  const status = getBootStatus();
  return status === 'ready' || status === 'error';
};

/** True once the database has been opened and the store loaded. Gate screens on it. */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
