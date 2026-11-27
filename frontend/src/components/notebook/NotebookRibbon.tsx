import { useState } from 'react';
import {
  BookOpen,
  Calculator,
  CalendarClock,
  Code,
  Eraser,
  Grid3x3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  MousePointer2,
  Pen,
  Plug,
  PlugZap,
  Redo2,
  Rows3,
  Sigma,
  Square,
  SquareCheck,
  Star,
  Table,
  Trash,
  Type,
  Undo2,
} from 'lucide-react';
import type { CodeBlockLanguage } from '../../lib/codeHighlight';
import type { PageBackground } from '../../lib/oneNoteModel';

export type RibbonTab = 'home' | 'insert' | 'draw' | 'view';
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser-stroke' | 'eraser-partial';

export interface DrawState {
  tool: DrawTool;
  color: string;
  width: number;
  recentColors: string[];
}

const PEN_COLOR_PRESETS = [
  { label: '黒', value: '#1e293b' },
  { label: '白', value: '#f8fafc' },
  { label: '赤', value: '#ef4444' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22c55e' },
  { label: 'オレンジ', value: '#f97316' },
  { label: '紫', value: '#a855f7' },
] as const;

const HIGHLIGHTER_COLOR_PRESETS = [
  { label: 'イエロー', value: '#fde047' },
  { label: 'ピンク', value: '#f472b6' },
  { label: 'シアン', value: '#22d3ee' },
  { label: 'ライム', value: '#a3e635' },
] as const;

interface Props {
  drawState: DrawState;
  onChangeDrawState: (next: DrawState) => void;
  canUndoInk: boolean;
  canRedoInk: boolean;
  onUndoInk: () => void;
  onRedoInk: () => void;
  onClearInk: () => void;
  background: PageBackground;
  onChangeBackground: (bg: PageBackground) => void;
  zoomScale: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
  calculatorOpen: boolean;
  onToggleCalculator: () => void;
  localRunnerConnected: boolean;
  onOpenRunnerSettings: () => void;
  onOpenTutorial: () => void;
  // ホーム操作
  onApplyTextPrefix: (prefix: string) => void;
  onWrapInline: (prefix: string, suffix: string, placeholder: string) => void;
  // 挿入操作
  onInsertTextBox: () => void;
  onInsertMath: () => void;
  onInsertCodeCell: (lang: CodeBlockLanguage) => void;
  onInsertDateTime: () => void;
  onInsertTable: () => void;
  onInsertDivider: () => void;
}

const btnCls =
  'flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-40';

const activeBtnCls =
  'flex items-center gap-1 rounded-md border border-indigo-400/60 bg-indigo-600/30 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition-colors';

/** Office / OneNote 風 4 タブリボンバー */
export default function NotebookRibbon({
  drawState,
  onChangeDrawState,
  canUndoInk,
  canRedoInk,
  onUndoInk,
  onRedoInk,
  onClearInk,
  background,
  onChangeBackground,
  zoomScale,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  calculatorOpen,
  onToggleCalculator,
  localRunnerConnected,
  onOpenRunnerSettings,
  onOpenTutorial,
  onApplyTextPrefix,
  onWrapInline,
  onInsertTextBox,
  onInsertMath,
  onInsertCodeCell,
  onInsertDateTime,
  onInsertTable,
  onInsertDivider,
}: Props) {
  const [tab, setTab] = useState<RibbonTab>('home');

  const pickColor = (hex: string) => {
    const recent = [hex, ...drawState.recentColors.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 6);
    onChangeDrawState({ ...drawState, color: hex, recentColors: recent });
  };

  const selectDrawTool = (tool: DrawTool) => {
    if (tool === 'highlighter') {
      const isHlPreset = HIGHLIGHTER_COLOR_PRESETS.some((c) => c.value === drawState.color);
      onChangeDrawState({
        ...drawState,
        tool,
        color: isHlPreset ? drawState.color : HIGHLIGHTER_COLOR_PRESETS[0].value,
        width: Math.max(drawState.width, 14),
      });
    } else if (tool === 'pen') {
      onChangeDrawState({
        ...drawState,
        tool,
        width: drawState.width > 12 ? 3 : drawState.width,
      });
    } else {
      onChangeDrawState({ ...drawState, tool });
    }
  };

  return (
    <div className="border-b border-slate-800 bg-slate-900/95">
      {/* タブ見出し */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3">
        <div className="flex items-center gap-1">
          {(
            [
              ['home', 'ホーム'],
              ['insert', '挿入'],
              ['draw', '描画'],
              ['view', '表示・ツール'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${tab === id
                  ? 'border-indigo-400 text-indigo-200'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              {label}
              {id === 'draw' && drawState.tool !== 'select' && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          ))}
        </div>

        {/* 常時アクセスできる選択/ペン簡易切替 */}
        <div className="flex items-center gap-1.5 py-1 text-[11px]">
          <button
            type="button"
            onClick={() => selectDrawTool(drawState.tool === 'select' ? 'pen' : 'select')}
            className={drawState.tool === 'select' ? btnCls : activeBtnCls}
            title="テキスト選択 / ペン描画の切替"
          >
            {drawState.tool === 'select' ? (
              <>
                <Pen className="h-3 w-3 text-cyan-300" />
                ペンで描く
              </>
            ) : (
              <>
                <MousePointer2 className="h-3 w-3 text-cyan-300" />
                選択モードへ戻る
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleCalculator}
            className={calculatorOpen ? activeBtnCls : btnCls}
            title="自然表示・関数電卓パネル"
          >
            <Calculator className="h-3 w-3 text-amber-300" />
            <span className="hidden sm:inline">関数電卓</span>
          </button>
        </div>
      </div>

      {/* タブ別ツールバー */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {tab === 'home' && (
          <>
            <button type="button" onClick={() => onApplyTextPrefix('# ')} className={btnCls} title="見出し1">
              <Heading1 className="h-3.5 w-3.5 text-indigo-300" />
              H1
            </button>
            <button type="button" onClick={() => onApplyTextPrefix('## ')} className={btnCls} title="見出し2">
              <Heading2 className="h-3.5 w-3.5 text-indigo-300" />
              H2
            </button>
            <button type="button" onClick={() => onApplyTextPrefix('### ')} className={btnCls} title="見出し3">
              <Heading3 className="h-3.5 w-3.5 text-indigo-300" />
              H3
            </button>
            <div className="mx-1 h-5 w-px bg-slate-800" />
            <button
              type="button"
              onClick={() => onWrapInline('**', '**', '太字')}
              className={btnCls}
              title="太字"
            >
              <span className="font-bold">B</span>
              太字
            </button>
            <button
              type="button"
              onClick={() => onWrapInline('*', '*', '斜体')}
              className={btnCls}
              title="斜体"
            >
              <Italic className="h-3.5 w-3.5" />
              斜体
            </button>
            <div className="mx-1 h-5 w-px bg-slate-800" />
            <button type="button" onClick={() => onApplyTextPrefix('- ')} className={btnCls}>
              <List className="h-3.5 w-3.5 text-sky-300" />
              箇条書き
            </button>
            <button type="button" onClick={() => onApplyTextPrefix('1. ')} className={btnCls}>
              <ListOrdered className="h-3.5 w-3.5 text-sky-300" />
              番号リスト
            </button>
            <button type="button" onClick={() => onApplyTextPrefix('- [ ] ')} className={btnCls}>
              <SquareCheck className="h-3.5 w-3.5 text-emerald-300" />
              ToDo
            </button>
            <button type="button" onClick={() => onApplyTextPrefix('★ 重要：')} className={btnCls}>
              <Star className="h-3.5 w-3.5 text-amber-400" />
              重要マーク
            </button>
          </>
        )}

        {tab === 'insert' && (
          <>
            <button type="button" onClick={onInsertTextBox} className={btnCls}>
              <Type className="h-3.5 w-3.5 text-sky-300" />
              テキストボックス
            </button>
            <button type="button" onClick={onInsertMath} className={btnCls}>
              <Sigma className="h-3.5 w-3.5 text-violet-300" />
              数式ブロック (KaTeX)
            </button>
            <div className="mx-1 h-5 w-px bg-slate-800" />
            <button type="button" onClick={() => onInsertCodeCell('python')} className={btnCls}>
              <Code className="h-3.5 w-3.5 text-amber-300" />
              Pythonセル
            </button>
            <button type="button" onClick={() => onInsertCodeCell('java')} className={btnCls}>
              <Code className="h-3.5 w-3.5 text-orange-300" />
              Javaセル
            </button>
            <button type="button" onClick={() => onInsertCodeCell('c')} className={btnCls}>
              <Code className="h-3.5 w-3.5 text-sky-300" />
              Cセル
            </button>
            <button
              type="button"
              onClick={() => onInsertCodeCell('typescript')}
              className={btnCls}
              title="VS Code 風 多言語コードブロック（TS / JS / C++ / Rust / Go / SQL 等）"
            >
              <Code className="h-3.5 w-3.5 text-indigo-300" />
              コードブロック（多言語）
            </button>
            <div className="mx-1 h-5 w-px bg-slate-800" />
            <button type="button" onClick={onInsertDateTime} className={btnCls}>
              <CalendarClock className="h-3.5 w-3.5 text-emerald-300" />
              日付と時刻
            </button>
            <button type="button" onClick={onInsertTable} className={btnCls}>
              <Table className="h-3.5 w-3.5 text-cyan-300" />
              表
            </button>
            <button type="button" onClick={onInsertDivider} className={btnCls}>
              <Minus className="h-3.5 w-3.5 text-slate-400" />
              区切り線
            </button>
          </>
        )}

        {tab === 'draw' && (
          <>
            {/* ツール選択 */}
            <button
              type="button"
              onClick={() => selectDrawTool('select')}
              className={drawState.tool === 'select' ? activeBtnCls : btnCls}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
              選択
            </button>
            <button
              type="button"
              onClick={() => selectDrawTool('pen')}
              className={drawState.tool === 'pen' ? activeBtnCls : btnCls}
              title="ボールペン（不透明度 100%・Shiftで直線矢印）"
            >
              <Pen className="h-3.5 w-3.5 text-cyan-300" />
              ボールペン
            </button>
            <button
              type="button"
              onClick={() => selectDrawTool('highlighter')}
              className={drawState.tool === 'highlighter' ? activeBtnCls : btnCls}
              title="蛍光マーカー（不透明度 40%・文字が透ける）"
            >
              <Highlighter className="h-3.5 w-3.5 text-yellow-300" />
              蛍光マーカー
            </button>
            <button
              type="button"
              onClick={() => selectDrawTool('eraser-stroke')}
              className={drawState.tool === 'eraser-stroke' ? activeBtnCls : btnCls}
              title="ストローク単位で消去"
            >
              <Eraser className="h-3.5 w-3.5 text-rose-300" />
              ストローク消し
            </button>
            <button
              type="button"
              onClick={() => selectDrawTool('eraser-partial')}
              className={drawState.tool === 'eraser-partial' ? activeBtnCls : btnCls}
              title="触れた部分だけ消去"
            >
              <Eraser className="h-3.5 w-3.5 text-amber-300" />
              部分消し
            </button>

            <div className="mx-1 h-5 w-px bg-slate-800" />

            {/* 基本色 & 蛍光色パレット */}
            <div className="flex items-center gap-1" title="基本色">
              {PEN_COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={`ペン色: ${c.label}`}
                  onClick={() => pickColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`h-4 w-4 rounded-full border border-slate-600 transition-opacity ${drawState.color.toLowerCase() === c.value.toLowerCase()
                      ? 'ring-2 ring-indigo-400'
                      : 'opacity-80 hover:opacity-100'
                    }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 border-l border-slate-800 pl-1.5" title="蛍光マーカー色">
              {HIGHLIGHTER_COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={`蛍光色: ${c.label}`}
                  onClick={() => pickColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`h-4 w-4 rounded-sm border border-slate-600 transition-opacity ${drawState.color.toLowerCase() === c.value.toLowerCase()
                      ? 'ring-2 ring-white'
                      : 'opacity-85 hover:opacity-100'
                    }`}
                />
              ))}
            </div>

            {/* カスタムカラーピッカー */}
            <label
              className="flex cursor-pointer items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
              title="任意の HEX カラーを選択"
            >
              <span>HEX</span>
              <input
                type="color"
                value={drawState.color}
                onChange={(e) => pickColor(e.target.value)}
                className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>

            {/* 最近使った色履歴 */}
            {drawState.recentColors.length > 0 && (
              <div className="flex items-center gap-1 border-l border-slate-800 pl-1.5" title="最近使った色">
                <span className="text-[10px] text-slate-500">履歴</span>
                {drawState.recentColors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => pickColor(hex)}
                    style={{ backgroundColor: hex }}
                    className="h-3.5 w-3.5 rounded-full border border-slate-600"
                    title={hex}
                  />
                ))}
              </div>
            )}

            <div className="mx-1 h-5 w-px bg-slate-800" />

            {/* 太さスライダー */}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span>太さ {drawState.width}px</span>
              <input
                type="range"
                min={1}
                max={24}
                value={drawState.width}
                onChange={(e) => onChangeDrawState({ ...drawState, width: Number(e.target.value) })}
                className="w-20 accent-indigo-500"
              />
            </label>

            <div className="mx-1 h-5 w-px bg-slate-800" />

            <button type="button" onClick={onUndoInk} disabled={!canUndoInk} className={btnCls} title="1手戻す">
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onRedoInk} disabled={!canRedoInk} className={btnCls} title="やり直す">
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClearInk} className={btnCls} title="手書きを全消去">
              <Trash className="h-3.5 w-3.5 text-rose-300" />
              全消去
            </button>
            <span className="ml-auto hidden text-[10px] text-slate-500 xl:inline">
              Shift押下で直線・矢印にスナップ
            </span>
          </>
        )}

        {tab === 'view' && (
          <>
            <span className="text-[11px] text-slate-400">背景:</span>
            <button
              type="button"
              onClick={() => onChangeBackground('blank')}
              className={background === 'blank' ? activeBtnCls : btnCls}
            >
              <Square className="h-3.5 w-3.5" />
              無地
            </button>
            <button
              type="button"
              onClick={() => onChangeBackground('ruled')}
              className={background === 'ruled' ? activeBtnCls : btnCls}
            >
              <Rows3 className="h-3.5 w-3.5" />
              横罫線
            </button>
            <button
              type="button"
              onClick={() => onChangeBackground('grid')}
              className={background === 'grid' ? activeBtnCls : btnCls}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              5mm方眼
            </button>

            <div className="mx-1 h-5 w-px bg-slate-800" />

            {/* ズームコントロール */}
            <div className="flex items-center overflow-hidden rounded-md border border-slate-700/80 bg-slate-800/80 text-[11px]">
              <button
                type="button"
                onClick={onZoomOut}
                disabled={zoomScale <= 0.25}
                className="px-2 py-1 font-mono font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-40"
                title="縮小 (Ctrl + -)"
              >
                -
              </button>
              <button
                type="button"
                onClick={onZoomReset}
                className="min-w-12 border-x border-slate-700/80 px-2 py-1 text-center font-mono text-slate-100 transition-colors hover:bg-slate-700"
                title="100% にリセット (Ctrl + 0)"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                type="button"
                onClick={onZoomIn}
                disabled={zoomScale >= 3.0}
                className="px-2 py-1 font-mono font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-40"
                title="拡大 (Ctrl + +)"
              >
                +
              </button>
            </div>

            <div className="mx-1 h-5 w-px bg-slate-800" />

            <button
              type="button"
              onClick={onToggleCalculator}
              className={calculatorOpen ? activeBtnCls : btnCls}
            >
              <Calculator className="h-3.5 w-3.5 text-amber-300" />
              自然表示・関数電卓
            </button>

            <button type="button" onClick={onOpenRunnerSettings} className={btnCls}>
              {localRunnerConnected ? (
                <PlugZap className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Plug className="h-3.5 w-3.5 text-cyan-400" />
              )}
              ローカルランナー設定
            </button>

            <button type="button" onClick={onOpenTutorial} className={btnCls}>
              <BookOpen className="h-3.5 w-3.5 text-indigo-300" />
              使い方ガイド
            </button>
          </>
        )}
      </div>
    </div>
  );
}
