// ---- バックエンド (Spring Boot) との通信 ----

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8080';

/** Discord OAuth2 ログイン開始 URL（Spring Security が Discord へリダイレクト） */
export const DISCORD_LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/discord`;

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

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // Discord ログインのセッション Cookie を送る
  });

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
