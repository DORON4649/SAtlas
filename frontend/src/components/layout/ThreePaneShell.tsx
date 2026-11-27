import type { ReactNode } from 'react';
import { BookOpen, Calendar, CalendarDays, ClipboardList, LayoutGrid, Settings, StickyNote } from 'lucide-react';
import type { NavSection } from './shellTypes';

const MAIN_NAV_ITEMS: { id: NavSection; label: string; icon: ReactNode }[] = [
  { id: 'home', label: 'ホーム', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'notes', label: 'ノート', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'timetable', label: '時間割', icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'calendar', label: 'カレンダー', icon: <Calendar className="h-4 w-4" /> },
  { id: 'assignments', label: '課題', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'memos', label: 'メモ', icon: <StickyNote className="h-4 w-4" /> },
];

interface Props {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  /** 左サブペイン（例: ノートエクスプローラー） */
  leftSubPane?: ReactNode;
  /** 左ペイン（ナビゲーション・エクスプローラー）開閉状態 */
  leftPaneOpen?: boolean;
  /** 右ペイン（AI アシスタント等）開閉状態 */
  rightPaneOpen?: boolean;
  /** 中央ワークスペース */
  children: ReactNode;
  /** 右ツールペイン */
  tools: ReactNode;
}

/** 統一 3 ペイン構成（左ナビ[+サブペイン] / 中央ワークスペース / 右ツール） */
export default function ThreePaneShell({
  activeSection,
  onSectionChange,
  leftSubPane,
  leftPaneOpen = true,
  rightPaneOpen = true,
  children,
  tools,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 overflow-x-hidden">
      {/* 左ナビ（上部に主要メニュー、下部に設定アイコンを固定配置） */}
      <nav
        aria-hidden={!leftPaneOpen}
        className={`sticky top-14 flex h-[calc(100vh-3.5rem)] shrink-0 flex-col justify-between overflow-hidden bg-slate-900/60 transition-[width,opacity,padding] duration-200 ease-out ${
          leftPaneOpen
            ? `border-r border-slate-800 p-2 opacity-100 ${leftSubPane ? 'w-14 xl:w-44' : 'w-14 md:w-52'}`
            : 'pointer-events-none w-0 border-r-0 p-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-1">
          {MAIN_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-blue-600/20 font-semibold text-blue-400 ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className={`truncate ${leftSubPane ? 'hidden xl:inline' : 'hidden md:inline'}`}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* 左ナビ下部：歯車「設定」ボタン */}
        <div className="border-t border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => onSectionChange('settings')}
            title="設定 (Settings)"
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              activeSection === 'settings'
                ? 'bg-indigo-600/20 font-semibold text-indigo-300 ring-1 ring-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className={`truncate ${leftSubPane ? 'hidden xl:inline' : 'hidden md:inline'}`}>設定</span>
          </button>
        </div>
      </nav>

      {/* 左サブペイン（ノートエクスプローラー等） */}
      {leftSubPane && (
        <aside
          aria-hidden={!leftPaneOpen}
          className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-hidden bg-slate-900/40 transition-[width,opacity] duration-200 ease-out ${
            leftPaneOpen
              ? 'w-60 border-r border-slate-800 opacity-100 md:w-64'
              : 'pointer-events-none w-0 border-r-0 opacity-0'
          }`}
        >
          <div className="h-full w-60 md:w-64">{leftSubPane}</div>
        </aside>
      )}

      {/* 中央ワークスペース */}
      <section className="min-w-0 flex-1 p-4 transition-all duration-200">{children}</section>

      {/* 右ツール（AI アシスタント等） */}
      <aside
        aria-hidden={!rightPaneOpen}
        className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-x-hidden overflow-y-auto bg-slate-900/60 transition-[width,opacity,padding] duration-200 ease-out ${
          rightPaneOpen
            ? 'w-72 border-l border-slate-800 p-3 opacity-100'
            : 'pointer-events-none w-0 border-l-0 p-0 opacity-0'
        }`}
      >
        <div className="w-[16.5rem] space-y-3">{tools}</div>
      </aside>
    </div>
  );
}
