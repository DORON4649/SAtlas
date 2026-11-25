import type { CalendarEvent } from '../types';

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarLayerFilter {
  personal: boolean;
  google: boolean;
  shared: boolean;
  assignments: boolean;
}

export const DEFAULT_LAYERS: CalendarLayerFilter = {
  personal: true,
  google: true,
  shared: true,
  assignments: true,
};

export const EVENT_COLORS = [
  { label: 'ブルー', value: '#3b82f6' },
  { label: 'エメラルド', value: '#10b981' },
  { label: 'バイオレット', value: '#8b5cf6' },
  { label: 'アンバー', value: '#f59e0b' },
  { label: 'ローズ', value: '#f43f5e' },
  { label: 'シアン', value: '#06b6d4' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD" (ローカルタイム) */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date -> "YYYY-MM-DDTHH:mm:ss" (Spring LocalDateTime 用) */
export function toLocalIso(d: Date): string {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** ISO LocalDateTime -> "YYYY-MM-DDTHH:mm" (datetime-local input 用) */
export function toDateTimeInput(iso: string): string {
  return iso.slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DDTHH:mm:00" */
export function fromDateTimeInput(val: string): string {
  return val.length === 16 ? `${val}:00` : val;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 0);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** 日曜始まりの週開始日 */
export function startOfWeek(d: Date): Date {
  return startOfDay(addDays(d, -d.getDay()));
}

/** 月表示（6週=42日）のグリッド日付配列 */
export function buildMonthGrid(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** 週表示（7日）の日付配列 */
export function buildWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 表示モードに応じた API 取得範囲 [start, end] */
export function getVisibleRange(anchor: Date, mode: CalendarViewMode): { start: Date; end: Date } {
  if (mode === 'month') {
    const grid = buildMonthGrid(anchor);
    return { start: startOfDay(grid[0]), end: endOfDay(grid[grid.length - 1]) };
  }
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  return { start: startOfDay(anchor), end: endOfDay(anchor) };
}

/** 指定日にその予定が重なるか判定 */
export function eventOccursOnDate(ev: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  const evStart = new Date(ev.startAt).getTime();
  let evEnd = new Date(ev.endAt).getTime();

  // 終日イベントの endAt が翌日 00:00 (排他終了) の場合は 1ms 引く
  if (ev.allDay && evEnd > evStart) {
    evEnd -= 1;
  }
  return evStart <= dayEnd && evEnd >= dayStart;
}

/** レイヤーフィルタ判定 */
export function matchesLayerFilter(ev: CalendarEvent, layers: CalendarLayerFilter): boolean {
  if (ev.source === 'ASSIGNMENT') return layers.assignments;
  if (!ev.mine) return layers.shared;
  if (ev.source === 'GOOGLE_ICAL') {
    return layers.google || (ev.isShared && layers.shared);
  }
  return layers.personal || (ev.isShared && layers.shared);
}

/** 予定の表示色 */
export function resolveEventColor(ev: CalendarEvent): string {
  if (ev.color) return ev.color;
  if (ev.source === 'ASSIGNMENT') return '#f43f5e';
  if (!ev.mine) return '#06b6d4';
  if (ev.source === 'GOOGLE_ICAL') return '#10b981';
  return '#3b82f6';
}

export function formatTimeRange(ev: CalendarEvent): string {
  if (ev.allDay) return '終日';
  const s = new Date(ev.startAt);
  const e = new Date(ev.endAt);
  const st = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
  if (ev.source === 'ASSIGNMENT') return `締切 ${st}`;
  const et = `${pad(e.getHours())}:${pad(e.getMinutes())}`;
  return `${st}〜${et}`;
}
