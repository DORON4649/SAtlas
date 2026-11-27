import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  GripHorizontal,
  LoaderCircle,
  Pin,
  Plus,
  Save,
  Sigma,
  Trash,
} from 'lucide-react';
import { isLocalRunnerConnected, subscribeRunnerStatus } from '../../lib/codeRunner';
import {
  DEFAULT_SECTION_COLOR,
  DEFAULT_SECTION_NAME,
  cloneContainer,
  createCodeContainer,
  createMathContainer,
  createTextContainer,
  nextOneNoteId,
  parseOneNoteContent,
  renderKatexHtml,
  serializeOneNoteContent,
  type InkPoint,
  type InkStroke,
  type NoteContainer,
  type OneNotePageContent,
  type PageBackground,
} from '../../lib/oneNoteModel';
import { applyTextFormatAction, type TextFormatAction } from '../../lib/textMarkdown';
import type { LectureNote, LectureNoteInput } from '../../types';
import SidebarToggleIcon from '../layout/SidebarToggleIcon';
import CodeExecutionCell from './CodeExecutionCell';
import EditorContextMenu, { type ContextMenuState } from './EditorContextMenu';
import NotebookRibbon, { type DrawState } from './NotebookRibbon';
import NotebookTutorialModal from './NotebookTutorialModal';
import RunnerSettingsModal from './RunnerSettingsModal';
import ScientificCalculatorModal from './ScientificCalculatorModal';
import TextContainerBody from './TextContainerBody';

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface Props {
  note: LectureNote | null;
  offline: boolean;
  leftPaneOpen?: boolean;
  rightPaneOpen?: boolean;
  codeTabSize?: 2 | 4;
  codeAutoClosePairs?: boolean;
  onToggleLeftPane?: () => void;
  onToggleRightPane?: () => void;
  onSave: (id: number, patch: LectureNoteInput) => Promise<LectureNote>;
  onCreateNew: () => void;
  onDelete: (note: LectureNote) => void;
  onDraftChange?: (draft: LectureNote | null) => void;
}

const AUTOSAVE_DELAY_MS = 800;
const TUTORIAL_SEEN_KEY = 'satlas_onenote_tutorial_seen_v2';
const CANVAS_MIN_WIDTH = 1400;
const CANVAS_MIN_HEIGHT = 1100;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

function clampZoom(scale: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)) * 100) / 100;
}

const MATH_PALETTE: { label: string; snippet: string }[] = [
  { label: '分数', snippet: '\\frac{a}{b}' },
  { label: 'ルート', snippet: '\\sqrt{x}' },
  { label: '累乗', snippet: 'x^{2}' },
  { label: '添字', snippet: 'a_{n}' },
  { label: '総和 Σ', snippet: '\\sum_{i=1}^{n} ' },
  { label: '積分 ∫', snippet: '\\int_{a}^{b} f(x)\\,dx' },
  { label: '極限 lim', snippet: '\\lim_{x \\to 0} ' },
  { label: 'ベクトル', snippet: '\\vec{v}' },
  { label: '行列', snippet: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: '±', snippet: '\\pm ' },
  { label: '∞', snippet: '\\infty' },
  { label: 'θ', snippet: '\\theta' },
];

function buildSvgPath(points: InkPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function buildArrowHead(start: InkPoint, end: InkPoint, size: number): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 6) return '';
  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 6;
  const x1 = end.x - size * Math.cos(angle - spread);
  const y1 = end.y - size * Math.sin(angle - spread);
  const x2 = end.x - size * Math.cos(angle + spread);
  const y2 = end.y - size * Math.sin(angle + spread);
  return `M ${x1} ${y1} L ${end.x} ${end.y} L ${x2} ${y2}`;
}

function pointNearPoint(a: InkPoint, b: InkPoint, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}

/** 部分消しゴム：消しゴム半径内の点を抜いてストロークを分割する */
function erasePartialFromStrokes(strokes: InkStroke[], pt: InkPoint, radius: number): InkStroke[] {
  let changed = false;
  const out: InkStroke[] = [];
  for (const s of strokes) {
    const hit = s.points.some((p) => pointNearPoint(p, pt, radius + s.width / 2));
    if (!hit) {
      out.push(s);
      continue;
    }
    changed = true;
    let seg: InkPoint[] = [];
    for (const p of s.points) {
      if (pointNearPoint(p, pt, radius + s.width / 2)) {
        if (seg.length >= 2) {
          out.push({ ...s, id: nextOneNoteId('ink'), arrow: false, points: seg });
        }
        seg = [];
      } else {
        seg.push(p);
      }
    }
    if (seg.length >= 2) {
      out.push({ ...s, id: nextOneNoteId('ink'), arrow: false, points: seg });
    }
  }
  return changed ? out : strokes;
}

