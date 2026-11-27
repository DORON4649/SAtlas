import type { ReactNode } from 'react';
import { BookOpen, Calendar, CalendarDays, ClipboardList, LayoutGrid, Moon, Settings, StickyNote, Sun } from 'lucide-react';
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
  /** 現在の解決済みテーマ（左ナビ下部のクイック切替用） */
  resolvedTheme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  /** 中央ワークスペース */
  children: ReactNode;
  /** 右ツールペイン */
  tools: ReactNode;
}

/**
 * ビューポート固定（h-full / overflow-hidden）の統一 3 ペイン構成。
 * 左サイドリボンは一切スクロールさせず、中央・左サブペイン・右ペインの各内部領域のみスクロールさせる。
 */
export default function ThreePaneShell({
  activeSection,
  onSectionChange,
  leftSubPane,
  leftPaneOpen = true,
  rightPaneOpen = true,
  resolvedTheme = 'dark',
  onToggleTheme,
  children,
  tools,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* 左サイドリボン（非スクロール固定・下部にテーマ切替＆設定を mt-auto で常時表示） */}
      <nav
        aria-hidden={!leftPaneOpen}
        className={`flex h-full shrink-0 flex-col justify-between overflow-hidden bg-slate-900/60 transition-[width,opacity,padding] duration-200 ease-out ${
          leftPaneOpen
            ? `border-r border-slate-800 p-2 opacity-100 ${leftSubPane ? 'w-14 xl:w-44' : 'w-14 md:w-48'}`
            : 'pointer-events-none w-0 border-r-0 p-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-0.5">
          {MAIN_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
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

        {/* 左ナビ下部（mt-auto で画面下端に常時固定） */}
        <div className="mt-auto flex flex-col gap-0.5 border-t border-slate-800 pt-2">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={resolvedTheme === 'dark' ? 'ライトテーマへ切替' : 'ダークテーマへ切替'}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              <span className="shrink-0">
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-300" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" />
                )}
              </span>
              <span className={`truncate ${leftSubPane ? 'hidden xl:inline' : 'hidden md:inline'}`}>
                {resolvedTheme === 'dark' ? 'ライトモード' : 'ダークモード'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSectionChange('settings')}
            title="設定 (Settings)"
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
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

      {/* 左サブペイン（ノートエクスプローラー等・内部リストのみスクロール） */}
      {leftSubPane && (
        <aside
          aria-hidden={!leftPaneOpen}
          className={`h-full shrink-0 overflow-hidden bg-slate-900/40 transition-[width,opacity] duration-200 ease-out ${
            leftPaneOpen
              ? 'w-60 border-r border-slate-800 opacity-100 md:w-64'
              : 'pointer-events-none w-0 border-r-0 opacity-0'
          }`}
        >
          <div className="h-full w-60 md:w-64">{leftSubPane}</div>
        </aside>
      )}

      {/* 中央ワークスペース（この領域のみスクロール） */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-3 transition-all duration-200 md:p-4">
        {children}
      </section>

      {/* 右ツールペイン（AI アシスタント等・内部のみスクロール） */}
      <aside
        aria-hidden={!rightPaneOpen}
        className={`flex h-full shrink-0 flex-col overflow-hidden bg-slate-900/60 transition-[width,opacity,padding] duration-200 ease-out ${
          rightPaneOpen
            ? 'w-72 border-l border-slate-800 p-3 opacity-100'
            : 'pointer-events-none w-0 border-l-0 p-0 opacity-0'
        }`}
      >
        <div className="flex h-full min-h-0 w-[16.5rem] flex-col gap-3 overflow-y-auto">{tools}</div>
      </aside>
    </div>
  );
}
