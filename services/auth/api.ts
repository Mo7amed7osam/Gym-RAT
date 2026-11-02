import { AuthApiError, type AuthApi, type AuthErrorCode, type MeResponse, type SessionResponse } from './types';

/**
 * Thin JSON client for the Gym RAT auth API (ADR-015). Errors are mapped to
 * `AuthApiError` codes the UI can translate; the server never says whether an
 * email exists, and neither does this client. Only `fetch` is used so the
 * module has no native dependency and runs in Jest.
 */

export interface AuthApiOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Request timeout; the UI shows "offline" rather than hanging. */
  timeoutMs?: number;
  /** Shown to the admin in the sessions list. */
  userAgent?: string;
}

const KNOWN_CODES: ReadonlySet<string> = new Set<AuthErrorCode>([
  'invalid_credentials',
  'account_disabled',
  'session_revoked',
  'invalid_token',
  'token_expired',
  'rate_limited',
  'validation',
]);

function errorCode(status: number, body: unknown): AuthErrorCode {
  const code = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : null;
  if (code && KNOWN_CODES.has(code)) return code as AuthErrorCode;
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'invalid_token';
  if (status === 403) return 'account_disabled';
  if (status === 400 || status === 422) return 'validation';
  return 'server';
}

export function createAuthApi(options: AuthApiOptions): AuthApi {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const base = options.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown; accessToken?: string }): Promise<T> {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: init.method,
        headers: {
          Accept: 'application/json',
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
          ...(options.userAgent ? { 'X-Gym-Client': options.userAgent } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller?.signal,
      });
    } catch (error) {
      throw new AuthApiError('network', error instanceof Error ? error.message : 'network');
    } finally {
      if (timer) clearTimeout(timer);
    }

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (!response.ok) {
      const retry = response.headers.get('Retry-After');
      const retryAfter = retry && Number.isFinite(Number(retry)) ? Number(retry) : null;
      throw new AuthApiError(errorCode(response.status, json), undefined, retryAfter, response.status);
    }
    return json as T;
  }

  return {
    login: (input) => request<SessionResponse>('/api/auth/login', { method: 'POST', body: { email: input.email, password: input.password, deviceName: input.deviceName } }),
    refresh: (refreshToken) => request<SessionResponse>('/api/auth/refresh', { method: 'POST', body: { refreshToken } }),
    me: (accessToken) => request<MeResponse>('/api/auth/me', { method: 'GET', accessToken }),
    logout: async (refreshToken) => {
      await request<void>('/api/auth/logout', { method: 'POST', body: { refreshToken } });
    },
    forgotPassword: async (email) => {
      await request<void>('/api/auth/forgot-password', { method: 'POST', body: { email } });
    },
  };
}