/** ページ背景 CSS スタイル（ライト／ダークテーマ対応） */
function backgroundStyle(bg: PageBackground): React.CSSProperties {
  if (bg === 'ruled') {
    return {
      backgroundImage: 'linear-gradient(to bottom, var(--satlas-canvas-line) 1px, transparent 1px)',
      backgroundSize: '100% 28px',
    };
  }
  if (bg === 'grid') {
    return {
      backgroundImage:
        'linear-gradient(to right, var(--satlas-canvas-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--satlas-canvas-grid) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
    };
  }
  return {};
}

/**
 * Microsoft OneNote 風の中央ワークスペース。
 * - 4 タブリボンバー（ホーム / 挿入 / 描画 / 表示・ツール）
 * - 自由配置キャンバス（テキスト・KaTeX数式・Python/Java/C実行セル）
 * - 透明 SVG 直接描画レイヤー（ペン・蛍光マーカー・消しゴム・Shift直線矢印・Undo/Redo）
 * - フローティング自然表示関数電卓・右クリックメニュー・4ステップチュートリアル
 */
export default function OneNoteWorkspace({
  note,
  offline,
  leftPaneOpen = true,
  rightPaneOpen = true,
  codeTabSize = 2,
  codeAutoClosePairs = true,
  onToggleLeftPane,
  onToggleRightPane,
  onSave,
  onCreateNew,
  onDelete,
  onDraftChange,
}: Props) {
  const [title, setTitle] = useState(() => note?.title ?? '');
  const [isPinned, setIsPinned] = useState(() => note?.isPinned ?? false);
  const [page, setPage] = useState<OneNotePageContent>(() => parseOneNoteContent(note?.contentJson));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingMathId, setEditingMathId] = useState<string | null>(null);
  const textareaMapRef = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // 描画ツール＆Undo/Redo
  const [drawState, setDrawState] = useState<DrawState>({
    tool: 'select',
    color: '#38bdf8',
    width: 3,
    recentColors: ['#38bdf8', '#ef4444', '#fde047'],
  });
  const [inkUndoStack, setInkUndoStack] = useState<InkStroke[][]>([]);
  const [inkRedoStack, setInkRedoStack] = useState<InkStroke[][]>([]);
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);
  const eraserSnapshotRef = useRef<InkStroke[] | null>(null);

  // モーダル・コンテキストメニュー・ズーム
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [runnerModalOpen, setRunnerModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(() => localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1');
  const [zoomScale, setZoomScale] = useState(1.0);

  // 保存状態
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(() => ({
    title: note?.title ?? '',
    contentJson: note?.contentJson ?? '',
    isPinned: note?.isPinned ?? false,
  }));

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomScaleRef = useRef(1.0);
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);
  const dragBoxRef = useRef<{
    id: string;
    pointerId: number;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
  } | null>(null);

  const localRunnerConnected = useSyncExternalStore(subscribeRunnerStatus, isLocalRunnerConnected, () => false);
  const serializedContent = useMemo(() => serializeOneNoteContent(page), [page]);

  // 編集中ドラフトを AI パネルへ通知
  useEffect(() => {
    if (!note) {
      onDraftChange?.(null);
      return;
    }
    onDraftChange?.({
      ...note,
      title,
      contentJson: serializedContent,
      isPinned,
    });
  }, [note, title, serializedContent, isPinned, onDraftChange]);

  const isDirty =
    note !== null &&
    (title !== lastSaved.title || serializedContent !== lastSaved.contentJson || isPinned !== lastSaved.isPinned);

  const performSave = useCallback(async () => {
    if (!note) return;
    setSaveStatus('saving');
    setSaveError(null);
    const patch: LectureNoteInput = {
      title: title.trim() || '無題のページ',
      contentJson: serializedContent,
      isPinned,
    };
    try {
      const saved = await onSave(note.id, patch);
      setLastSaved({
        title: saved.title,
        contentJson: saved.contentJson,
        isPinned: saved.isPinned,
      });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, [note, title, serializedContent, isPinned, onSave]);

  useEffect(() => {
    if (!note || !isDirty) return;
    const timer = window.setTimeout(() => {
      void performSave();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [note, isDirty, performSave]);

  // ---- コンテナ操作 ----
  const updatePage = useCallback((updater: (prev: OneNotePageContent) => OneNotePageContent) => {
    setPage((prev) => updater(prev));
    setSaveStatus('dirty');
  }, []);

  const nextInsertPosition = useCallback((): { x: number; y: number } => {
    if (page.containers.length === 0) return { x: 36, y: 32 };
    const maxY = Math.max(...page.containers.map((c) => c.y));
    return { x: 36, y: maxY + 140 };
  }, [page.containers]);

  const insertContainer = useCallback(
    (container: NoteContainer) => {
      updatePage((prev) => ({ ...prev, containers: [...prev.containers, container] }));
      setSelectedId(container.id);
      if (container.kind === 'math') {
        setEditingMathId(container.id);
      } else if (container.kind === 'text') {
        setEditingTextId(container.id);
      }
      setDrawState((prev) => (prev.tool === 'select' ? prev : { ...prev, tool: 'select' }));
    },
    [updatePage],
  );

  const updateContainer = useCallback(
    (id: string, updater: (c: NoteContainer) => NoteContainer) => {
      updatePage((prev) => ({
        ...prev,
        containers: prev.containers.map((c) => (c.id === id ? updater(c) : c)),
      }));
    },
    [updatePage],
  );

  const deleteContainer = useCallback(
    (id: string) => {
      updatePage((prev) => ({
        ...prev,
        containers: prev.containers.filter((c) => c.id !== id),
      }));
      if (selectedId === id) setSelectedId(null);
      if (editingTextId === id) setEditingTextId(null);
      if (editingMathId === id) setEditingMathId(null);
    },
    [updatePage, selectedId, editingTextId, editingMathId],
  );

  const duplicateContainer = useCallback(
    (id: string) => {
      const target = page.containers.find((c) => c.id === id);
      if (!target) return;
      insertContainer(cloneContainer(target));
    },
    [page.containers, insertContainer],
  );

  // リボン「ホーム」テキスト書式
  const ensureSelectedTextContainer = useCallback(
    (appendLine: string) => {
      const target =
        page.containers.find((c) => c.id === selectedId && c.kind === 'text') ??
        [...page.containers].reverse().find((c) => c.kind === 'text');
      if (target && target.kind === 'text') {
        updateContainer(target.id, (c) =>
          c.kind === 'text' ? { ...c, text: `${c.text}${c.text ? '\n' : ''}${appendLine}` } : c,
        );
        setSelectedId(target.id);
      } else {
        const pos = nextInsertPosition();
        insertContainer(createTextContainer(pos.x, pos.y, appendLine));
      }
    },
    [page.containers, selectedId, updateContainer, nextInsertPosition, insertContainer],
  );

  const handleWrapInline = (prefix: string, suffix: string, placeholder: string) => {
    ensureSelectedTextContainer(`${prefix}${placeholder}${suffix}`);
  };

  /**
   * 基準点（マウスカーソル座標、未指定時は表示領域中央）が画面上で動かないようにズームする。
   */
  const applyZoom = useCallback((nextScaleRaw: number, anchorClientPos?: { x: number; y: number }) => {
    const nextScale = clampZoom(nextScaleRaw);
    const oldScale = zoomScaleRef.current;
    if (nextScale === oldScale) return;

    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const offsetX = anchorClientPos ? anchorClientPos.x - rect.left : scrollEl.clientWidth / 2;
      const offsetY = anchorClientPos ? anchorClientPos.y - rect.top : scrollEl.clientHeight / 2;
      const canvasX = (scrollEl.scrollLeft + offsetX) / oldScale;
      const canvasY = (scrollEl.scrollTop + offsetY) / oldScale;

      pendingScrollRef.current = {
        left: Math.max(0, canvasX * nextScale - offsetX),
        top: Math.max(0, canvasY * nextScale - offsetY),
      };
    }

    zoomScaleRef.current = nextScale;
    setZoomScale(nextScale);
  }, []);

  // DOM に新しいラッパーサイズ・scale が反映された直後（描画前）にスクロール位置を補正
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    const scrollEl = scrollContainerRef.current;
    if (!pending || !scrollEl) return;
    pendingScrollRef.current = null;
    scrollEl.scrollLeft = pending.left;
    scrollEl.scrollTop = pending.top;
  }, [zoomScale]);

  const handleZoomIn = useCallback(() => applyZoom(zoomScaleRef.current + ZOOM_STEP), [applyZoom]);
  const handleZoomOut = useCallback(() => applyZoom(zoomScaleRef.current - ZOOM_STEP), [applyZoom]);
  const handleZoomReset = useCallback(() => applyZoom(1.0), [applyZoom]);

  // Ctrl + ホイールでカーソル位置基準ズーム（ブラウザ全体の拡大縮小を防止）
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyZoom(zoomScaleRef.current + delta, { x: e.clientX, y: e.clientY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  // Ctrl + + / Ctrl + - / Ctrl + 0 ショートカット
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '+' || e.key === '=' || e.key === ';') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  // ---- コンテナのドラッグ移動 & リサイズ ----
  const startContainerDrag = (e: React.PointerEvent, c: NoteContainer, mode: 'move' | 'resize') => {
    if (drawState.tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedId(c.id);
    dragBoxRef.current = {
      id: c.id,
      pointerId: e.pointerId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: c.x,
      origY: c.y,
      origW: c.width,
    };
  };

  const moveContainerDrag = (e: React.PointerEvent) => {
    const drag = dragBoxRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // 左ボタンが押下されていない単なるホバー移動では絶対に座標を更新しない
    if ((e.buttons & 1) === 0) {
      dragBoxRef.current = null;
      return;
    }
    const dx = (e.clientX - drag.startX) / zoomScale;
    const dy = (e.clientY - drag.startY) / zoomScale;
    if (drag.mode === 'move') {
      updateContainer(drag.id, (c) => ({
        ...c,
        x: Math.max(8, Math.round(drag.origX + dx)),
        y: Math.max(8, Math.round(drag.origY + dy)),
      }));
    } else {
      updateContainer(drag.id, (c) => ({
        ...c,
        width: Math.max(240, Math.min(920, Math.round(drag.origW + dx))),
      }));
    }
  };

  const endContainerDrag = () => {
    dragBoxRef.current = null;
  };

  // ---- 直接描画 SVG レイヤー（Pointer Events・ズーム座標補正対応） ----
  const getCanvasPoint = (e: React.PointerEvent): InkPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.round(((e.clientX - rect.left) / zoomScale) * 10) / 10,
      y: Math.round(((e.clientY - rect.top) / zoomScale) * 10) / 10,
    };
  };

  const handleInkPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawState.tool === 'select' || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);

    if (drawState.tool === 'eraser-stroke' || drawState.tool === 'eraser-partial') {
      eraserSnapshotRef.current = page.strokes;
      applyEraserAt(pt);
      return;
    }

    const stroke: InkStroke = {
      id: nextOneNoteId('ink'),
      tool: drawState.tool === 'highlighter' ? 'highlighter' : 'pen',
      color: drawState.color,
      width: drawState.width,
      opacity: drawState.tool === 'highlighter' ? 0.4 : 1,
      points: [pt],
      arrow: e.shiftKey,
    };
    setActiveStroke(stroke);
  };

  const applyEraserAt = (pt: InkPoint) => {
    const radius = Math.max(10, drawState.width * 1.4);
    if (drawState.tool === 'eraser-stroke') {
      updatePage((prev) => {
        const filtered = prev.strokes.filter(
          (s) => !s.points.some((p) => pointNearPoint(p, pt, radius + s.width / 2)),
        );
        return filtered.length === prev.strokes.length ? prev : { ...prev, strokes: filtered };
      });
    } else if (drawState.tool === 'eraser-partial') {
      updatePage((prev) => {
        const next = erasePartialFromStrokes(prev.strokes, pt, radius);
        return next === prev.strokes ? prev : { ...prev, strokes: next };
      });
    }
  };

  const handleInkPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawState.tool === 'select') return;
    if (e.buttons === 0 && !activeStroke) return;
    const pt = getCanvasPoint(e);

    if (drawState.tool === 'eraser-stroke' || drawState.tool === 'eraser-partial') {
      if (eraserSnapshotRef.current !== null) {
        applyEraserAt(pt);
      }
      return;
    }

    if (!activeStroke) return;
    setActiveStroke((prev) => {
      if (!prev) return null;
      // Shift 押下中は始点→終点の直線・矢印にスナップ補正
      if (e.shiftKey) {
        return { ...prev, arrow: true, points: [prev.points[0], pt] };
      }
      const last = prev.points[prev.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return prev;
      return { ...prev, arrow: false, points: [...prev.points, pt] };
    });
  };

  const handleInkPointerUp = () => {
    if (eraserSnapshotRef.current !== null) {
      const before = eraserSnapshotRef.current;
      eraserSnapshotRef.current = null;
      if (before !== page.strokes) {
        setInkUndoStack((u) => [...u.slice(-29), before]);
        setInkRedoStack([]);
      }
      return;
    }

    if (activeStroke) {
      const finished = activeStroke;
      setActiveStroke(null);
      setInkUndoStack((u) => [...u.slice(-29), page.strokes]);
      setInkRedoStack([]);
      updatePage((prev) => ({ ...prev, strokes: [...prev.strokes, finished] }));
    }
  };

  const handleUndoInk = () => {
    if (inkUndoStack.length === 0) return;
    const prevStrokes = inkUndoStack[inkUndoStack.length - 1];
    setInkUndoStack((u) => u.slice(0, -1));
    setInkRedoStack((r) => [...r, page.strokes]);
    updatePage((prev) => ({ ...prev, strokes: prevStrokes }));
  };

  const handleRedoInk = () => {
    if (inkRedoStack.length === 0) return;
    const nextStrokes = inkRedoStack[inkRedoStack.length - 1];
    setInkRedoStack((r) => r.slice(0, -1));
    setInkUndoStack((u) => [...u, page.strokes]);
    updatePage((prev) => ({ ...prev, strokes: nextStrokes }));
  };

  const handleClearInk = () => {
    if (page.strokes.length === 0) return;
    setInkUndoStack((u) => [...u.slice(-29), page.strokes]);
    setInkRedoStack([]);
    updatePage((prev) => ({ ...prev, strokes: [] }));
  };

  const registerTextarea = useCallback((id: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaMapRef.current.set(id, el);
    } else {
      textareaMapRef.current.delete(id);
    }
  }, []);

  /** 右クリック書式メニューから選択範囲をトグル装飾し、テキストボックスへフォーカスを戻す */
  const handleApplyTextFormat = useCallback(
    (containerId: string, start: number, end: number, action: TextFormatAction) => {
      const target = page.containers.find((c) => c.id === containerId && c.kind === 'text');
      if (!target || target.kind !== 'text') return;
      const res = applyTextFormatAction(target.text, start, end, action);
      updateContainer(containerId, (c) => (c.kind === 'text' ? { ...c, text: res.text } : c));
      setEditingTextId(containerId);
      requestAnimationFrame(() => {
        const el = textareaMapRef.current.get(containerId);
        if (el) {
          el.focus();
          el.setSelectionRange(res.selectionStart, res.selectionEnd);
        }
      });
    },
    [page.containers, updateContainer],
  );

  // ---- 右クリックメニュー ----
  const handleCanvasContextMenu = (e: React.MouseEvent, containerId: string | null) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    const canvasX = rect ? (e.clientX - rect.left) / zoomScale : 40;
    const canvasY = rect ? (e.clientY - rect.top) / zoomScale : 40;
    if (containerId) setSelectedId(containerId);
    setContextMenu({
      clientX: e.clientX,
      clientY: e.clientY,
      canvasX,
      canvasY,
      containerId,
    });
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawState.tool !== 'select' || e.target !== e.currentTarget) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    insertContainer(
      createTextContainer((e.clientX - rect.left) / zoomScale, (e.clientY - rect.top) / zoomScale, ''),
    );
  };

  const canvasWidth = useMemo(() => {
    const maxBoxX = page.containers.reduce((m, c) => Math.max(m, c.x + c.width + 80), 0);
    const maxInkX = page.strokes.reduce(
      (m, s) => Math.max(m, ...s.points.map((p) => p.x + 120)),
      0,
    );
    return Math.max(CANVAS_MIN_WIDTH, maxBoxX, maxInkX);
  }, [page]);

  const canvasHeight = useMemo(() => {
    const maxBoxY = page.containers.reduce((m, c) => Math.max(m, c.y + 320), 0);
    const maxInkY = page.strokes.reduce(
      (m, s) => Math.max(m, ...s.points.map((p) => p.y + 120)),
      0,
    );
    return Math.max(CANVAS_MIN_HEIGHT, maxBoxY, maxInkY);
  }, [page]);

  const closeTutorial = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    setTutorialOpen(false);
  };

  if (!note) {
    return (
      <div className="flex h-[calc(100vh-5.5rem)] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-indigo-400/70" />
        <h2 className="text-base font-semibold text-slate-200">講義ノートページを選択または作成</h2>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
          OneNote 風の 3 層構造（科目 ＞ 色付きセクション ＞ ページ）と自由配置キャンバス・直接ペン描画・自然表示関数電卓・コード実行セルを利用できます。
        </p>
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          最初のページを作成
        </button>
      </div>
    );
  }

  const allStrokes = activeStroke ? [...page.strokes, activeStroke] : page.strokes;

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90">
      {/* ページヘッダー */}
      <div
        style={{ borderTopColor: note.sectionColor || DEFAULT_SECTION_COLOR }}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-t-4 border-slate-800 px-3 py-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onToggleLeftPane && (
            <button
              type="button"
              onClick={onToggleLeftPane}
              title={leftPaneOpen ? '左サイドバーを折りたたむ (Ctrl+\\)' : '左サイドバーを展開 (Ctrl+\\)'}
              aria-label={leftPaneOpen ? '左サイドバーを折りたたむ' : '左サイドバーを展開'}
              aria-pressed={leftPaneOpen}
              className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
                leftPaneOpen
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
              }`}
            >
              <SidebarToggleIcon side="left" open={leftPaneOpen} className="h-4 w-4" />
            </button>
          )}
          <span
            style={{ backgroundColor: `${note.sectionColor || DEFAULT_SECTION_COLOR}28`, color: note.sectionColor || DEFAULT_SECTION_COLOR }}
            className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          >
            {note.subjectName} / {note.sectionName || DEFAULT_SECTION_NAME}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaveStatus('dirty');
            }}
            placeholder="ページタイトルを入力..."
            className="min-w-0 flex-1 bg-transparent text-base font-bold text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-400">
            {saveStatus === 'saving' ? (
              <>
                <LoaderCircle className="h-3 w-3 animate-spin text-cyan-400" />
                保存中...
              </>
            ) : saveStatus === 'error' ? (
              <span className="text-rose-400">{saveError ?? '保存エラー'}</span>
            ) : isDirty ? (
              <span className="text-amber-300">未保存</span>
            ) : (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                {offline ? 'ローカル保存済' : '保存済'}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => void performSave()}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700"
          >
            <Save className="h-3.5 w-3.5 text-cyan-400" />
            保存
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPinned((v) => !v);
              setSaveStatus('dirty');
            }}
            className={`rounded-lg border p-1.5 transition-colors ${
              isPinned
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title={isPinned ? 'ピン解除' : 'ピン留め'}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
            title="このページを削除"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
          {onToggleRightPane && (
            <button
              type="button"
              onClick={onToggleRightPane}
              title={rightPaneOpen ? 'AIパネルを折りたたむ' : 'AIパネルを展開'}
              aria-label={rightPaneOpen ? 'AIパネルを折りたたむ' : 'AIパネルを展開'}
              aria-pressed={rightPaneOpen}
              className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
                rightPaneOpen
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
              }`}
            >
              <SidebarToggleIcon side="right" open={rightPaneOpen} className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Office / OneNote 風リボンバー */}
      <NotebookRibbon
        drawState={drawState}
        onChangeDrawState={setDrawState}
        canUndoInk={inkUndoStack.length > 0}
        canRedoInk={inkRedoStack.length > 0}
        onUndoInk={handleUndoInk}
        onRedoInk={handleRedoInk}
        onClearInk={handleClearInk}
        background={page.background}
        onChangeBackground={(bg) => updatePage((prev) => ({ ...prev, background: bg }))}
        zoomScale={zoomScale}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onZoomReset={handleZoomReset}
        calculatorOpen={calculatorOpen}
        onToggleCalculator={() => setCalculatorOpen((v) => !v)}
        localRunnerConnected={localRunnerConnected}
        onOpenRunnerSettings={() => setRunnerModalOpen(true)}
        onOpenTutorial={() => setTutorialOpen(true)}
        onApplyTextPrefix={(prefix) => ensureSelectedTextContainer(prefix)}
        onWrapInline={handleWrapInline}
        onInsertTextBox={() => {
          const p = nextInsertPosition();
          insertContainer(createTextContainer(p.x, p.y, ''));
        }}
        onInsertMath={() => {
          const p = nextInsertPosition();
          insertContainer(createMathContainer(p.x, p.y));
        }}
        onInsertCodeCell={(lang) => {
          const p = nextInsertPosition();
          insertContainer(createCodeContainer(p.x, p.y, lang));
        }}
        onInsertDateTime={() => {
          const nowStr = new Date().toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
          ensureSelectedTextContainer(`📅 ${nowStr}`);
        }}
        onInsertTable={() =>
          ensureSelectedTextContainer('| 項目 | 内容 | 備考 |\n| --- | --- | --- |\n| 例1 |  |  |')
        }
        onInsertDivider={() => ensureSelectedTextContainer('---')}
      />

      {/* 自由配置キャンバス ＋ 直接ペン描画 SVG レイヤー（ズーム対応） */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto bg-slate-950/70">
          <div
            style={{
              width: Math.round(canvasWidth * zoomScale),
              height: Math.round(canvasHeight * zoomScale),
            }}
            className="relative"
          >
            <div
              ref={canvasRef}
              style={{
                width: canvasWidth,
                height: canvasHeight,
                transform: `scale(${zoomScale})`,
                transformOrigin: '0 0',
                ...backgroundStyle(page.background),
              }}
              onDoubleClick={handleCanvasDoubleClick}
              onContextMenu={(e) => handleCanvasContextMenu(e, null)}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                  setEditingTextId(null);
                  setEditingMathId(null);
                }
              }}
              className="relative select-none"
            >
              {/* 自由配置コンテナ群 */}
              {page.containers.map((c) => {
                const selected = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    style={{ left: c.x, top: c.y, width: c.width }}
                    onMouseDown={() => setSelectedId(c.id)}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      handleCanvasContextMenu(e, c.id);
                    }}
                    className={`absolute rounded-xl border bg-slate-900/90 shadow-lg backdrop-blur-sm transition-colors ${
                      selected
                        ? 'z-20 border-indigo-400/70 ring-1 ring-indigo-500/30'
                        : 'z-10 border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    {/* ドラッグ移動ヘッダー */}
                    <div
                      onPointerDown={(e) => startContainerDrag(e, c, 'move')}
                      onPointerMove={moveContainerDrag}
                      onPointerUp={endContainerDrag}
                      onPointerCancel={endContainerDrag}
                      onLostPointerCapture={endContainerDrag}
                      className="flex cursor-move items-center justify-between rounded-t-xl border-b border-slate-800/80 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-400"
                    >
                      <span className="flex items-center gap-1">
                        <GripHorizontal className="h-3 w-3 text-slate-500" />
                        {c.kind === 'text' ? 'テキスト' : c.kind === 'math' ? 'KaTeX 数式' : `コード (${c.language})`}
                      </span>
                      <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => duplicateContainer(c.id)}
                          className="rounded p-0.5 transition-colors hover:bg-slate-800 hover:text-cyan-300"
                          title="複製"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteContainer(c.id)}
                          className="rounded p-0.5 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
                          title="削除"
                        >
                          <Trash className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* コンテナ本体 */}
                    <div className="select-text p-2.5">
                      {c.kind === 'text' && (
                        <TextContainerBody
                          containerId={c.id}
                          text={c.text}
                          editing={editingTextId === c.id}
                          contextMenuOpen={Boolean(contextMenu?.textSelection?.containerId === c.id)}
                          onStartEdit={() => {
                            setSelectedId(c.id);
                            setEditingTextId(c.id);
                          }}
                          onStopEdit={() => setEditingTextId((cur) => (cur === c.id ? null : cur))}
                          onChangeText={(nextText) =>
                            updateContainer(c.id, (prev) =>
                              prev.kind === 'text' ? { ...prev, text: nextText } : prev,
                            )
                          }
                          onOpenTextContextMenu={(req) => {
                            const rect = canvasRef.current?.getBoundingClientRect();
                            setSelectedId(c.id);
                            setContextMenu({
                              clientX: req.clientX,
                              clientY: req.clientY,
                              canvasX: rect ? (req.clientX - rect.left) / zoomScale : c.x,
                              canvasY: rect ? (req.clientY - rect.top) / zoomScale : c.y,
                              containerId: c.id,
                              textSelection: {
                                containerId: c.id,
                                start: req.selectionStart,
                                end: req.selectionEnd,
                              },
                            });
                          }}
                          registerTextarea={registerTextarea}
                        />
                      )}

                      {c.kind === 'math' && (
                        <MathContainerBody
                          expr={c.expr}
                          editing={editingMathId === c.id}
                          onStartEdit={() => setEditingMathId(c.id)}
                          onStopEdit={() => setEditingMathId(null)}
                          onChangeExpr={(expr) =>
                            updateContainer(c.id, (prev) => (prev.kind === 'math' ? { ...prev, expr } : prev))
                          }
                        />
                      )}

                      {c.kind === 'code' && (
                        <CodeExecutionCell
                          language={c.language}
                          code={c.code}
                          fileName={c.fileName}
                          tabSizeOverride={codeTabSize}
                          autoClosePairs={codeAutoClosePairs}
                          onChangeCode={(code) =>
                            updateContainer(c.id, (prev) => (prev.kind === 'code' ? { ...prev, code } : prev))
                          }
                          onChangeLanguage={(language) =>
                            updateContainer(c.id, (prev) => (prev.kind === 'code' ? { ...prev, language } : prev))
                          }
                          onChangeFileName={(fileName) =>
                            updateContainer(c.id, (prev) => (prev.kind === 'code' ? { ...prev, fileName } : prev))
                          }
                          onOpenRunnerSettings={() => setRunnerModalOpen(true)}
                        />
                      )}
                    </div>

                    {/* 右下リサイズハンドル */}
                    <div
                      onPointerDown={(e) => startContainerDrag(e, c, 'resize')}
                      onPointerMove={moveContainerDrag}
                      onPointerUp={endContainerDrag}
                      onPointerCancel={endContainerDrag}
                      onLostPointerCapture={endContainerDrag}
                      title="ドラッグで幅をリサイズ"
                      className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-ew-resize rounded-br-xl border-b-2 border-r-2 border-slate-600/70 transition-colors hover:border-indigo-400"
                    />
                  </div>
                );
              })}

              {/* 透明 SVG 直接ペン描画レイヤー */}
              <svg
                onPointerDown={handleInkPointerDown}
                onPointerMove={handleInkPointerMove}
                onPointerUp={handleInkPointerUp}
                onPointerCancel={handleInkPointerUp}
                className={`absolute inset-0 z-30 h-full w-full touch-none ${
                  drawState.tool === 'select'
                    ? 'pointer-events-none'
                    : drawState.tool.startsWith('eraser')
                      ? 'pointer-events-auto cursor-cell'
                      : 'pointer-events-auto cursor-crosshair'
                }`}
              >
                {allStrokes.map((s) => {
                  const d = buildSvgPath(s.points);
                  const arrowD =
                    s.arrow && s.points.length >= 2
                      ? buildArrowHead(s.points[0], s.points[s.points.length - 1], Math.max(10, s.width * 3.5))
                      : '';
                  return (
                    <g
                      key={s.id}
                      style={{ mixBlendMode: s.tool === 'highlighter' ? 'screen' : 'normal' }}
                      opacity={s.opacity}
                    >
                      <path
                        d={d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={s.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {arrowD && (
                        <path
                          d={arrowD}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={s.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* キャンバス右下 ズームコントロール HUD */}
        <div className="pointer-events-auto absolute bottom-3 right-3 z-30 flex items-center overflow-hidden rounded-lg border border-slate-700/90 bg-slate-900/90 text-xs shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomScale <= MIN_ZOOM}
            className="px-2.5 py-1 font-mono font-bold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-40"
            title="縮小 (Ctrl + -)"
            aria-label="縮小"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="min-w-14 border-x border-slate-700/80 px-2 py-1 text-center font-mono text-[11px] font-semibold text-slate-100 transition-colors hover:bg-slate-800"
            title="100% にリセット (Ctrl + 0)"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomScale >= MAX_ZOOM}
            className="px-2.5 py-1 font-mono font-bold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-40"
            title="拡大 (Ctrl + +)"
            aria-label="拡大"
          >
            +
          </button>
        </div>
      </div>

      {/* 右クリック・コンテキストメニュー */}
      {contextMenu && (
        <EditorContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onInsertTextBox={(x, y) => insertContainer(createTextContainer(x, y, ''))}
          onInsertMath={(x, y) => insertContainer(createMathContainer(x, y))}
          onInsertCodeCell={(lang, x, y) => insertContainer(createCodeContainer(x, y, lang))}
          onOpenCalculator={() => setCalculatorOpen(true)}
          onDuplicateContainer={duplicateContainer}
          onDeleteContainer={deleteContainer}
          onApplyTextFormat={handleApplyTextFormat}
        />
      )}

      {/* 自然表示・関数電卓フローティングパネル */}
      {calculatorOpen && (
        <ScientificCalculatorModal
          onClose={() => setCalculatorOpen(false)}
          onInsertLatex={(latex) => {
            const p = nextInsertPosition();
            insertContainer(createMathContainer(p.x, p.y, latex));
          }}
        />
      )}

      {/* ローカルランナー接続設定モーダル */}
      {runnerModalOpen && <RunnerSettingsModal onClose={() => setRunnerModalOpen(false)} />}

      {/* 4ステップ使い方チュートリアル */}
      {tutorialOpen && <NotebookTutorialModal onClose={closeTutorial} />}
    </div>
  );
}

/** KaTeX 数式コンテナ本体（プレビュー＋記号パレット付きエディタ） */
function MathContainerBody({
  expr,
  editing,
  onStartEdit,
  onStopEdit,
  onChangeExpr,
}: {
  expr: string;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChangeExpr: (next: string) => void;
}) {
  const rendered = useMemo(() => renderKatexHtml(expr, true), [expr]);

  return (
    <div className="space-y-2">
      <div
        onClick={onStartEdit}
        className="min-h-[44px] cursor-pointer rounded-lg border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-center transition-colors hover:border-violet-500/40"
        title="クリックして数式を編集"
      >
        {rendered.html ? (
          <div className="overflow-x-auto overflow-y-hidden text-slate-100" dangerouslySetInnerHTML={{ __html: rendered.html }} />
        ) : (
          <span className="flex items-center justify-center gap-1 text-xs text-slate-500">
            <Sigma className="h-3.5 w-3.5" />
            クリックして数式を入力...
          </span>
        )}
      </div>

      {editing && (
        <div className="space-y-1.5 rounded-lg border border-violet-500/30 bg-slate-950/90 p-2">
          <div className="flex flex-wrap gap-1">
            {MATH_PALETTE.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onChangeExpr(`${expr}${expr ? ' ' : ''}${item.snippet}`)}
                className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700"
              >
                {item.label}
              </button>
            ))}
          </div>
          <textarea
            value={expr}
            onChange={(e) => onChangeExpr(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="LaTeX 数式を入力..."
            className="w-full resize-none rounded border border-slate-700 bg-slate-900 p-2 font-mono text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
          />
          {rendered.error && <div className="text-[10px] text-rose-400">{rendered.error}</div>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onStopEdit}
              className="rounded bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-500"
            >
              完了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
