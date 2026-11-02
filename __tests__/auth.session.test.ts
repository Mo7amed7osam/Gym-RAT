import { CLOCK_ROLLBACK_TOLERANCE_MS, advanceHighWaterMark, evaluateLease, leaseDaysLeft } from '@/services/auth/lease';
import { createAuthSession, type AuthSnapshot } from '@/services/auth/session';
import { createMemoryAuthStorage } from '@/services/auth/storage';
import { AuthApiError, type AuthApi, type MeResponse, type OfflineLease, type SessionResponse, type StoredAuth } from '@/services/auth/types';

/**
 * Offline lease policy and the session manager (ADR-015) against a fake
 * server: sign-in success / failure, disabled accounts, missing and invalid
 * sessions, refresh rotation, revocation, lease expiry, device-clock
 * rollback, and force-quit + relaunch (restore from the Keychain).
 */

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-11-02T10:00:00.000Z');
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'amr@example.com', displayName: 'Amr' };

const lease = (issuedAt: number, days = 7): OfflineLease => ({ userId: user.id, issuedAt: new Date(issuedAt).toISOString(), expiresAt: new Date(issuedAt + days * DAY).toISOString() });

describe('evaluateLease', () => {
  it('is valid while the effective clock is before expiry and warns inside the last 48 hours', () => {
    const current = lease(T0);
    expect(evaluateLease(current, user.id, T0 + DAY, 0)).toMatchObject({ state: 'valid', warn: false, clockSuspect: false });
    expect(evaluateLease(current, user.id, T0 + 6 * DAY, 0)).toMatchObject({ state: 'valid', warn: true });
    expect(evaluateLease(current, user.id, T0 + 7 * DAY, 0)).toMatchObject({ state: 'expired' });
  });

  it('turning the clock back does not extend the lease: the high-water mark wins', () => {
    const current = lease(T0);
    const highWaterMark = T0 + 8 * DAY; // the app has already seen day 8
    const verdict = evaluateLease(current, user.id, T0 + DAY, highWaterMark);
    expect(verdict.state).toBe('expired');
    expect(verdict.state === 'expired' && verdict.clockSuspect).toBe(true);
  });

  it('flags a rolled-back clock as suspect while still valid, within tolerance it does not', () => {
    const current = lease(T0);
    const hwm = T0 + 2 * DAY;
    expect(evaluateLease(current, user.id, hwm - CLOCK_ROLLBACK_TOLERANCE_MS + 1_000, hwm)).toMatchObject({ state: 'valid', clockSuspect: false });
    expect(evaluateLease(current, user.id, T0 + DAY, hwm)).toMatchObject({ state: 'valid', clockSuspect: true });
  });

  it('rejects a lease for another user or a malformed one', () => {
    expect(evaluateLease(lease(T0), 'someone-else', T0, 0)).toEqual({ state: 'invalid', reason: 'wrong_user' });
    expect(evaluateLease({ userId: user.id, issuedAt: 'x', expiresAt: 'y' }, user.id, T0, 0)).toEqual({ state: 'invalid', reason: 'malformed' });
    expect(evaluateLease(null, user.id, T0, 0)).toEqual({ state: 'invalid', reason: 'malformed' });
  });

  it('high-water mark never decreases; days left round up', () => {
    expect(advanceHighWaterMark(100, 50)).toBe(100);
    expect(advanceHighWaterMark(100, 150)).toBe(150);
    expect(leaseDaysLeft(DAY + 1)).toBe(2);
    expect(leaseDaysLeft(0)).toBe(0);
  });
});

// ─── Fake server ─────────────────────────────────────────────────────────────

interface FakeServer extends AuthApi {
  state: { disabled: boolean; revoked: Set<string>; usedRefresh: Set<string>; clock: number; loginFailures: number; calls: string[] };
}

function fakeServer(now: () => number): FakeServer {
  let counter = 0;
  const state: FakeServer['state'] = { disabled: false, revoked: new Set(), usedRefresh: new Set(), clock: now(), loginFailures: 0, calls: [] };
  const issue = (): SessionResponse => {
    counter += 1;
    const serverNow = now();
    return {
      accessToken: `access-${counter}`,
      accessExpiresIn: 900,
      refreshToken: `refresh-${counter}`,
      user,
      lease: lease(serverNow),
      serverTime: new Date(serverNow).toISOString(),
    };
  };
  const me = (): MeResponse => ({ user, lease: lease(now()), serverTime: new Date(now()).toISOString() });
  return {
    state,
    async login({ email, password }) {
      state.calls.push('login');
      if (state.loginFailures >= 5) throw new AuthApiError('rate_limited', undefined, 60, 429);
      if (email !== user.email || password !== 'correct horse battery staple') {
        state.loginFailures += 1;
        throw new AuthApiError('invalid_credentials', undefined, null, 401);
      }
      if (state.disabled) throw new AuthApiError('account_disabled', undefined, null, 403);
      return issue();
    },
    async refresh(token) {
      state.calls.push(`refresh:${token}`);
      if (state.disabled) throw new AuthApiError('account_disabled', undefined, null, 403);
      if (state.revoked.has(token) || state.usedRefresh.has(token)) throw new AuthApiError('session_revoked', undefined, null, 401);
      state.usedRefresh.add(token);
      return issue();
    },
    async me(accessToken) {
      state.calls.push(`me:${accessToken}`);
      if (state.disabled) throw new AuthApiError('account_disabled', undefined, null, 403);
      if (state.revoked.has('all')) throw new AuthApiError('session_revoked', undefined, null, 401);
      return me();
    },
    async logout(token) {
      state.calls.push(`logout:${token}`);
      state.revoked.add(token);
    },
    async forgotPassword() {
      state.calls.push('forgot');
    },
  };
}

