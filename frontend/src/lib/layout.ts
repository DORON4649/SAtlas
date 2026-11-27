import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';

/** ウィジェット ID（既存の localStorage レイアウト互換のため 'current-class' はそのまま） */
export const WIDGET_IDS = ['clock', 'weather', 'current-class', 'assignments', 'memos'] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

/**
 * ブレークポイントはコンテナ幅基準。
 * - lg (>= 1160px): ワイド表示・サイドバー格納時に 3 カラム
 * - md (640〜1159px): 3 ペイン表示の中央カラムでカードが重ならない 2 カラム構成
 * - sm (480〜639px) / xs (< 480px): 省スペース縦積み
 */
export const GRID_BREAKPOINTS = { lg: 1160, md: 640, sm: 480, xs: 0 } as const;
export const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 1 } as const;
export type GridBreakpoint = keyof typeof GRID_BREAKPOINTS;

// 12 カラム（ワイド幅）: 上段 4+4+4 = 3 カラム、下段 6+6 = 2 カラム
const BASE_LAYOUT: LayoutItem[] = [
  { i: 'clock', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'weather', x: 4, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'current-class', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
  { i: 'assignments', x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'memos', x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
];

// 12 カラム（3 ペイン中央幅）: 上段 6+6、中段 12（時間割ステータス）、下段 6+6
const MD_LAYOUT: LayoutItem[] = [
  { i: 'clock', x: 0, y: 0, w: 6, h: 2, minW: 4, minH: 2 },
  { i: 'weather', x: 6, y: 0, w: 6, h: 2, minW: 4, minH: 2 },
  { i: 'current-class', x: 0, y: 2, w: 12, h: 2, minW: 6, minH: 2 },
  { i: 'assignments', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'memos', x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
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
  md: MD_LAYOUT,
  sm: SM_LAYOUT,
  xs: stack(BASE_LAYOUT),
};

const isLayoutItem = (v: unknown): v is LayoutItem =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as LayoutItem).i === 'string' &&
  ['x', 'y', 'w', 'h'].every((k) => typeof (v as unknown as Record<string, unknown>)[k] === 'number');

/** 旧バージョンの窮屈な 3 カラム md デフォルト（w=4 が3枚横並び）かどうか判定 */
const isLegacyCrampedMdLayout = (items: LayoutItem[]): boolean =>
  items.filter((it) => it.y === 0 && it.w <= 4).length >= 3;

/**
 * 保存済みレイアウト（旧形式: lg 配列のみ / 新形式: ブレークポイント別）を正規化し、
 * 新しく追加されたウィジェットはデフォルト位置で補完、存在しないウィジェットは除去する。
 */
export function normalizeLayouts(raw: unknown): ResponsiveLayouts<GridBreakpoint> {
  const source: Record<string, unknown> = Array.isArray(raw)
    ? { lg: raw }
    : typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const result: ResponsiveLayouts<GridBreakpoint> = {};
  for (const bp of Object.keys(GRID_BREAKPOINTS) as GridBreakpoint[]) {
    const defaults = DEFAULT_LAYOUTS[bp] ?? BASE_LAYOUT;
    let saved = Array.isArray(source[bp]) ? (source[bp] as unknown[]).filter(isLayoutItem) : [];
    if (bp === 'md' && isLegacyCrampedMdLayout(saved)) {
      saved = [];
    }
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
