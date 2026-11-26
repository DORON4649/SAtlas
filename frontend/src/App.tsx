import { useCallback, useMemo, useState } from 'react';
import { BookOpen, Bot, Calendar, FileUp, KeyRound, Layers, Lock, Unlock, Wrench } from 'lucide-react';
import AiAssistantPanel from './components/ai/AiAssistantPanel';
import AiSettingsModal from './components/ai/AiSettingsModal';
import CalendarSidePanel from './components/calendar/CalendarSidePanel';
import CalendarWorkspace from './components/calendar/CalendarWorkspace';
import GoogleIcalModal from './components/calendar/GoogleIcalModal';
import Dashboard from './components/dashboard/Dashboard';
import AppHeader from './components/layout/AppHeader';
import ThreePaneShell from './components/layout/ThreePaneShell';
import type { NavSection, ViewMode } from './components/layout/shellTypes';
import NotebookExplorer from './components/notebook/NotebookExplorer';
import NotebookWorkspace from './components/notebook/NotebookWorkspace';
import PdfImportModal from './components/timetable/PdfImportModal';
import WeeklyTimetable from './components/timetable/WeeklyTimetable';
import AssignmentsWidget from './components/widgets/AssignmentsWidget';
import MemoWidget from './components/widgets/MemoWidget';
import { useAuth } from './hooks/useAuth';
import { loadOfflineIcalUrl, useCalendar } from './hooks/useCalendar';
import { useDashboardLayout } from './hooks/useDashboardLayout';
import { useNotes } from './hooks/useNotes';
import { useTimetable } from './hooks/useTimetable';
import {
  DEFAULT_LAYERS,
  getVisibleRange,
  type CalendarLayerFilter,
  type CalendarViewMode,
} from './lib/calendar';
import type { LectureNote } from './types';

const VIEW_MODE_KEY = 'satlas_view_mode';

