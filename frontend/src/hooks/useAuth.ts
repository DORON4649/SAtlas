import { useCallback, useEffect, useState } from 'react';
import {
  DISCORD_DESKTOP_LOGIN_URL,
  DISCORD_WEB_LOGIN_URL,
  INITIAL_AUTH_CALLBACK,
  api,
  clearAuthToken,
  extractAuthCallbackParams,
  isNetworkError,
  setAuthToken,
} from '../lib/api';
import { isTauriDesktop } from '../lib/tauriUpdater';
import type { MeResponse } from '../types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'offline' }
  | ({ status: 'ready' } & MeResponse);

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  discord_oauth_not_configured: 'サーバー側の Discord OAuth2 環境変数（DISCORD_CLIENT_ID / SECRET）が未設定です。',
  invalid_state: 'ログインの有効期限が切れたか、状態検証に失敗しました。もう一度お試しください。',
  missing_code: 'Discord から認可コードを取得できませんでした。',
  max_members_reached: '登録メンバー数の上限に達しているため、新規ログインできません。',
  discord_token_exchange_failed: 'Discord とのトークン交換に失敗しました。設定を確認してください。',
  discord_user_fetch_failed: 'Discord ユーザー情報の取得に失敗しました。',
};

export function formatAuthError(code: string | null): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? `Discord ログインに失敗しました（${code}）。`;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [authError, setAuthError] = useState<string | null>(() => formatAuthError(INITIAL_AUTH_CALLBACK.error));

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>('/api/me');
      setState({ status: 'ready', ...me });
    } catch (e) {
      setState(
        isNetworkError(e)
          ? { status: 'offline' }
          : { status: 'ready', authenticated: false, devFallback: false, user: null },
      );
    }
  }, []);

  const loginWithDiscord = useCallback(async () => {
    setAuthError(null);
    if (isTauriDesktop()) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(DISCORD_DESKTOP_LOGIN_URL);
      } catch (e) {
        setAuthError(
          `外部ブラウザを起動できませんでした: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    window.location.href = DISCORD_WEB_LOGIN_URL;
  }, []);

  const logout = useCallback(async () => {
    clearAuthToken();
    try {
      await api.post<void>('/api/auth/logout');
    } catch {
      /* オフライン時でもローカル JWT は破棄済み */
    } finally {
      await refresh();
    }
  }, [refresh]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // 初回ユーザー情報取得
  useEffect(() => {
    let cancelled = false;
    api
      .get<MeResponse>('/api/me')
      .then((me) => !cancelled && setState({ status: 'ready', ...me }))
      .catch(
        (e) =>
          !cancelled &&
          setState(
            isNetworkError(e)
              ? { status: 'offline' }
              : { status: 'ready', authenticated: false, devFallback: false, user: null },
          ),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  // Tauri Desktop: satlas://auth/callback?token=... ディープリンク受信
  useEffect(() => {
    if (!isTauriDesktop()) return;
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const handleDeepLinkUrl = (urlStr: string) => {
      if (disposed || !urlStr.startsWith('satlas://')) return;
      const { token, error } = extractAuthCallbackParams(urlStr);
      if (error) {
        setAuthError(formatAuthError(error));
        return;
      }
      if (token) {
        setAuthError(null);
        setAuthToken(token);
        void refresh();
      }
    };

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlistenEvent = await listen<string>('satlas://auth-callback', (event) => {
          handleDeepLinkUrl(event.payload);
        });
        if (disposed) {
          unlistenEvent();
        } else {
          unlisteners.push(unlistenEvent);
        }
      } catch {
        /* 開発環境などでイベント未登録時は無視 */
      }

      try {
        const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
        const initialUrls = await getCurrent();
        if (initialUrls) {
          for (const u of initialUrls) handleDeepLinkUrl(u);
        }
        const unlistenDeepLink = await onOpenUrl((urls) => {
          for (const u of urls) handleDeepLinkUrl(u);
        });
        if (disposed) {
          unlistenDeepLink();
        } else {
          unlisteners.push(unlistenDeepLink);
        }
      } catch {
        /* deep-link プラグイン未初期化時は無視 */
      }
    })();

    return () => {
      disposed = true;
      for (const fn of unlisteners) fn();
    };
  }, [refresh]);

  return { auth: state, authError, clearAuthError, refresh, loginWithDiscord, logout };
}
