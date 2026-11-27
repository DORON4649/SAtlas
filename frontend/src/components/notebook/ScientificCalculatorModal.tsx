import { useMemo, useRef, useState } from 'react';
import { Calculator, GripHorizontal, Sigma, Trash, X } from 'lucide-react';
import { renderKatexHtml } from '../../lib/oneNoteModel';
import { evaluateScientific, type AngleUnit } from '../../lib/scientificCalc';

interface Props {
  onClose: () => void;
  onInsertLatex: (latex: string) => void;
}

interface HistoryItem {
  expr: string;
  result: string;
  latexFull: string;
}

const KEY_ROWS: { label: string; insert: string; accent?: boolean }[][] = [
  [
    { label: 'sin', insert: 'sin(' },
    { label: 'cos', insert: 'cos(' },
    { label: 'tan', insert: 'tan(' },
    { label: 'sin⁻¹', insert: 'asin(' },
    { label: 'cos⁻¹', insert: 'acos(' },
    { label: 'tan⁻¹', insert: 'atan(' },
  ],
  [
    { label: 'ln', insert: 'ln(' },
    { label: 'log₁₀', insert: 'log10(' },
    { label: 'e^x', insert: 'exp(' },
    { label: '√', insert: 'sqrt(' },
    { label: 'x^y', insert: '^' },
    { label: 'n!', insert: '!' },
  ],
  [
    { label: 'nPr', insert: 'nPr(' },
    { label: 'nCr', insert: 'nCr(' },
    { label: 'π', insert: 'pi' },
    { label: 'e', insert: 'e' },
    { label: '(', insert: '(' },
    { label: ')', insert: ')' },
  ],
  [
    { label: '7', insert: '7' },
    { label: '8', insert: '8' },
    { label: '9', insert: '9' },
    { label: '÷', insert: '/' },
    { label: ',', insert: ',' },
    { label: 'AC', insert: '__CLEAR__', accent: true },
  ],
  [
    { label: '4', insert: '4' },
    { label: '5', insert: '5' },
    { label: '6', insert: '6' },
    { label: '×', insert: '*' },
    { label: '1/x', insert: '1/(' },
    { label: '⌫', insert: '__BS__', accent: true },
  ],
  [
    { label: '1', insert: '1' },
    { label: '2', insert: '2' },
    { label: '3', insert: '3' },
    { label: '−', insert: '-' },
    { label: '0', insert: '0' },
    { label: '.', insert: '.' },
  ],
];

/**
 * ドラッグ移動可能な自然表示（KaTeX）関数電卓フローティングパネル。
 */
