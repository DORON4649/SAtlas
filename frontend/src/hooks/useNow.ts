import { useEffect, useState } from 'react';

/** intervalMs ごとに現在時刻を返す（ウィジェット単位で再描画を閉じ込める） */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
