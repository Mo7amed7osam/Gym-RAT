import { advanceHighWaterMark, evaluateLease, type LeaseVerdict } from './lease';
import type { AuthStorage } from './storage';
import { AuthApiError, type AuthApi, type AuthUser, type OfflineLease, type SessionResponse, type StoredAuth } from './types';

/**
 * Session manager (ADR-015): owns the stored credentials, refreshes the
 * access token, revalidates with the server when it can and applies the
 * offline lease when it cannot. It never touches workout data; the store and
 * the database boot react to the snapshots it publishes.
 */

export type SignOutReason = 'user' | 'account_disabled' | 'session_revoked' | 'lease_expired' | 'invalid_session';

export type AuthSnapshot =
  | { status: 'restoring' }
  | { status: 'signedOut'; reason: SignOutReason | null }
  | {
      status: 'signedIn';
      user: AuthUser;
      lease: OfflineLease;
      /** Last successful round-trip with the server (device clock, ISO). */
      validatedAt: string;
      /** The last revalidation attempt could not reach the server. */
      offline: boolean;
      leaseRemainingMs: number;
      leaseWarning: boolean;
      clockSuspect: boolean;
    }
  | { status: 'leaseExpired'; user: AuthUser; lease: OfflineLease; validatedAt: string };

export interface AuthSessionDeps {
  api: AuthApi;
  storage: AuthStorage;
  now?: () => number;
  deviceName?: string;
  /** Refresh the access token this many ms before it expires. */
  refreshSkewMs?: number;
}

export interface AuthSession {
  getSnapshot(): AuthSnapshot;
  subscribe(listener: (snapshot: AuthSnapshot) => void): () => void;
  /** Loads the Keychain, publishes an optimistic snapshot, then revalidates online. */
  restore(): Promise<AuthSnapshot>;
  signIn(email: string, password: string): Promise<AuthSnapshot>;
  /** Tells the server (best effort) and clears the Keychain. Never touches local data. */
  signOut(reason?: SignOutReason): Promise<void>;
  /** Refreshes if needed and asks the server whether the account is still active. Safe to call often. */
  revalidate(): Promise<AuthSnapshot>;
  forgotPassword(email: string): Promise<void>;
  /** A valid access token (refreshing when needed) for future authenticated calls. */
  getAccessToken(): Promise<string | null>;
  /** The signed-in user id, or null. */
  currentUserId(): string | null;
}

