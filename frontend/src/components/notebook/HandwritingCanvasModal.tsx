import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eraser, Grid3X3, PenTool, RotateCcw, Trash2, X } from 'lucide-react';

type BackgroundPattern = 'plain' | 'grid' | 'ruled';

interface Stroke {
  color: string;
  width: number;
  eraser: boolean;
  points: { x: number; y: number }[];
}

interface Props {
  onClose: () => void;
  onInsert: (dataUrl: string, caption: string) => void;
}

const PEN_COLORS: { label: string; value: string; dotClass: string }[] = [
  { label: '黒', value: '#0f172a', dotClass: 'bg-slate-900 border-slate-400' },
  { label: '赤', value: '#dc2626', dotClass: 'bg-red-600 border-red-300' },
  { label: '青', value: '#2563eb', dotClass: 'bg-blue-600 border-blue-300' },
  { label: '緑', value: '#16a34a', dotClass: 'bg-green-600 border-green-300' },
];

const PEN_WIDTHS = [
  { label: '細', value: 2 },
  { label: '中', value: 4 },
  { label: '太', value: 8 },
];

const CANVAS_W = 860;
const CANVAS_H = 440;

function drawBackground(ctx: CanvasRenderingContext2D, pattern: BackgroundPattern) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (pattern === 'plain') return;

  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  const step = 28;

  if (pattern === 'grid') {
    for (let x = step; x < CANVAS_W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, CANVAS_H);
      ctx.stroke();
    }
    for (let y = step; y < CANVAS_H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(CANVAS_W, y + 0.5);
      ctx.stroke();
    }
  } else if (pattern === 'ruled') {
    for (let y = 36; y < CANVAS_H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(CANVAS_W, y + 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    ctx.strokeStyle = s.eraser ? '#ffffff' : s.color;
    ctx.lineWidth = s.eraser ? s.width * 3 : s.width;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    if (s.points.length === 1) {
      ctx.lineTo(s.points[0].x + 0.1, s.points[0].y + 0.1);
    } else {
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** HTML5 Canvas + Pointer Events による手書き図解モーダル */
export default function HandwritingCanvasModal({ onClose, onInsert }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState('#0f172a');
  const [width, setWidth] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [pattern, setPattern] = useState<BackgroundPattern>('grid');
  const [caption, setCaption] = useState('手書き図解');

  const redraw = useCallback(
    (list: Stroke[], liveStroke: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawBackground(ctx, pattern);
      drawStrokes(ctx, liveStroke ? [...list, liveStroke] : list);
    },
    [pattern],
  );

  useEffect(() => {
    redraw(strokes, activeStrokeRef.current);
  }, [strokes, redraw]);

  const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toCanvasPoint(e);
    activeStrokeRef.current = {
      color,
      width,
      eraser,
      points: [pt],
    };
    redraw(strokes, activeStrokeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current.points.push(toCanvasPoint(e));
    redraw(strokes, activeStrokeRef.current);
  };

  const finishStroke = () => {
    if (!activeStrokeRef.current) return;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redraw(strokes, null);
    const dataUrl = canvas.toDataURL('image/png');
    onInsert(dataUrl, caption.trim() || '手書き図解');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">手書きキャンバス</h3>
            <span className="text-[11px] text-slate-400">（マウス・タッチ・ペン対応）</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ツールバー */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* ペン色 */}
            <div className="flex items-center gap-1">
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setColor(c.value);
                    setEraser(false);
                  }}
                  className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                    !eraser && color === c.value
                      ? 'border-blue-400 bg-blue-500/20 text-white'
                      : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full border ${c.dotClass}`} />
                  {c.label}
                </button>
              ))}
            </div>

            {/* 消しゴム */}
            <button
              type="button"
              onClick={() => setEraser((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                eraser
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              消しゴム
            </button>

            {/* 太さ */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5">
              {PEN_WIDTHS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setWidth(w.value)}
                  className={`rounded-md px-2 py-0.5 text-[11px] transition ${
                    width === w.value ? 'bg-slate-700 font-semibold text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {/* 背景グリッド切替 */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-0.5">
              <Grid3X3 className="ml-1.5 h-3.5 w-3.5 text-slate-500" />
              {(
                [
                  { id: 'plain', label: '無地' },
                  { id: 'grid', label: '方眼' },
                  { id: 'ruled', label: '罫線' },
                ] as const
              ).map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setPattern(bg.id)}
                  className={`rounded-md px-2 py-0.5 text-[11px] transition ${
                    pattern === bg.id ? 'bg-slate-700 font-semibold text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              戻す
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              全消去
            </button>
          </div>
        </div>

        {/* キャンバス本体 */}
        <div className="flex items-center justify-center bg-slate-950 p-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            style={{ touchAction: 'none' }}
            className="w-full max-w-[860px] cursor-crosshair rounded-xl border border-slate-700 bg-white shadow-inner"
          />
        </div>

        {/* フッター */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="図解のキャプション（例: ベクトル分解の図）"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Check className="h-3.5 w-3.5" />
              ノートに挿入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
