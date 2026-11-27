import { useEffect } from 'react';
import {
  Calculator,
  Code,
  Copy,
  Heading1,
  Heading2,
  Italic,
  List,
  Sigma,
  SquareCheck,
  Trash,
  Type,
} from 'lucide-react';
import type { CodeBlockLanguage } from '../../lib/codeHighlight';
import type { TextFormatAction } from '../../lib/textMarkdown';

export interface ContextMenuState {
  clientX: number;
  clientY: number;
  canvasX: number;
  canvasY: number;
  containerId: string | null;
  /** テキストボックス内で右クリックした際の選択範囲 */
  textSelection?: {
    containerId: string;
    start: number;
    end: number;
  };
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
  onInsertTextBox: (x: number, y: number) => void;
  onInsertMath: (x: number, y: number) => void;
  onInsertCodeCell: (lang: CodeBlockLanguage, x: number, y: number) => void;
  onOpenCalculator: () => void;
  onDuplicateContainer: (id: string) => void;
  onDeleteContainer: (id: string) => void;
  onApplyTextFormat?: (containerId: string, start: number, end: number, action: TextFormatAction) => void;
}

/** キャンバス＆テキストボックス専用の右クリックコンテキストメニュー */
export default function EditorContextMenu({
  menu,
  onClose,
  onInsertTextBox,
  onInsertMath,
  onInsertCodeCell,
  onOpenCalculator,
  onDuplicateContainer,
  onDeleteContainer,
  onApplyTextFormat,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onClick = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  const isTextMenu = Boolean(menu.textSelection && onApplyTextFormat);
  const menuHeight = isTextMenu ? 420 : 320;
  const left = Math.max(8, Math.min(menu.clientX, window.innerWidth - 250));
  const top = Math.max(8, Math.min(menu.clientY, window.innerHeight - menuHeight));

  const itemCls =
    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800';

  const triggerFormat = (action: TextFormatAction) => {
    if (!menu.textSelection || !onApplyTextFormat) return;
    onApplyTextFormat(menu.textSelection.containerId, menu.textSelection.start, menu.textSelection.end, action);
    onClose();
  };

  return (
    <div
      style={{ left, top }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed z-50 w-60 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur"
    >
      {isTextMenu && menu.textSelection ? (
        <>
          <div className="px-2 py-1 text-[10px] font-semibold text-indigo-300">文字スタイル</div>
          <button type="button" onClick={() => triggerFormat('bold')} className={itemCls}>
            <span className="flex items-center gap-2">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center font-bold text-white">B</span>
              太字
            </span>
            <span className="font-mono text-[10px] text-slate-500">Ctrl+B</span>
          </button>
          <button type="button" onClick={() => triggerFormat('italic')} className={itemCls}>
            <span className="flex items-center gap-2">
              <Italic className="h-3.5 w-3.5 text-slate-300" />
              斜体
            </span>
            <span className="font-mono text-[10px] text-slate-500">Ctrl+I</span>
          </button>
          <button type="button" onClick={() => triggerFormat('underline')} className={itemCls}>
            <span className="flex items-center gap-2">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center font-semibold underline text-indigo-300">
                U
              </span>
              下線
            </span>
            <span className="font-mono text-[10px] text-slate-500">Ctrl+U</span>
          </button>
          <button type="button" onClick={() => triggerFormat('strike')} className={itemCls}>
            <span className="flex items-center gap-2">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center line-through text-slate-400">
                S
              </span>
              打ち消し線
            </span>
            <span className="font-mono text-[10px] text-slate-500">~~</span>
          </button>
          <button type="button" onClick={() => triggerFormat('code')} className={itemCls}>
            <span className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-cyan-300" />
              インラインコード
            </span>
            <span className="font-mono text-[10px] text-slate-500">`code`</span>
          </button>

          <div className="my-1 h-px bg-slate-800" />
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-500">サイズ・見出し切替</div>
          <button type="button" onClick={() => triggerFormat('h1')} className={itemCls}>
            <span className="flex items-center gap-2">
              <Heading1 className="h-3.5 w-3.5 text-indigo-300" />
              見出し大 (H1)
            </span>
            <span className="font-mono text-[10px] text-slate-500">#</span>
          </button>
          <button type="button" onClick={() => triggerFormat('h2')} className={itemCls}>
            <span className="flex items-center gap-2">
              <Heading2 className="h-3.5 w-3.5 text-indigo-300" />
              見出し中 (H2)
            </span>
            <span className="font-mono text-[10px] text-slate-500">##</span>
          </button>
          <button type="button" onClick={() => triggerFormat('normal')} className={itemCls}>
            <span className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-slate-300" />
              標準テキスト
            </span>
          </button>
          <button type="button" onClick={() => triggerFormat('small')} className={itemCls}>
            <span className="flex items-center gap-2">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[9px] text-slate-400">a</span>
              小文字
            </span>
            <span className="font-mono text-[10px] text-slate-500">&lt;small&gt;</span>
          </button>

          <div className="my-1 h-px bg-slate-800" />
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-500">リスト・装飾</div>
          <button type="button" onClick={() => triggerFormat('bullet')} className={itemCls}>
            <span className="flex items-center gap-2">
              <List className="h-3.5 w-3.5 text-sky-300" />
              箇条書きリスト化
            </span>
          </button>
          <button type="button" onClick={() => triggerFormat('checklist')} className={itemCls}>
            <span className="flex items-center gap-2">
              <SquareCheck className="h-3.5 w-3.5 text-emerald-300" />
              チェックリスト化
            </span>
          </button>
          <button type="button" onClick={() => triggerFormat('inline-math')} className={itemCls}>
            <span className="flex items-center gap-2">
              <Sigma className="h-3.5 w-3.5 text-violet-300" />
              インライン数式化
            </span>
            <span className="font-mono text-[10px] text-slate-500">$...$</span>
          </button>
        </>
      ) : (
        <>
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-500">この位置に挿入</div>
          <button
            type="button"
            onClick={() => {
              onInsertTextBox(menu.canvasX, menu.canvasY);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-sky-300" />
              テキストボックス
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertMath(menu.canvasX, menu.canvasY);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Sigma className="h-3.5 w-3.5 text-violet-300" />
              数式ブロック (KaTeX)
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertCodeCell('python', menu.canvasX, menu.canvasY);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-amber-300" />
              Python コードセル
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertCodeCell('java', menu.canvasX, menu.canvasY);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-orange-300" />
              Java コードセル
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertCodeCell('c', menu.canvasX, menu.canvasY);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-sky-300" />
              C コードセル
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertCodeCell('typescript', menu.canvasX, menu.canvasY);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-indigo-300" />
              コードブロック（多言語）
            </span>
          </button>

          <div className="my-1 h-px bg-slate-800" />

          <button
            type="button"
            onClick={() => {
              onOpenCalculator();
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Calculator className="h-3.5 w-3.5 text-amber-300" />
              関数電卓を開く
            </span>
          </button>
        </>
      )}

      {menu.containerId && (
        <>
          <div className="my-1 h-px bg-slate-800" />
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-500">選択コンテナ</div>
          <button
            type="button"
            onClick={() => {
              onDuplicateContainer(menu.containerId!);
              onClose();
            }}
            className={itemCls}
          >
            <span className="flex items-center gap-2">
              <Copy className="h-3.5 w-3.5 text-cyan-300" />
              複製
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDeleteContainer(menu.containerId!);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-300 transition-colors hover:bg-rose-500/15"
          >
            <Trash className="h-3.5 w-3.5" />
            削除
          </button>
        </>
      )}
    </div>
  );
}
