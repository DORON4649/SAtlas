import { useCallback, useEffect, useState } from 'react';
import { api, isNetworkError } from '../lib/api';
import type { MeResponse } from '../types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'offline' }
  | ({ status: 'ready' } & MeResponse);

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>('/api/me');
      setState({ status: 'ready', ...me });
    } catch (e) {
      setState(isNetworkError(e) ? { status: 'offline' } : { status: 'ready', authenticated: false, devFallback: false, user: null });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post<void>('/api/auth/logout');
    } finally {
      await refresh();
    }
  }, [refresh]);

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

  return { auth: state, refresh, logout };
}
