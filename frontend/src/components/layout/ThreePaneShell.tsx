import type { ReactNode } from 'react';
import { Calendar, CalendarDays, ClipboardList, LayoutGrid, Settings, StickyNote } from 'lucide-react';
import type { NavSection } from './shellTypes';

const NAV_ITEMS: { id: NavSection; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'calendar', label: 'カレンダー', icon: <Calendar className="h-4 w-4" /> },
  { id: 'timetable', label: '時間割', icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'assignments', label: '課題', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'memos', label: 'メモ', icon: <StickyNote className="h-4 w-4" /> },
  { id: 'settings', label: '設定', icon: <Settings className="h-4 w-4" /> },
];

interface Props {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  /** 中央ワークスペース */
  children: ReactNode;
  /** 右ツールペイン */
  tools: ReactNode;
}

/** 3 ペイン構成（左ナビ / 中央ワークスペース / 右ツール） */
export default function ThreePaneShell({ activeSection, onSectionChange, children, tools }: Props) {
  return (
    <div className="flex min-h-0 flex-1">
      {/* 左ナビ */}
      <nav className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-14 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-900/60 p-2 md:w-52">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            title={item.label}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              activeSection === item.id
                ? 'bg-blue-600/20 font-semibold text-blue-200 ring-1 ring-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {item.icon}
            <span className="hidden md:inline">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 中央ワークスペース */}
      <section className="min-w-0 flex-1 p-4">{children}</section>

      {/* 右ツール */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 space-y-3 overflow-y-auto border-l border-slate-800 bg-slate-900/60 p-3 lg:block">
        {tools}
      </aside>
    </div>
  );
}