function offline(api: AuthApi): AuthApi {
  const fail = async () => {
    throw new AuthApiError('network', 'Network request failed');
  };
  return { login: fail, refresh: fail, me: fail, logout: fail, forgotPassword: fail };
}

const signedIn = (snapshot: AuthSnapshot) => {
  expect(snapshot.status).toBe('signedIn');
  return snapshot as Extract<AuthSnapshot, { status: 'signedIn' }>;
};

describe('AuthSession', () => {
  let clock: number;
  const now = () => clock;
  beforeEach(() => {
    clock = T0;
  });

  it('signs in, stores tokens and lease in the Keychain and reports online', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    const session = createAuthSession({ api, storage, now });
    const snapshot = signedIn(await session.signIn('Amr@Example.com ', 'correct horse battery staple'));
    expect(snapshot.user).toEqual(user);
    expect(snapshot.offline).toBe(false);
    expect(snapshot.leaseRemainingMs).toBe(7 * DAY);
    expect(storage.session?.tokens.refreshToken).toBe('refresh-1');
    expect(storage.highWaterMark).toBe(T0);
    expect(session.currentUserId()).toBe(user.id);
  });

  it('rejects a wrong password with a generic code and stores nothing; rate limit surfaces after repeated failures', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    const session = createAuthSession({ api, storage, now });
    for (let i = 0; i < 5; i += 1) {
      await expect(session.signIn(user.email, 'nope')).rejects.toMatchObject({ code: 'invalid_credentials' });
    }
    await expect(session.signIn(user.email, 'correct horse battery staple')).rejects.toMatchObject({ code: 'rate_limited', retryAfterSeconds: 60 });
    expect(storage.session).toBeNull();
    expect(session.getSnapshot().status).toBe('restoring'); // untouched: no restore() ran
  });

  it('a disabled account cannot sign in', async () => {
    const api = fakeServer(now);
    api.state.disabled = true;
    const session = createAuthSession({ api, storage: createMemoryAuthStorage(), now });
    await expect(session.signIn(user.email, 'correct horse battery staple')).rejects.toMatchObject({ code: 'account_disabled' });
  });

  it('restore with nothing stored is signed out; a corrupt blob counts as missing', async () => {
    const api = fakeServer(now);
    const empty = createAuthSession({ api, storage: createMemoryAuthStorage(), now });
    expect(await empty.restore()).toEqual({ status: 'signedOut', reason: null });
    const storage = createMemoryAuthStorage({ session: { version: 1 } as unknown as StoredAuth });
    // The storage's own parser would drop it; simulate the parsed-null path.
    storage.load = async () => null;
    const corrupt = createAuthSession({ api, storage, now });
    expect(await corrupt.restore()).toEqual({ status: 'signedOut', reason: null });
  });

  it('force-quit and relaunch: restore revalidates online, rotates an expired access token and keeps the user signed in', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    await createAuthSession({ api, storage, now }).signIn(user.email, 'correct horse battery staple');

    clock = T0 + 2 * DAY; // relaunch two days later: access token long expired
    const relaunched = createAuthSession({ api, storage, now });
    const snapshot = signedIn(await relaunched.restore());
    expect(snapshot.offline).toBe(false);
    expect(api.state.calls).toContain('refresh:refresh-1');
    expect(storage.session?.tokens.refreshToken).toBe('refresh-2');
    expect(storage.session?.lease.issuedAt).toBe(new Date(clock).toISOString()); // lease renewed by the server
    expect(snapshot.leaseRemainingMs).toBe(7 * DAY);
  });

  it('refresh rotation: presenting an already-used refresh token revokes the session', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    const session = createAuthSession({ api, storage, now });
    await session.signIn(user.email, 'correct horse battery staple');
    api.state.usedRefresh.add('refresh-1'); // stolen copy used elsewhere first
    clock = T0 + 1000 * 1000;
    const snapshot = await session.revalidate();
    expect(snapshot).toEqual({ status: 'signedOut', reason: 'session_revoked' });
    expect(storage.session).toBeNull();
  });

  it('server-side revocation and disablement sign the device out on the next online check, keeping nothing in the Keychain', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    const session = createAuthSession({ api, storage, now });
    await session.signIn(user.email, 'correct horse battery staple');
    api.state.revoked.add('all');
    expect(await session.revalidate()).toEqual({ status: 'signedOut', reason: 'session_revoked' });

    const again = createAuthSession({ api, storage, now });
    api.state.revoked.clear();
    await again.signIn(user.email, 'correct horse battery staple');
    api.state.disabled = true;
    expect(await again.revalidate()).toEqual({ status: 'signedOut', reason: 'account_disabled' });
    expect(storage.session).toBeNull();
  });

  it('offline inside the lease keeps the user signed in and marks the snapshot offline', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    await createAuthSession({ api, storage, now }).signIn(user.email, 'correct horse battery staple');

    clock = T0 + 3 * DAY;
    const relaunched = createAuthSession({ api: offline(api), storage, now });
    const snapshot = signedIn(await relaunched.restore());
    expect(snapshot.offline).toBe(true);
    expect(snapshot.leaseRemainingMs).toBe(4 * DAY);
    expect(snapshot.validatedAt).toBe(new Date(T0).toISOString());
    expect(storage.session?.tokens.refreshToken).toBe('refresh-1'); // nothing was spent offline
  });

  it('offline past the lease shows the lease-expired wall; the Keychain entry and local data are untouched', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    await createAuthSession({ api, storage, now }).signIn(user.email, 'correct horse battery staple');

    clock = T0 + 8 * DAY;
    const relaunched = createAuthSession({ api: offline(api), storage, now });
    const snapshot = await relaunched.restore();
    expect(snapshot).toMatchObject({ status: 'leaseExpired', user });
    expect(storage.session).not.toBeNull();
    expect(relaunched.currentUserId()).toBeNull();

    // Back online: a sign-in renews everything.
    clock = T0 + 8 * DAY + 60_000;
    const online = createAuthSession({ api, storage, now });
    await online.restore();
    const renewed = signedIn(await online.signIn(user.email, 'correct horse battery staple'));
    expect(renewed.leaseRemainingMs).toBe(7 * DAY);
  });

  it('device clock rolled back past expiry cannot revive an expired lease offline', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    await createAuthSession({ api, storage, now }).signIn(user.email, 'correct horse battery staple');

    clock = T0 + 8 * DAY; // the app runs once at day 8 (offline): high-water mark moves to day 8
    expect((await createAuthSession({ api: offline(api), storage, now }).restore()).status).toBe('leaseExpired');
    expect(storage.highWaterMark).toBe(T0 + 8 * DAY);

    clock = T0 + DAY; // user sets the clock back to day 1
    const snapshot = await createAuthSession({ api: offline(api), storage, now }).restore();
    expect(snapshot.status).toBe('leaseExpired');
  });

  it('a clock rolled back inside the lease is flagged suspect, then cleared once the server answers', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    await createAuthSession({ api, storage, now }).signIn(user.email, 'correct horse battery staple');
    clock = T0 + 2 * DAY;
    await createAuthSession({ api: offline(api), storage, now }).restore();
    clock = T0 + DAY;
    const suspect = signedIn(await createAuthSession({ api: offline(api), storage, now }).restore());
    expect(suspect.clockSuspect).toBe(true);
    expect(suspect.leaseRemainingMs).toBe(5 * DAY); // measured from the high-water mark, not the rolled-back clock

    clock = T0 + 2 * DAY + 1000;
    const cleared = signedIn(await createAuthSession({ api, storage, now }).restore());
    expect(cleared.clockSuspect).toBe(false);
    expect(cleared.offline).toBe(false);
  });

  it('sign-out clears the Keychain first and tells the server best-effort', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    const session = createAuthSession({ api, storage, now });
    await session.signIn(user.email, 'correct horse battery staple');
    await session.signOut();
    expect(storage.session).toBeNull();
    expect(session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'user' });
    expect(api.state.calls).toContain('logout:refresh-1');

    // Offline sign-out still succeeds locally.
    const another = createAuthSession({ api, storage, now });
    await another.signIn(user.email, 'correct horse battery staple');
    const offlineSession = createAuthSession({ api: offline(api), storage, now });
    await offlineSession.restore();
    await expect(offlineSession.signOut()).resolves.toBeUndefined();
    expect(storage.session).toBeNull();
  });

  it('concurrent revalidations share one refresh so a token is never spent twice', async () => {
    const api = fakeServer(now);
    const storage = createMemoryAuthStorage();
    const session = createAuthSession({ api, storage, now });
    await session.signIn(user.email, 'correct horse battery staple');
    clock = T0 + 2000 * 1000;
    const [a, b, token] = await Promise.all([session.revalidate(), session.revalidate(), session.getAccessToken()]);
    expect(a.status).toBe('signedIn');
    expect(b.status).toBe('signedIn');
    expect(token).toBe('access-2');
    expect(api.state.calls.filter((call) => call.startsWith('refresh:'))).toEqual(['refresh:refresh-1']);
  });
});
