import { useCallback, useEffect, useState } from 'react';
import { api, isNetworkError } from '../lib/api';
import type { TimetableEntry } from '../types';

export type TimetableSource = 'loading' | 'server' | 'empty' | 'offline';

/** 時間割の取得・保存。サーバー未接続でも画面が壊れないよう source で状態を返す。 */
export function useTimetable() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [source, setSource] = useState<TimetableSource>('loading');

  const reload = useCallback(async () => {
    try {
      const list = await api.get<TimetableEntry[]>('/api/timetables');
      setEntries(list);
      setSource(list.length ? 'server' : 'empty');
    } catch (e) {
      setSource(isNetworkError(e) ? 'offline' : 'empty');
    }
  }, []);

  const saveEntries = useCallback(
    async (items: TimetableEntry[]) => {
      await api.post<TimetableEntry[]>('/api/timetables', items);
      await reload();
    },
    [reload],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .get<TimetableEntry[]>('/api/timetables')
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setSource(list.length ? 'server' : 'empty');
      })
      .catch((e) => !cancelled && setSource(isNetworkError(e) ? 'offline' : 'empty'));
    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, source, reload, saveEntries };
}
