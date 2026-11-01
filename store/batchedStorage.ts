import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * AsyncStorage-backed persist storage that coalesces writes. Zustand calls
 * `setItem` on every state change; serialising the whole store (history
 * included) each time gets expensive, so we keep only the latest value and
 * write it at most once per `delayMs`. Pending writes are flushed as soon as
 * the app leaves the foreground, so backgrounding / killing loses nothing.
 * On-disk format matches `createJSONStorage`, so existing data still loads.
 */
export function createBatchedStorage<S>(delayMs: number = 500): PersistStorage<S> {
  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const entries = [...pending].map(([name, value]): [string, string] => [name, JSON.stringify(value)]);
    pending.clear();
    try {
      await AsyncStorage.multiSet(entries);
    } catch (error) {
      console.warn('[storage] failed to persist state', error);
    }
  };

  AppState.addEventListener('change', (status) => {
    if (status !== 'active') void flush();
  });

  return {
    getItem: async (name) => {
      const queued = pending.get(name);
      if (queued) return queued;
      const raw = await AsyncStorage.getItem(name);
      return raw === null ? null : (JSON.parse(raw) as StorageValue<S>);
    },
    setItem: (name, value) => {
      pending.set(name, value);
      // Fixed window (not reset per write) so a burst of edits still saves within `delayMs`.
      if (!timer) timer = setTimeout(() => void flush(), delayMs);
    },
    removeItem: async (name) => {
      pending.delete(name);
      await AsyncStorage.removeItem(name);
    },
  };
}
