import { useMemo, useState } from 'react';
import {
  BookOpen,
  FilePlus,
  FolderPlus,
  Pin,
  Plus,
  Search,
  Trash,
  WifiOff,
} from 'lucide-react';
import {
  DEFAULT_SECTION_COLOR,
  DEFAULT_SECTION_NAME,
  SECTION_COLOR_PRESETS,
} from '../../lib/oneNoteModel';
import type { LectureNote } from '../../types';

interface Props {
  notes: LectureNote[];
  timetableSubjects: string[];
  selectedNoteId: number | null;
  offline: boolean;
  loading: boolean;
  onSelectNote: (id: number) => void;
  onCreatePage: (subjectName: string, sectionName: string, sectionColor: string) => void;
  onTogglePin: (note: LectureNote) => void;
  onDeleteNote: (note: LectureNote) => void;
}

interface SectionTab {
  name: string;
  color: string;
  count: number;
}

const DEFAULT_SECTIONS: { name: string; color: string }[] = [
  { name: '講義ノート', color: '#6366f1' },
  { name: '演習', color: '#10b981' },
  { name: '試験対策', color: '#f43f5e' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * OneNote 風 3 層ナビゲーション（左サブペイン）：
 * 1. 科目ノートブック一覧（時間割から自動抽出 + 任意追加）
 * 2. 色付きセクションタブ（追加・切替）
 * 3. ページ一覧（タイトル + 作成日時 + ピン/削除）＋検索バー
 */
export default function NotebookExplorer({
  notes,
  timetableSubjects,
  selectedNoteId,
  offline,
  loading,
  onSelectNote,
  onCreatePage,
  onTogglePin,
  onDeleteNote,
}: Props) {
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [customNotebooks, setCustomNotebooks] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<Record<string, { name: string; color: string }[]>>({});

  // 追加フォーム状態
  const [addingNotebook, setAddingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState<string>(SECTION_COLOR_PRESETS[0]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  // 科目ノートブック一覧
  const notebooks = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of timetableSubjects) {
      if (s.trim()) map.set(s.trim(), 0);
    }
    for (const s of customNotebooks) {
      if (s.trim() && !map.has(s.trim())) map.set(s.trim(), 0);
    }
    for (const n of notes) {
      const key = n.subjectName || '未分類';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    if (!map.has('未分類')) map.set('未分類', 0);
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [notes, timetableSubjects, customNotebooks]);

  const currentSubject = activeSubject ?? selectedNote?.subjectName ?? notebooks[0]?.name ?? '未分類';

  // 選択中ノートブック内の色付きセクションタブ
  const sections = useMemo<SectionTab[]>(() => {
    const map = new Map<string, SectionTab>();
    for (const def of DEFAULT_SECTIONS) {
      map.set(def.name, { name: def.name, color: def.color, count: 0 });
    }
    for (const custom of customSections[currentSubject] ?? []) {
      map.set(custom.name, { name: custom.name, color: custom.color, count: 0 });
    }
    for (const n of notes) {
      if (n.subjectName !== currentSubject) continue;
      const secName = n.sectionName || DEFAULT_SECTION_NAME;
      const prev = map.get(secName);
      map.set(secName, {
        name: secName,
        color: n.sectionColor || prev?.color || DEFAULT_SECTION_COLOR,
        count: (prev?.count ?? 0) + 1,
      });
    }
    return Array.from(map.values());
  }, [notes, currentSubject, customSections]);

  const currentSection = useMemo(() => {
    if (activeSection && sections.some((s) => s.name === activeSection)) {
      return activeSection;
    }
    if (selectedNote && selectedNote.subjectName === currentSubject) {
      return selectedNote.sectionName || DEFAULT_SECTION_NAME;
    }
    return sections[0]?.name ?? DEFAULT_SECTION_NAME;
  }, [activeSection, sections, selectedNote, currentSubject]);

  const currentSectionColor =
    sections.find((s) => s.name === currentSection)?.color ?? DEFAULT_SECTION_COLOR;

  // 表示するページ一覧（検索中は全ノート横断、通常は選択中ノートブック＞セクション）
  const visiblePages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.subjectName.toLowerCase().includes(q) ||
          n.sectionName.toLowerCase().includes(q) ||
          n.contentJson.toLowerCase().includes(q),
      );
    }
    return notes.filter(
      (n) => n.subjectName === currentSubject && (n.sectionName || DEFAULT_SECTION_NAME) === currentSection,
    );
  }, [notes, search, currentSubject, currentSection]);

  const handleAddNotebook = () => {
    const name = newNotebookName.trim();
    if (!name) return;
    setCustomNotebooks((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveSubject(name);
    setActiveSection('講義ノート');
    setNewNotebookName('');
    setAddingNotebook(false);
    onCreatePage(name, '講義ノート', DEFAULT_SECTION_COLOR);
  };

  const handleAddSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    setCustomSections((prev) => ({
      ...prev,
      [currentSubject]: [...(prev[currentSubject] ?? []), { name, color: newSectionColor }],
    }));
    setActiveSection(name);
    setNewSectionName('');
    setAddingSection(false);
    onCreatePage(currentSubject, name, newSectionColor);
  };

  return (
    <div className="flex h-full flex-col bg-slate-900/50 text-xs">
      {/* ヘッダー＆検索バー */}
      <div className="space-y-2 border-b border-slate-800 p-2.5">
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
            ノートブック
          </span>
          {offline && (
            <span className="flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
              <WifiOff className="h-2.5 w-2.5" />
              ローカル
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="全ページを検索..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 py-1.5 pl-7 pr-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 1層目: 科目ノートブック一覧 */}
      <div className="border-b border-slate-800 p-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            科目ノートブック
          </span>
          <button
            type="button"
            onClick={() => setAddingNotebook((v) => !v)}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            title="ノートブックを追加"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingNotebook && (
          <form
            className="mb-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddNotebook();
            }}
          >
            <input
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              placeholder="科目・ノートブック名"
              autoFocus
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500"
            >
              追加
            </button>
          </form>
        )}

        <div className="max-h-32 space-y-0.5 overflow-y-auto pr-0.5">
          {notebooks.map((nb) => {
            const active = nb.name === currentSubject && !search.trim();
            return (
              <button
                key={nb.name}
                type="button"
                onClick={() => {
                  setSearch('');
                  setActiveSubject(nb.name);
                  setActiveSection(null);
                  const first = notes.find((n) => n.subjectName === nb.name);
                  if (first) onSelectNote(first.id);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition ${
                  active
                    ? 'bg-indigo-600/25 font-semibold text-indigo-200 ring-1 ring-indigo-500/40'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <span className="truncate">{nb.name}</span>
                <span className="ml-1 shrink-0 rounded-full bg-slate-800 px-1.5 text-[10px] text-slate-400">
                  {nb.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2層目: 色付きセクションタブ */}
      {!search.trim() && (
        <div className="border-b border-slate-800 p-2">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              セクション
            </span>
            <button
              type="button"
              onClick={() => setAddingSection((v) => !v)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              title="色付きセクションを追加"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {addingSection && (
            <form
              className="mb-2 space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSection();
              }}
            >
              <input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="例: 講義ノート / 演習 / 試験対策"
                autoFocus
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  {SECTION_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSectionColor(c)}
                      style={{ backgroundColor: c }}
                      className={`h-4 w-4 rounded-full ${
                        newSectionColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : 'opacity-70'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-500"
                >
                  追加
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-1">
            {sections.map((sec) => {
              const active = sec.name === currentSection;
              return (
                <button
                  key={sec.name}
                  type="button"
                  onClick={() => {
                    setActiveSection(sec.name);
                    const first = notes.find(
                      (n) =>
                        n.subjectName === currentSubject &&
                        (n.sectionName || DEFAULT_SECTION_NAME) === sec.name,
                    );
                    if (first) onSelectNote(first.id);
                  }}
                  style={{
                    borderTopColor: sec.color,
                    backgroundColor: active ? `${sec.color}28` : undefined,
                  }}
                  className={`flex items-center gap-1.5 rounded-md border border-t-2 px-2 py-1 text-[11px] transition ${
                    active
                      ? 'border-slate-600 font-semibold text-white'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sec.color }} />
                  <span className="max-w-24 truncate">{sec.name}</span>
                  <span className="text-[9px] opacity-70">{sec.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3層目: ページ一覧 */}
      <div className="flex min-h-0 flex-1 flex-col p-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {search.trim() ? `検索結果 (${visiblePages.length})` : `ページ (${visiblePages.length})`}
          </span>
          <button
            type="button"
            onClick={() => onCreatePage(currentSubject, currentSection, currentSectionColor)}
            className="flex items-center gap-1 rounded bg-indigo-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-600/35"
          >
            <FilePlus className="h-3 w-3" />
            ページ追加
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
          {loading && <div className="p-2 text-[11px] text-slate-500">読み込み中...</div>}
          {!loading && visiblePages.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-[11px] text-slate-500">
              このセクションにはまだページがありません。
              <button
                type="button"
                onClick={() => onCreatePage(currentSubject, currentSection, currentSectionColor)}
                className="mt-2 block w-full rounded bg-slate-800 py-1 text-indigo-300 hover:bg-slate-700"
              >
                + 最初のページを作成
              </button>
            </div>
          )}

          {visiblePages.map((page) => {
            const selected = page.id === selectedNoteId;
            return (
              <div
                key={page.id}
                onClick={() => onSelectNote(page.id)}
                style={{ borderLeftColor: page.sectionColor || DEFAULT_SECTION_COLOR }}
                className={`group cursor-pointer rounded-lg border border-l-4 px-2.5 py-2 transition ${
                  selected
                    ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                    : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate font-medium">
                      {page.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" />}
                      <span className="truncate">{page.title || '無題のページ'}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{formatDate(page.createdAt ?? page.updatedAt)}</span>
                      {search.trim() && (
                        <span className="truncate text-indigo-300/80">
                          {page.subjectName} / {page.sectionName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pointer-events-none flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(page);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-amber-300"
                      title={page.isPinned ? 'ピン解除' : 'ピン留め'}
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(page);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                      title="ページを削除"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
