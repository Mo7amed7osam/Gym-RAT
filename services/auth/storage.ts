import * as SecureStore from 'expo-secure-store';

import type { StoredAuth } from './types';

/**
 * Keychain-backed storage for the session (ADR-015). Tokens and the lease
 * live in SecureStore under `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
 * so a background refresh works after the first unlock, and the items never
 * move to another device through a backup. The clock high-water mark lives
 * beside them so a reinstall-free clock rollback cannot clear it.
 */

export interface AuthStorage {
  load(): Promise<StoredAuth | null>;
  save(value: StoredAuth): Promise<void>;
  clear(): Promise<void>;
  loadHighWaterMark(): Promise<number>;
  saveHighWaterMark(value: number): Promise<void>;
  /** Per-user flags that are not secrets but should follow the account (e.g. legacy prompt shown). */
  getFlag(key: string): Promise<string | null>;
  setFlag(key: string, value: string | null): Promise<void>;
}

const SESSION_KEY = 'gymrat.auth.session.v1';
const HWM_KEY = 'gymrat.auth.clock.hwm';
const FLAG_PREFIX = 'gymrat.auth.flag.';

const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

function parseStored(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredAuth>;
    if (value.version !== 1 || !value.user?.id || !value.tokens?.refreshToken || !value.lease?.expiresAt) return null;
    return value as StoredAuth;
  } catch {
    return null;
  }
}

export const secureAuthStorage: AuthStorage = {
  load: async () => parseStored(await SecureStore.getItemAsync(SESSION_KEY, options)),
  save: async (value) => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value), options),
  clear: async () => SecureStore.deleteItemAsync(SESSION_KEY, options),
  loadHighWaterMark: async () => {
    const raw = await SecureStore.getItemAsync(HWM_KEY, options);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  },
  saveHighWaterMark: async (value) => SecureStore.setItemAsync(HWM_KEY, String(Math.floor(value)), options),
  getFlag: (key) => SecureStore.getItemAsync(FLAG_PREFIX + key, options),
  setFlag: async (key, value) => {
    if (value === null) await SecureStore.deleteItemAsync(FLAG_PREFIX + key, options);
    else await SecureStore.setItemAsync(FLAG_PREFIX + key, value, options);
  },
};

/** In-memory storage for tests and the web preview. */
export function createMemoryAuthStorage(initial: { session?: StoredAuth | null; highWaterMark?: number } = {}): AuthStorage & { session: StoredAuth | null; highWaterMark: number; flags: Map<string, string> } {
  const state = { session: initial.session ?? null, highWaterMark: initial.highWaterMark ?? 0, flags: new Map<string, string>() };
  return {
    get session() {
      return state.session;
    },
    get highWaterMark() {
      return state.highWaterMark;
    },
    flags: state.flags,
    load: async () => (state.session ? { ...state.session } : null),
    save: async (value) => {
      state.session = value;
    },
    clear: async () => {
      state.session = null;
    },
    loadHighWaterMark: async () => state.highWaterMark,
    saveHighWaterMark: async (value) => {
      state.highWaterMark = value;
    },
    getFlag: async (key) => state.flags.get(key) ?? null,
    setFlag: async (key, value) => {
      if (value === null) state.flags.delete(key);
      else state.flags.set(key, value);
    },
  };
}