export default function App() {
  const { auth, refresh: refreshAuth, logout } = useAuth();
  const timetable = useTimetable();
  const { layouts, onLayoutChange, resetLayout, syncState } = useDashboardLayout();

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_MODE_KEY) === 'three-pane' ? 'three-pane' : 'dashboard',
  );
  const [section, setSection] = useState<NavSection>('dashboard');
  const [isEditing, setIsEditing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [calendarRightTab, setCalendarRightTab] = useState<'calendar' | 'ai'>('calendar');
  const [loginError, setLoginError] = useState(() => new URLSearchParams(window.location.search).has('login_error'));

  // カレンダー状態
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [layers, setLayers] = useState<CalendarLayerFilter>(DEFAULT_LAYERS);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [quickSyncing, setQuickSyncing] = useState(false);

  const visibleRange = useMemo(() => getVisibleRange(anchorDate, calendarView), [anchorDate, calendarView]);
  const calendar = useCalendar(visibleRange.start, visibleRange.end);

  // 講義ノート状態
  const lectureNotes = useNotes();
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [activeNoteDraft, setActiveNoteDraft] = useState<LectureNote | null>(null);

  const timetableSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const entry of timetable.entries) {
      if (entry.subject.trim()) set.add(entry.subject.trim());
    }
    return Array.from(set);
  }, [timetable.entries]);

  const selectedNote = useMemo(() => {
    if (lectureNotes.notes.length === 0) return null;
    if (selectedNoteId !== null) {
      const found = lectureNotes.notes.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return lectureNotes.notes[0];
  }, [lectureNotes.notes, selectedNoteId]);

  const activeNoteForAi =
    section === 'notes'
      ? activeNoteDraft && selectedNote && activeNoteDraft.id === selectedNote.id
        ? activeNoteDraft
        : selectedNote
      : null;

  const handleCreateNote = useCallback(
    async (subjectName: string) => {
      const created = await lectureNotes.createNote({
        subjectName: subjectName || '未分類',
        title: '新しい講義ノート',
        contentMarkdown: `# ${subjectName || '講義'} メモ\n\n`,
      });
      setSelectedNoteId(created.id);
    },
    [lectureNotes],
  );

  const handleTogglePinNote = useCallback(
    async (note: LectureNote) => {
      await lectureNotes.updateNote(note.id, { isPinned: !note.isPinned });
    },
    [lectureNotes],
  );

  const handleDeleteNote = useCallback(
    async (note: LectureNote) => {
      if (!window.confirm(`ノート「${note.title}」を削除しますか？`)) return;
      await lectureNotes.deleteNote(note.id);
      if (selectedNoteId === note.id) {
        setSelectedNoteId(null);
      }
    },
    [lectureNotes, selectedNoteId],
  );

  const currentUser = auth.status === 'ready' ? auth.user : null;
  const googleIcalUrl = currentUser?.googleIcalUrl ?? loadOfflineIcalUrl();

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const openImport = useCallback(() => setImportOpen(true), []);

  const handleQuickSync = async () => {
    setQuickSyncing(true);
    try {
      await calendar.syncGoogle();
    } catch {
      setGoogleModalOpen(true);
    } finally {
      setQuickSyncing(false);
    }
  };

  const dashboard = (
    <Dashboard
      layouts={layouts}
      onLayoutChange={onLayoutChange}
      isEditing={isEditing}
      timetable={timetable}
      onOpenImport={openImport}
    />
  );

  const panel = 'flex h-[calc(100vh-7rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/90 p-4';

  const workspace = (() => {
    switch (section) {
      case 'calendar':
        return (
          <CalendarWorkspace
            view={calendarView}
            onViewChange={setCalendarView}
            anchorDate={anchorDate}
            onAnchorDateChange={setAnchorDate}
            events={calendar.events}
            loading={calendar.loading}
            offline={calendar.offline}
            error={calendar.error}
            layers={layers}
            onChangeLayers={setLayers}
            onOpenGoogleModal={() => setGoogleModalOpen(true)}
            onCreateEvent={calendar.createEvent}
            onUpdateEvent={calendar.updateEvent}
            onDeleteEvent={calendar.deleteEvent}
          />
        );
      case 'timetable':
        return <WeeklyTimetable entries={timetable.entries} source={timetable.source} />;
      case 'assignments':
        return (
          <div className={panel}>
            <AssignmentsWidget isEditing={false} />
          </div>
        );
      case 'notes':
        return (
          <NotebookWorkspace
            key={selectedNote?.id ?? 'empty'}
            note={selectedNote}
            subjectOptions={timetableSubjects}
            offline={lectureNotes.offline}
            onSave={lectureNotes.updateNote}
            onCreateNew={() => void handleCreateNote(timetableSubjects[0] ?? '未分類')}
            onDelete={(n) => void handleDeleteNote(n)}
            onDraftChange={setActiveNoteDraft}
          />
        );
      case 'memos':
        return (
          <div className={panel}>
            <MemoWidget isEditing={false} />
          </div>
        );
      case 'settings':
        return (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            ユーザー個人設定（API: <code className="text-slate-300">PATCH /api/me</code>）
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setAiSettingsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25"
              >
                <KeyRound className="h-3.5 w-3.5" />
                AI・API 個人設定（Gemini / Ollama）
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalOpen(true)}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
              >
                Google カレンダー iCal URL を設定
              </button>
            </div>
          </div>
        );
      default:
        return dashboard;
    }
  })();

  const tools = (
    <>
      {section === 'calendar' ? (
        <>
          {/* カレンダー表示時は「カレンダー設定」と「AI アシスタント」をタブ切替 */}
          <div className="grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCalendarRightTab('calendar')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition ${
                calendarRightTab === 'calendar'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              カレンダー設定
            </button>
            <button
              type="button"
              onClick={() => setCalendarRightTab('ai')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition ${
                calendarRightTab === 'ai'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="h-3.5 w-3.5 text-violet-400" />
              AI アシスタント
            </button>
          </div>

          {calendarRightTab === 'calendar' ? (
            <CalendarSidePanel
              layers={layers}
              onChangeLayers={setLayers}
              hasGoogleUrl={Boolean(googleIcalUrl)}
              syncing={quickSyncing}
              onOpenGoogleModal={() => setGoogleModalOpen(true)}
              onQuickSync={() => void handleQuickSync()}
            />
          ) : (
            <AiAssistantPanel user={currentUser} onOpenSettings={() => setAiSettingsOpen(true)} />
          )}
        </>
      ) : (
        <>
          <AiAssistantPanel
            user={currentUser}
            onOpenSettings={() => setAiSettingsOpen(true)}
            activeNote={activeNoteForAi}
          />

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Wrench className="h-3.5 w-3.5 text-cyan-400" />
              クイックアクション
            </h3>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setSection('notes')}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
              >
                <BookOpen className="h-3.5 w-3.5 text-cyan-300" />
                講義ノートブックを開く
              </button>
              <button
                type="button"
                onClick={() => setSection('calendar')}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
              >
                <Calendar className="h-3.5 w-3.5 text-emerald-300" />
                ハイブリッドカレンダーを開く
              </button>
              <button
                type="button"
                onClick={openImport}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
              >
                <FileUp className="h-3.5 w-3.5 text-blue-300" />
                PDFから時間割をAI取込
              </button>
              <button
                type="button"
                onClick={() => {
                  setSection('dashboard');
                  setIsEditing((v) => !v);
                }}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
              >
                {isEditing ? <Unlock className="h-3.5 w-3.5 text-blue-300" /> : <Lock className="h-3.5 w-3.5 text-slate-400" />}
                {isEditing ? 'レイアウト編集を終了' : 'レイアウトを編集'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <AppHeader
        auth={auth}
        onLogout={() => void logout()}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing((v) => !v)}
        onResetLayout={resetLayout}
        syncState={syncState}
        onOpenAiSettings={() => setAiSettingsOpen(true)}
      />

      {loginError && (
        <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-500/10 px-6 py-2 text-xs text-rose-300">
          Discord ログインに失敗しました（指定サーバーへの参加が必要な場合があります）。
          <button
            type="button"
            className="underline"
            onClick={() => {
              setLoginError(false);
              window.history.replaceState(null, '', window.location.pathname);
            }}
          >
            閉じる
          </button>
        </div>
      )}

      {viewMode === 'three-pane' ? (
        <ThreePaneShell
          activeSection={section}
          onSectionChange={setSection}
          leftSubPane={
            section === 'notes' ? (
              <NotebookExplorer
                notes={lectureNotes.notes}
                timetableSubjects={timetableSubjects}
                selectedNoteId={selectedNote?.id ?? null}
                offline={lectureNotes.offline}
                loading={lectureNotes.loading}
                onSelectNote={setSelectedNoteId}
                onCreateNote={(subject) => void handleCreateNote(subject)}
                onTogglePin={(n) => void handleTogglePinNote(n)}
                onDeleteNote={(n) => void handleDeleteNote(n)}
              />
            ) : undefined
          }
          tools={tools}
        >
          {workspace}
        </ThreePaneShell>
      ) : (
        <main className="flex-1 p-4">{dashboard}</main>
      )}

      {importOpen && <PdfImportModal onClose={() => setImportOpen(false)} onSave={timetable.saveEntries} />}

      {googleModalOpen && (
        <GoogleIcalModal
          initialUrl={googleIcalUrl}
          offline={calendar.offline}
          onClose={() => setGoogleModalOpen(false)}
          onSavedUrl={refreshAuth}
          onSync={calendar.syncGoogle}
        />
      )}

      {aiSettingsOpen && (
        <AiSettingsModal
          user={currentUser}
          offline={auth.status === 'offline'}
          onClose={() => setAiSettingsOpen(false)}
          onUpdated={refreshAuth}
        />
      )}
    </div>
  );
}