export default function ScientificCalculatorModal({ onClose, onInsertLatex }: Props) {
  const [expr, setExpr] = useState('sin(pi/6) + sqrt(9)/2');
  const [angleUnit, setAngleUnit] = useState<AngleUnit>('RAD');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pos, setPos] = useState({ x: 80, y: 96 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const evalRes = useMemo(() => evaluateScientific(expr, angleUnit), [expr, angleUnit]);
  const preview = useMemo(
    () => renderKatexHtml(evalRes.ok && evalRes.formatted ? evalRes.latexFull : evalRes.latexExpr, true),
    [evalRes],
  );

  const handleKey = (token: string) => {
    if (token === '__CLEAR__') {
      setExpr('');
      return;
    }
    if (token === '__BS__') {
      setExpr((prev) => prev.slice(0, -1));
      return;
    }
    setExpr((prev) => prev + token);
  };

  const commitHistory = () => {
    if (!evalRes.ok || !evalRes.formatted || !expr.trim()) return;
    setHistory((prev) => [{ expr: expr.trim(), result: evalRes.formatted, latexFull: evalRes.latexFull }, ...prev].slice(0, 10));
  };

  const handleInsert = () => {
    const latex = evalRes.ok && evalRes.formatted ? evalRes.latexFull : evalRes.latexExpr;
    if (!latex.trim()) return;
    commitHistory();
    onInsertLatex(latex);
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };

  const onDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if ((e.buttons & 1) === 0) {
      dragRef.current = null;
      return;
    }
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - 360, drag.origX + dx)),
      y: Math.max(56, Math.min(window.innerHeight - 120, drag.origY + dy)),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-40 flex w-[360px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur"
    >
      {/* ドラッグハンドル付きヘッダー */}
      <div
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        className="flex cursor-move select-none items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3 py-2"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
          <GripHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <Calculator className="h-3.5 w-3.5 text-amber-400" />
          自然表示・関数電卓
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setAngleUnit((u) => (u === 'RAD' ? 'DEG' : 'RAD'))}
            className="rounded border border-indigo-500/40 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/30"
          >
            {angleUnit}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2.5 p-3 text-xs">
        {/* KaTeX 自然表示プレビュー */}
        <div className="min-h-16 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
          {preview.html ? (
            <div
              className="overflow-x-auto text-center text-slate-100"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <div className="py-3 text-center text-[11px] text-slate-500">数式を入力してください</div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-slate-800/80 pt-1 font-mono text-[11px]">
            {evalRes.ok ? (
              <span className="ml-auto font-bold text-emerald-300">
                {evalRes.formatted ? `= ${evalRes.formatted}` : ''}
              </span>
            ) : (
              <span className="text-rose-400">{evalRes.error}</span>
            )}
          </div>
        </div>

        {/* 進数変換 (整数値の場合) */}
        {evalRes.bases && (
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 font-mono text-[10px] text-slate-300">
            <div className="truncate" title={evalRes.bases.dec}>
              <span className="text-slate-500">DEC </span>
              {evalRes.bases.dec}
            </div>
            <div className="truncate" title={evalRes.bases.hex}>
              <span className="text-amber-400">HEX </span>
              {evalRes.bases.hex}
            </div>
            <div className="truncate" title={evalRes.bases.bin}>
              <span className="text-cyan-400">BIN </span>
              {evalRes.bases.bin}
            </div>
          </div>
        )}

        {/* 式テキスト入力 */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitHistory();
              }
            }}
            placeholder="例: nCr(10,3), sin(30), sqrt(2)^2"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => handleKey('+')}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 font-mono text-xs text-slate-200 hover:bg-slate-700"
          >
            +
          </button>
          <button
            type="button"
            onClick={commitHistory}
            className="rounded-lg bg-indigo-600 px-2.5 font-mono text-xs font-bold text-white hover:bg-indigo-500"
            title="履歴に記録"
          >
            =
          </button>
        </div>

        {/* キーパッド */}
        <div className="space-y-1">
          {KEY_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-6 gap-1">
              {row.map((k) => (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => handleKey(k.insert)}
                  className={`rounded-md py-1.5 text-[11px] font-medium transition ${
                    k.accent
                      ? 'border border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                      : 'border border-slate-700/80 bg-slate-800/80 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ノートへ数式として挿入ボタン */}
        <button
          type="button"
          disabled={!evalRes.latexExpr}
          onClick={handleInsert}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 py-2 text-xs font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-40"
        >
          <Sigma className="h-4 w-4" />
          ノートへ数式として挿入
        </button>

        {/* 計算履歴 */}
        {history.length > 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
              <span>計算履歴</span>
              <button
                type="button"
                onClick={() => setHistory([])}
                className="flex items-center gap-0.5 hover:text-rose-300"
              >
                <Trash className="h-2.5 w-2.5" />
                消去
              </button>
            </div>
            <div className="max-h-20 space-y-1 overflow-y-auto font-mono text-[10px]">
              {history.map((h, i) => (
                <button
                  key={`${h.expr}-${i}`}
                  type="button"
                  onClick={() => setExpr(h.expr)}
                  className="flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-slate-300 hover:bg-slate-800"
                >
                  <span className="truncate">{h.expr}</span>
                  <span className="ml-2 shrink-0 text-emerald-300">= {h.result}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
