/**
 * Shapes shared by the auth API client, the session manager and the store.
 * Mirrors `server/src/lib/auth/contracts.ts`; keep the two in step.
 */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Server-issued offline access lease (ADR-015). Both times are ISO strings
 * produced by the server clock; the device never extends them.
 */
export interface OfflineLease {
  userId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Epoch ms (device clock) after which the access token must be refreshed. */
  accessExpiresAt: number;
  refreshToken: string;
}

/** What the Keychain holds between launches. */
export interface StoredAuth {
  version: 1;
  user: AuthUser;
  tokens: AuthTokens;
  lease: OfflineLease;
  /** ISO time of the last successful server round-trip (device clock). */
  validatedAt: string;
}

export type AuthErrorCode =
  | 'network'
  | 'invalid_credentials'
  | 'account_disabled'
  | 'session_revoked'
  | 'invalid_token'
  | 'token_expired'
  | 'rate_limited'
  | 'validation'
  | 'server';

export class AuthApiError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message?: string,
    public readonly retryAfterSeconds: number | null = null,
    public readonly status: number | null = null,
  ) {
    super(message ?? code);
    this.name = 'AuthApiError';
  }
}

/** Response of login / refresh. */
export interface SessionResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  accessExpiresIn: number;
  refreshToken: string;
  user: AuthUser;
  lease: OfflineLease;
  serverTime: string;
}

/** Response of GET /api/auth/me. */
export interface MeResponse {
  user: AuthUser;
  lease: OfflineLease;
  serverTime: string;
}

export interface AuthApi {
  login(input: { email: string; password: string; deviceName: string }): Promise<SessionResponse>;
  refresh(refreshToken: string): Promise<SessionResponse>;
  me(accessToken: string): Promise<MeResponse>;
  logout(refreshToken: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
}
