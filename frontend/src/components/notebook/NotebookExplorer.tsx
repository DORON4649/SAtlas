import { useMemo, useState } from 'react';
import { BookOpen, Folder, Pin, Plus, Search, Trash2, WifiOff } from 'lucide-react';
import type { LectureNote } from '../../types';

export type NoteFilterMode = 'all' | 'pinned' | { subject: string };

interface Props {
  notes: LectureNote[];
  timetableSubjects: string[];
  selectedNoteId: number | null;
  offline: boolean;
  loading: boolean;
  onSelectNote: (id: number) => void;
  onCreateNote: (subjectName: string) => void;
  onTogglePin: (note: LectureNote) => void;
  onDeleteNote: (note: LectureNote) => void;
}

/** 3ペイン左側のノートエクスプローラー（科目フォルダ・ピン留め・検索・ノート一覧） */
export default function NotebookExplorer({
  notes,
  timetableSubjects,
  selectedNoteId,
  offline,
  loading,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onDeleteNote,
}: Props) {
  const [filter, setFilter] = useState<NoteFilterMode>('all');
  const [query, setQuery] = useState('');

  // 時間割から抽出した科目 + 既存ノートにある科目を統合
  const subjectFolders = useMemo(() => {
    const set = new Set<string>();
    for (const s of timetableSubjects) {
      if (s.trim()) set.add(s.trim());
    }
    for (const n of notes) {
      if (n.subjectName.trim()) set.add(n.subjectName.trim());
    }
    if (set.size === 0) set.add('未分類');
    return Array.from(set);
  }, [timetableSubjects, notes]);

  const countBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      map.set(n.subjectName, (map.get(n.subjectName) ?? 0) + 1);
    }
    return map;
  }, [notes]);

  const pinnedCount = useMemo(() => notes.filter((n) => n.isPinned).length, [notes]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter === 'pinned' && !n.isPinned) return false;
      if (typeof filter === 'object' && n.subjectName !== filter.subject) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.subjectName.toLowerCase().includes(q) ||
        (n.tags ?? '').toLowerCase().includes(q) ||
        n.contentMarkdown.toLowerCase().includes(q)
      );
    });
  }, [notes, filter, query]);

  const activeSubjectForNewNote = typeof filter === 'object' ? filter.subject : subjectFolders[0] ?? '未分類';

  const formatShortDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-2.5">
      {/* ヘッダー＋新規作成 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-cyan-400" />
          <h2 className="text-xs font-semibold text-slate-200">講義ノート</h2>
          {offline && (
            <span
              className="flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300"
              title="サーバー未接続のためローカル保存中"
            >
              <WifiOff className="h-2.5 w-2.5" />
              ローカル
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCreateNote(activeSubjectForNewNote)}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-500"
          title={`「${activeSubjectForNewNote}」に新規ノートを作成`}
        >
          <Plus className="h-3.5 w-3.5" />
          新規
        </button>
      </div>

      {/* 検索バー */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="タイトル・タグ・本文を検索"
          className="w-full rounded-lg border border-slate-700/80 bg-slate-800/70 py-1.5 pl-8 pr-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* フィルタ（すべて / ピン留め） */}
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600/20 text-blue-200 ring-1 ring-blue-500/30'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <span>すべて</span>
          <span className="text-[10px] opacity-75">{notes.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('pinned')}
          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
            filter === 'pinned'
              ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-1">
            <Pin className="h-3 w-3" />
            ピン留め
          </span>
          <span className="text-[10px] opacity-75">{pinnedCount}</span>
        </button>
      </div>

      {/* 科目フォルダ一覧（時間割連動） */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>科目フォルダ</span>
          <span>{subjectFolders.length}</span>
        </div>
        <div className="max-h-36 space-y-0.5 overflow-y-auto pr-0.5">
          {subjectFolders.map((subject) => {
            const active = typeof filter === 'object' && filter.subject === subject;
            const count = countBySubject.get(subject) ?? 0;
            return (
              <button
                key={subject}
                type="button"
                onClick={() => setFilter({ subject })}
                className={`flex w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                  active
                    ? 'bg-cyan-500/15 font-semibold text-cyan-200 ring-1 ring-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Folder className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="truncate">{subject}</span>
                </span>
                <span className="shrink-0 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-800" />

      {/* ノート一覧 */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {loading ? (
          <p className="p-2 text-center text-xs text-slate-500">読み込み中...</p>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-[11px] text-slate-500">
            該当するノートがありません
          </div>
        ) : (
          filteredNotes.map((note) => {
            const selected = note.id === selectedNoteId;
            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNote(note.id);
                  }
                }}
                className={`group cursor-pointer rounded-xl border p-2.5 transition ${
                  selected
                    ? 'border-blue-500/50 bg-blue-600/15 text-white'
                    : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" />}
                      <p className="truncate text-xs font-semibold">{note.title || '無題のノート'}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="truncate rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                        {note.subjectName}
                      </span>
                      <span className="shrink-0">{formatShortDate(note.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(note);
                      }}
                      className={`rounded p-1 hover:bg-slate-700 ${
                        note.isPinned ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title={note.isPinned ? 'ピン留め解除' : 'ピン留め'}
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                      title="ノートを削除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
