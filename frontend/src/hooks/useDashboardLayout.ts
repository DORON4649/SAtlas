import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { api } from '../lib/api';
import {
  DEFAULT_LAYOUTS,
  LAYOUT_STORAGE_KEY,
  loadLocalLayouts,
  normalizeLayouts,
  toMutableLayouts,
  type GridBreakpoint,
} from '../lib/layout';

export type LayoutSyncState = 'local' | 'synced' | 'saving' | 'error';

/**
 * ダッシュボードレイアウトの状態管理。
 * localStorage に即時保存し、サーバー (GET/PUT /api/dashboard/layout) に接続できればデバウンス同期する。
 */
export function useDashboardLayout() {
  const [layouts, setLayouts] = useState<ResponsiveLayouts<GridBreakpoint>>(loadLocalLayouts);
  const [syncState, setSyncState] = useState<LayoutSyncState>('local');
  const serverReady = useRef(false);
  const lastJson = useRef(JSON.stringify(layouts));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ layout: unknown }>('/api/dashboard/layout')
      .then((res) => {
        if (cancelled) return;
        serverReady.current = true;
        if (res.layout) {
          const next = normalizeLayouts(res.layout);
          lastJson.current = JSON.stringify(next);
          localStorage.setItem(LAYOUT_STORAGE_KEY, lastJson.current);
          setLayouts(next);
        }
        setSyncState('synced');
      })
      .catch(() => !cancelled && setSyncState('local'));
    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
    };
  }, []);

  const persist = useCallback((next: ResponsiveLayouts<GridBreakpoint>) => {
    const json = JSON.stringify(next);
    if (json === lastJson.current) return false;
    lastJson.current = json;
    localStorage.setItem(LAYOUT_STORAGE_KEY, json);

    if (serverReady.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setSyncState('saving');
        api
          .put('/api/dashboard/layout', { layout: next })
          .then(() => setSyncState('synced'))
          .catch(() => setSyncState('error'));
      }, 800);
    }
    return true;
  }, []);

  const onLayoutChange = useCallback(
    (_current: Layout, all: ResponsiveLayouts<GridBreakpoint>) => {
      const next = toMutableLayouts(all);
      if (persist(next)) setLayouts(next);
    },
    [persist],
  );

  const resetLayout = useCallback(() => {
    persist(DEFAULT_LAYOUTS);
    setLayouts(DEFAULT_LAYOUTS);
  }, [persist]);

  return { layouts, onLayoutChange, resetLayout, syncState };
}
