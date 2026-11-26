import { useEffect } from 'react';
import {
  CheckSquare,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  PenTool,
  Quote,
  Sigma,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { CodeLanguage } from '../../lib/codeRunner';

export interface ContextMenuState {
  x: number;
  y: number;
  blockId: string | null;
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
  onInsertMath: () => void;
  onInsertCodeCell: (lang: CodeLanguage) => void;
  onOpenHandwriting: () => void;
  onConvertBlock: (
    target: 'h1' | 'h2' | 'h3' | 'bullet-list' | 'ordered-list' | 'checklist' | 'quote',
  ) => void;
  onDuplicateBlock: () => void;
  onDeleteBlock: () => void;
}

const MENU_WIDTH = 248;
const MENU_ESTIMATED_HEIGHT = 420;

/** エディタ内の右クリック・コンテキストメニュー（画面端の自動位置補正付き） */
export default function EditorContextMenu({
  menu,
  onClose,
  onInsertMath,
  onInsertCodeCell,
  onOpenHandwriting,
  onConvertBlock,
  onDuplicateBlock,
  onDeleteBlock,
}: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = () => onClose();
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const maxX = typeof window !== 'undefined' ? Math.max(8, window.innerWidth - MENU_WIDTH - 12) : menu.x;
  const maxY = typeof window !== 'undefined' ? Math.max(8, window.innerHeight - MENU_ESTIMATED_HEIGHT - 12) : menu.y;
  const left = Math.min(Math.max(8, menu.x), maxX);
  const top = Math.min(Math.max(8, menu.y), maxY);

  const runAndClose = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      style={{ left, top, width: MENU_WIDTH }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 text-xs text-slate-200 shadow-2xl backdrop-blur"
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-slate-500">挿入</div>
      <button
        type="button"
        onClick={() => runAndClose(onInsertMath)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
      >
        <Sigma className="h-3.5 w-3.5 text-cyan-400" />
        数式ブロックを挿入 (KaTeX)
      </button>
      <div className="grid grid-cols-3 gap-1 px-1 py-1">
        <button
          type="button"
          onClick={() => runAndClose(() => onInsertCodeCell('python'))}
          className="flex items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 py-1 text-[10px] font-medium text-amber-200 hover:bg-amber-500/20"
        >
          <Terminal className="h-3 w-3" />
          Python
        </button>
        <button
          type="button"
          onClick={() => runAndClose(() => onInsertCodeCell('java'))}
          className="flex items-center justify-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 py-1 text-[10px] font-medium text-orange-200 hover:bg-orange-500/20"
        >
          <Terminal className="h-3 w-3" />
          Java
        </button>
        <button
          type="button"
          onClick={() => runAndClose(() => onInsertCodeCell('c'))}
          className="flex items-center justify-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 py-1 text-[10px] font-medium text-sky-200 hover:bg-sky-500/20"
        >
          <Terminal className="h-3 w-3" />
          C
        </button>
      </div>
      <button
        type="button"
        onClick={() => runAndClose(onOpenHandwriting)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
      >
        <PenTool className="h-3.5 w-3.5 text-emerald-400" />
        手書きキャンバスを開く
      </button>

      {menu.blockId && (
        <>
          <div className="my-1 border-t border-slate-800" />
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-500">見出し・リストに変換</div>
          <div className="grid grid-cols-3 gap-1 px-1 pb-1">
            <button
              type="button"
              onClick={() => runAndClose(() => onConvertBlock('h1'))}
              className="flex items-center justify-center gap-1 rounded-md bg-slate-800/80 py-1 text-[10px] hover:bg-slate-700"
            >
              <Heading1 className="h-3 w-3" />
              H1
            </button>
            <button
              type="button"
              onClick={() => runAndClose(() => onConvertBlock('h2'))}
              className="flex items-center justify-center gap-1 rounded-md bg-slate-800/80 py-1 text-[10px] hover:bg-slate-700"
            >
              <Heading2 className="h-3 w-3" />
              H2
            </button>
            <button
              type="button"
              onClick={() => runAndClose(() => onConvertBlock('h3'))}
              className="flex items-center justify-center gap-1 rounded-md bg-slate-800/80 py-1 text-[10px] hover:bg-slate-700"
            >
              <Heading3 className="h-3 w-3" />
              H3
            </button>
          </div>
          <button
            type="button"
            onClick={() => runAndClose(() => onConvertBlock('bullet-list'))}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
          >
            <List className="h-3.5 w-3.5 text-slate-400" />
            箇条書きリストに変換
          </button>
          <button
            type="button"
            onClick={() => runAndClose(() => onConvertBlock('ordered-list'))}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
          >
            <ListOrdered className="h-3.5 w-3.5 text-slate-400" />
            番号付きリストに変換
          </button>
          <button
            type="button"
            onClick={() => runAndClose(() => onConvertBlock('checklist'))}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
          >
            <CheckSquare className="h-3.5 w-3.5 text-slate-400" />
            チェックリストに変換
          </button>
          <button
            type="button"
            onClick={() => runAndClose(() => onConvertBlock('quote'))}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
          >
            <Quote className="h-3.5 w-3.5 text-slate-400" />
            引用ブロックに変換
          </button>

          <div className="my-1 border-t border-slate-800" />
          <button
            type="button"
            onClick={() => runAndClose(onDuplicateBlock)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-800"
          >
            <Copy className="h-3.5 w-3.5 text-blue-400" />
            ブロックを複製
          </button>
          <button
            type="button"
            onClick={() => runAndClose(onDeleteBlock)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-300 hover:bg-rose-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ブロックを削除
          </button>
        </>
      )}
    </div>
  );
}
