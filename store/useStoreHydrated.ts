import { useCallback, useSyncExternalStore } from 'react';

import { LEGACY_SCOPE, ensureBooted, getBootScopeKey, getBootStatus, scopeKey, subscribeBoot, type BootScope } from '@/data/db/boot';

/**
 * True once the database for `scope` has been opened and the store loaded
 * (ADR-016: one scope per account). Gate screens on it. Changing the scope
 * (sign-out, account switch) flips it back to false until the new file is up.
 */
export function useStoreHydrated(scope: BootScope = LEGACY_SCOPE): boolean {
  const key = scopeKey(scope);
  const userId = scope.userId;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const unsubscribe = subscribeBoot(onChange);
      void ensureBooted({ userId });
      return unsubscribe;
    },
    [userId],
  );
  const getSnapshot = useCallback(() => {
    const status = getBootStatus();
    return getBootScopeKey() === key && (status === 'ready' || status === 'error');
  }, [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
