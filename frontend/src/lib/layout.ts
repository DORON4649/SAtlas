import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';

/** ウィジェット ID（既存の localStorage レイアウト互換のため 'current-class' はそのまま） */
export const WIDGET_IDS = ['clock', 'weather', 'current-class', 'assignments', 'memos'] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

/**
 * ブレークポイントはコンテナ幅基準。3 ペイン時の中央ワークスペース（~900px）でも
 * md=12 カラムを維持して横いっぱいに 3 カラム並ぶようにしている。
 */
export const GRID_BREAKPOINTS = { lg: 1100, md: 760, sm: 480, xs: 0 } as const;
export const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 1 } as const;
export type GridBreakpoint = keyof typeof GRID_BREAKPOINTS;

// 12 カラム基準: 上段 4+4+4 = 3 カラム、下段 6+6 = 2 カラム
const BASE_LAYOUT: LayoutItem[] = [
  { i: 'clock', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'weather', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'current-class', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'assignments', x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'memos', x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
];

const SM_LAYOUT: LayoutItem[] = [
  { i: 'clock', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'weather', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'current-class', x: 0, y: 2, w: 6, h: 2, minW: 3, minH: 2 },
  { i: 'assignments', x: 0, y: 4, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'memos', x: 0, y: 8, w: 6, h: 4, minW: 3, minH: 3 },
];

const stack = (items: LayoutItem[]): LayoutItem[] => {
  let y = 0;
  return items.map((it) => {
    const next = { ...it, x: 0, w: 1, minW: 1, y };
    y += it.h;
    return next;
  });
};

export const DEFAULT_LAYOUTS: ResponsiveLayouts<GridBreakpoint> = {
  lg: BASE_LAYOUT,
  md: BASE_LAYOUT,
  sm: SM_LAYOUT,
  xs: stack(BASE_LAYOUT),
};

const isLayoutItem = (v: unknown): v is LayoutItem =>
  typeof v === 'object' && v !== null && typeof (v as LayoutItem).i === 'string' &&
  ['x', 'y', 'w', 'h'].every((k) => typeof (v as unknown as Record<string, unknown>)[k] === 'number');

/**
 * 保存済みレイアウト（旧形式: lg 配列のみ / 新形式: ブレークポイント別）を正規化し、
 * 新しく追加されたウィジェットはデフォルト位置で補完、存在しないウィジェットは除去する。
 */
export function normalizeLayouts(raw: unknown): ResponsiveLayouts<GridBreakpoint> {
  const source: Record<string, unknown> = Array.isArray(raw)
    ? { lg: raw, md: raw }
    : typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const result: ResponsiveLayouts<GridBreakpoint> = {};
  for (const bp of Object.keys(GRID_BREAKPOINTS) as GridBreakpoint[]) {
    const defaults = DEFAULT_LAYOUTS[bp] ?? BASE_LAYOUT;
    const saved = Array.isArray(source[bp]) ? (source[bp] as unknown[]).filter(isLayoutItem) : [];
    const known = saved.filter((it) => (WIDGET_IDS as readonly string[]).includes(it.i));
    const bottom = known.reduce((max, it) => Math.max(max, it.y + it.h), 0);
    const missing = defaults
      .filter((d) => !known.some((k) => k.i === d.i))
      .map((d) => ({ ...d, y: known.length ? bottom + d.y : d.y }));
    // min 制約はコード側の定義を優先
    const merged = [...known, ...missing].map((it) => {
      const def = defaults.find((d) => d.i === it.i);
      return def ? { ...it, minW: def.minW, minH: def.minH } : it;
    });
    result[bp] = merged;
  }
  return result;
}

export const LAYOUT_STORAGE_KEY = 'satlas_dashboard_layout';

export function loadLocalLayouts(): ResponsiveLayouts<GridBreakpoint> {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    return normalizeLayouts(saved ? JSON.parse(saved) : null);
  } catch {
    return normalizeLayouts(null);
  }
}

export const toMutableLayouts = (layouts: ResponsiveLayouts<GridBreakpoint>) =>
  Object.fromEntries(Object.entries(layouts).map(([k, v]) => [k, [...(v as Layout)]])) as Record<
    GridBreakpoint,
    LayoutItem[]
  >;
