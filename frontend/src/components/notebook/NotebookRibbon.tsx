import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  CalendarPlus,
  CheckSquare,
  Code,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Italic,
  LayoutTemplate,
  List,
  ListOrdered,
  Minus,
  PenTool,
  Plug,
  Quote,
  Sigma,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { CodeLanguage } from '../../lib/codeRunner';

export type RibbonTab = 'home' | 'insert' | 'view';
export type WorkspaceViewMode = 'visual' | 'markdown';

interface Props {
  viewMode: WorkspaceViewMode;
  hasSelection: boolean;
  localRunnerConnected: boolean;
  onChangeViewMode: (mode: WorkspaceViewMode) => void;
  // ホーム操作
  onFormatBlock: (
    target: 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet-list' | 'ordered-list' | 'checklist' | 'quote',
  ) => void;
  onWrapInline: (prefix: string, suffix: string, placeholder: string) => void;
  onMoveBlockUp: () => void;
  onMoveBlockDown: () => void;
  onDeleteBlock: () => void;
  // 挿入操作
  onInsertMath: () => void;
  onInsertCodeCell: (lang: CodeLanguage) => void;
  onOpenHandwriting: () => void;
  onInsertDivider: () => void;
  onInsertLectureHeader: () => void;
  // 表示・ツール
  onOpenRunnerSettings: () => void;
  onOpenTutorial: () => void;
}

function RibbonButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  tone = 'default',
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: 'default' | 'cyan' | 'amber' | 'orange' | 'sky' | 'rose' | 'emerald';
  title?: string;
}) {
  const toneClass = active
    ? 'border-blue-500/50 bg-blue-600/25 text-blue-100'
    : tone === 'cyan'
      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
      : tone === 'amber'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
        : tone === 'orange'
          ? 'border-orange-500/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20'
          : tone === 'sky'
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
            : tone === 'rose'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
              : tone === 'emerald'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                : 'border-slate-700/80 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80 hover:text-white';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      <span className="flex h-4 items-center justify-center">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/** Office 風タブ切替式リボンバー（ホーム / 挿入 / 表示・ツール） */
export default function NotebookRibbon({
  viewMode,
  hasSelection,
  localRunnerConnected,
  onChangeViewMode,
  onFormatBlock,
  onWrapInline,
  onMoveBlockUp,
  onMoveBlockDown,
  onDeleteBlock,
  onInsertMath,
  onInsertCodeCell,
  onOpenHandwriting,
  onInsertDivider,
  onInsertLectureHeader,
  onOpenRunnerSettings,
  onOpenTutorial,
}: Props) {
  const [tab, setTab] = useState<RibbonTab>('home');

  return (
    <div className="border-b border-slate-800 bg-slate-950/60">
      {/* タブ見出し行 */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 pt-1.5">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'home', label: 'ホーム' },
              { id: 'insert', label: '挿入' },
              { id: 'view', label: '表示・ツール' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-t-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                tab === item.id
                  ? 'border border-b-0 border-slate-700 bg-slate-900 text-cyan-300'
                  : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 pb-1 text-[10px] text-slate-400 sm:flex">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              localRunnerConnected
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${localRunnerConnected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {localRunnerConnected ? 'Local PC 接続中' : 'Browser WASM 待機'}
          </span>
          <span className="text-slate-500">右クリックでメニュー</span>
        </div>
      </div>

      {/* タブ内容行 */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/70 px-3 py-2">
        {tab === 'home' && (
          <>
            <div className="flex items-center gap-1">
              <RibbonButton
                icon={<Heading1 className="h-3.5 w-3.5" />}
                label="見出し1"
                onClick={() => onFormatBlock('h1')}
              />
              <RibbonButton
                icon={<Heading2 className="h-3.5 w-3.5" />}
                label="見出し2"
                onClick={() => onFormatBlock('h2')}
              />
              <RibbonButton
                icon={<Heading3 className="h-3.5 w-3.5" />}
                label="見出し3"
                onClick={() => onFormatBlock('h3')}
              />
            </div>

            <span className="mx-0.5 h-8 w-px bg-slate-800" />

            <div className="flex items-center gap-1">
              <RibbonButton
                icon={<Bold className="h-3.5 w-3.5" />}
                label="太字"
                onClick={() => onWrapInline('**', '**', '強調テキスト')}
              />
              <RibbonButton
                icon={<Italic className="h-3.5 w-3.5" />}
                label="斜体"
                onClick={() => onWrapInline('*', '*', '斜体テキスト')}
              />
            </div>

            <span className="mx-0.5 h-8 w-px bg-slate-800" />

            <div className="flex items-center gap-1">
              <RibbonButton
                icon={<List className="h-3.5 w-3.5" />}
                label="箇条書き"
                onClick={() => onFormatBlock('bullet-list')}
              />
              <RibbonButton
                icon={<ListOrdered className="h-3.5 w-3.5" />}
                label="番号リスト"
                onClick={() => onFormatBlock('ordered-list')}
              />
              <RibbonButton
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                label="チェック"
                onClick={() => onFormatBlock('checklist')}
              />
              <RibbonButton
                icon={<Quote className="h-3.5 w-3.5" />}
                label="引用"
                onClick={() => onFormatBlock('quote')}
              />
            </div>

            <span className="mx-0.5 h-8 w-px bg-slate-800" />

            <div className="flex items-center gap-1">
              <RibbonButton
                icon={<ArrowUp className="h-3.5 w-3.5" />}
                label="上へ"
                disabled={viewMode !== 'visual' || !hasSelection}
                onClick={onMoveBlockUp}
              />
              <RibbonButton
                icon={<ArrowDown className="h-3.5 w-3.5" />}
                label="下へ"
                disabled={viewMode !== 'visual' || !hasSelection}
                onClick={onMoveBlockDown}
              />
              <RibbonButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="ブロック削除"
                tone="rose"
                disabled={viewMode !== 'visual' || !hasSelection}
                onClick={onDeleteBlock}
              />
            </div>
          </>
        )}

        {tab === 'insert' && (
          <>
            <RibbonButton
              icon={<Sigma className="h-3.5 w-3.5" />}
              label="数式 (KaTeX)"
              tone="cyan"
              onClick={onInsertMath}
            />
            <span className="mx-0.5 h-8 w-px bg-slate-800" />
            <RibbonButton
              icon={<Terminal className="h-3.5 w-3.5" />}
              label="Python セル"
              tone="amber"
              onClick={() => onInsertCodeCell('python')}
            />
            <RibbonButton
              icon={<Terminal className="h-3.5 w-3.5" />}
              label="Java セル"
              tone="orange"
              onClick={() => onInsertCodeCell('java')}
            />
            <RibbonButton
              icon={<Terminal className="h-3.5 w-3.5" />}
              label="C セル"
              tone="sky"
              onClick={() => onInsertCodeCell('c')}
            />
            <span className="mx-0.5 h-8 w-px bg-slate-800" />
            <RibbonButton
              icon={<PenTool className="h-3.5 w-3.5" />}
              label="手書きキャンバス"
              tone="emerald"
              onClick={onOpenHandwriting}
            />
            <RibbonButton
              icon={<Minus className="h-3.5 w-3.5" />}
              label="区切り線"
              onClick={onInsertDivider}
            />
            <RibbonButton
              icon={<CalendarPlus className="h-3.5 w-3.5" />}
              label="講義ヘッダー"
              onClick={onInsertLectureHeader}
            />
          </>
        )}

        {tab === 'view' && (
          <>
            <RibbonButton
              icon={<LayoutTemplate className="h-3.5 w-3.5" />}
              label="ビジュアル編集"
              active={viewMode === 'visual'}
              onClick={() => onChangeViewMode('visual')}
            />
            <RibbonButton
              icon={<FileCode2 className="h-3.5 w-3.5" />}
              label="Markdown ソース"
              active={viewMode === 'markdown'}
              onClick={() => onChangeViewMode('markdown')}
            />
            <span className="mx-0.5 h-8 w-px bg-slate-800" />
            <RibbonButton
              icon={<Plug className="h-3.5 w-3.5" />}
              label="ランナー接続設定"
              tone={localRunnerConnected ? 'emerald' : 'cyan'}
              onClick={onOpenRunnerSettings}
            />
            <RibbonButton
              icon={<Code className="h-3.5 w-3.5" />}
              label="インライン数式"
              onClick={() => onWrapInline('$', '$', 'x^2 + y^2 = r^2')}
            />
            <RibbonButton
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              label="使い方ガイド"
              onClick={onOpenTutorial}
            />
          </>
        )}
      </div>
    </div>
  );
}
