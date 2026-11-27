// ---- バックエンド (Spring Boot) との通信 ----

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8080';

/** Web ブラウザ版 Discord OAuth2 ログイン開始 URL */
export const DISCORD_WEB_LOGIN_URL = `${API_BASE_URL}/api/auth/discord/login?platform=web`;

/** Desktop (Tauri) 版 Discord OAuth2 ログイン開始 URL */
export const DISCORD_DESKTOP_LOGIN_URL = `${API_BASE_URL}/api/auth/discord/login?platform=desktop`;

/** 後方互換エイリアス */
export const DISCORD_LOGIN_URL = DISCORD_WEB_LOGIN_URL;

export const AUTH_TOKEN_STORAGE_KEY = 'satlas_auth_jwt';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore storage quota errors */
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface AuthCallbackParams {
  token: string | null;
  error: string | null;
}

/**
 * URL 文字列（satlas://auth/callback?token=... や https://.../#auth_token=...）から
 * JWT トークンまたはエラーコードを抽出する。
 */
export function extractAuthCallbackParams(urlStr: string): AuthCallbackParams {
  try {
    const parsed = new URL(urlStr);
    const queryToken = parsed.searchParams.get('token');
    const queryError = parsed.searchParams.get('error');
    if (queryToken || queryError) {
      return { token: queryToken, error: queryError };
    }
    const rawHash = parsed.hash.replace(/^#/, '');
    if (rawHash.includes('auth_token=') || rawHash.includes('auth_error=')) {
      const hashParams = new URLSearchParams(rawHash);
      return {
        token: hashParams.get('auth_token'),
        error: hashParams.get('auth_error'),
      };
    }
  } catch {
    /* URL パース失敗時は無視 */
  }
  return { token: null, error: null };
}

/**
 * ページロード時の URL ハッシュ（#auth_token=... / #auth_error=...）を消費して
 * localStorage へ保存し、アドレスバーから機密トークンを消去する。
 * App.tsx のハッシュルーティング初期化より先にモジュールロード時に 1 回実行する。
 */
export function consumeAuthTokenFromHash(): AuthCallbackParams {
  if (typeof window === 'undefined') return { token: null, error: null };
  const rawHash = window.location.hash.replace(/^#/, '');
  if (!rawHash.includes('auth_token=') && !rawHash.includes('auth_error=')) {
    return { token: null, error: null };
  }
  const params = new URLSearchParams(rawHash);
  const token = params.get('auth_token');
  const error = params.get('auth_error');
  if (token) {
    setAuthToken(token);
  }
  // アドレスバーに JWT を残さない
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return { token, error };
}

/** 初回ロード時にハッシュから自動抽出した結果（React マウント前にトークンを確保） */
export const INITIAL_AUTH_CALLBACK: AuthCallbackParams = consumeAuthTokenFromHash();

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** サーバーに到達できなかった（未起動など）場合 true */
export const isNetworkError = (e: unknown): boolean => !(e instanceof ApiError);

export const errorMessage = (e: unknown): string => {
  if (e instanceof ApiError) return e.message;
  return 'サーバーに接続できません（server/ が起動しているか確認してください）';
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isForm = init.body instanceof FormData;
  if (init.body !== undefined && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // セッション Cookie 認証との併用も維持
  });

  if (res.status === 401 && token) {
    clearAuthToken();
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* JSON でないエラー */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T = void>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