export function createAuthSession(deps: AuthSessionDeps): AuthSession {
  const now = deps.now ?? Date.now;
  const refreshSkewMs = deps.refreshSkewMs ?? 30_000;
  const listeners = new Set<(snapshot: AuthSnapshot) => void>();
  let snapshot: AuthSnapshot = { status: 'restoring' };
  let stored: StoredAuth | null = null;
  let highWaterMark = 0;
  let refreshing: Promise<StoredAuth | null> | null = null;
  let revalidating: Promise<AuthSnapshot> | null = null;

  const publish = (next: AuthSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener(next));
  };

  async function observeClock(): Promise<number> {
    const deviceNow = now();
    const next = advanceHighWaterMark(highWaterMark, deviceNow);
    if (next !== highWaterMark) {
      highWaterMark = next;
      await deps.storage.saveHighWaterMark(next);
    }
    return deviceNow;
  }

  function verdictFor(value: StoredAuth, deviceNow: number): LeaseVerdict {
    return evaluateLease(value.lease, value.user.id, deviceNow, highWaterMark);
  }

  function snapshotFromStored(value: StoredAuth, deviceNow: number, offline: boolean): AuthSnapshot {
    const verdict = verdictFor(value, deviceNow);
    if (verdict.state === 'valid') {
      return {
        status: 'signedIn',
        user: value.user,
        lease: value.lease,
        validatedAt: value.validatedAt,
        offline,
        leaseRemainingMs: verdict.remainingMs,
        leaseWarning: verdict.warn,
        clockSuspect: verdict.clockSuspect,
      };
    }
    if (verdict.state === 'expired') return { status: 'leaseExpired', user: value.user, lease: value.lease, validatedAt: value.validatedAt };
    return { status: 'signedOut', reason: 'invalid_session' };
  }

  function fromSession(response: SessionResponse, deviceNow: number): StoredAuth {
    return {
      version: 1,
      user: response.user,
      lease: response.lease,
      tokens: {
        accessToken: response.accessToken,
        accessExpiresAt: deviceNow + response.accessExpiresIn * 1000,
        refreshToken: response.refreshToken,
      },
      validatedAt: new Date(deviceNow).toISOString(),
    };
  }

  async function persist(value: StoredAuth | null): Promise<void> {
    stored = value;
    if (value) await deps.storage.save(value);
    else await deps.storage.clear();
  }

  async function clearSession(reason: SignOutReason): Promise<void> {
    await persist(null);
    publish({ status: 'signedOut', reason });
  }

  /** Rotates the refresh token; single-flight so two callers never both spend the same token. */
  function refreshTokens(): Promise<StoredAuth | null> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      if (!stored) return null;
      try {
        const response = await deps.api.refresh(stored.tokens.refreshToken);
        const deviceNow = await observeClock();
        const next = fromSession(response, deviceNow);
        await persist(next);
        return next;
      } catch (error) {
        if (error instanceof AuthApiError && (error.code === 'session_revoked' || error.code === 'invalid_token')) {
          await clearSession('session_revoked');
          return null;
        }
        if (error instanceof AuthApiError && error.code === 'account_disabled') {
          await clearSession('account_disabled');
          return null;
        }
        throw error; // network / server: caller decides
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function validAccess(): Promise<StoredAuth | null> {
    if (!stored) return null;
    if (stored.tokens.accessExpiresAt - refreshSkewMs > now()) return stored;
    return refreshTokens();
  }

  async function revalidateOnce(): Promise<AuthSnapshot> {
    if (!stored) {
      publish({ status: 'signedOut', reason: snapshot.status === 'signedOut' ? snapshot.reason : null });
      return snapshot;
    }
    try {
      let current = await validAccess();
      if (!current) return snapshot; // cleared by refresh (revoked / disabled)
      let me;
      try {
        me = await deps.api.me(current.tokens.accessToken);
      } catch (error) {
        if (error instanceof AuthApiError && error.code === 'token_expired') {
          current = await refreshTokens();
          if (!current) return snapshot;
          me = await deps.api.me(current.tokens.accessToken);
        } else throw error;
      }
      const deviceNow = await observeClock();
      const next: StoredAuth = { ...current, user: me.user, lease: me.lease, validatedAt: new Date(deviceNow).toISOString() };
      await persist(next);
      publish(snapshotFromStored(next, deviceNow, false));
      return snapshot;
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.code === 'account_disabled') {
          await clearSession('account_disabled');
          return snapshot;
        }
        if (error.code === 'session_revoked' || error.code === 'invalid_token') {
          await clearSession('session_revoked');
          return snapshot;
        }
      }
      // Network or server trouble: fall back to the lease. Local data is untouched either way.
      const deviceNow = await observeClock();
      if (stored) publish(snapshotFromStored(stored, deviceNow, true));
      return snapshot;
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentUserId: () => (snapshot.status === 'signedIn' ? snapshot.user.id : null),

    async restore() {
      highWaterMark = await deps.storage.loadHighWaterMark();
      stored = await deps.storage.load();
      const deviceNow = await observeClock();
      if (!stored) {
        publish({ status: 'signedOut', reason: null });
        return snapshot;
      }
      // Optimistic: let the app open on the lease while the server is asked.
      publish(snapshotFromStored(stored, deviceNow, true));
      return this.revalidate();
    },

    async signIn(email, password) {
      const response = await deps.api.login({ email: email.trim().toLowerCase(), password, deviceName: deps.deviceName ?? 'iPhone' });
      const deviceNow = await observeClock();
      const next = fromSession(response, deviceNow);
      await persist(next);
      publish(snapshotFromStored(next, deviceNow, false));
      return snapshot;
    },

    async signOut(reason = 'user') {
      const token = stored?.tokens.refreshToken;
      await clearSession(reason);
      if (token) await deps.api.logout(token).catch(() => undefined);
    },

    revalidate() {
      if (revalidating) return revalidating;
      revalidating = revalidateOnce().finally(() => {
        revalidating = null;
      });
      return revalidating;
    },

    forgotPassword: (email) => deps.api.forgotPassword(email.trim().toLowerCase()),

    async getAccessToken() {
      try {
        const current = await validAccess();
        return current?.tokens.accessToken ?? null;
      } catch {
        return stored?.tokens.accessToken ?? null;
      }
    },
  };
}
