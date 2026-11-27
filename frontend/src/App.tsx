import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Bot, Calendar, CalendarDays, FileUp, Layers, Lock, Unlock, Wrench } from 'lucide-react';
import AiAssistantPanel from './components/ai/AiAssistantPanel';
import AiSettingsModal from './components/ai/AiSettingsModal';
import CalendarSidePanel from './components/calendar/CalendarSidePanel';
import CalendarWorkspace from './components/calendar/CalendarWorkspace';
import GoogleIcalModal from './components/calendar/GoogleIcalModal';
import Dashboard from './components/dashboard/Dashboard';
import AppHeader from './components/layout/AppHeader';
import ThreePaneShell from './components/layout/ThreePaneShell';
import { normalizeNavSection, type NavSection } from './components/layout/shellTypes';
import NotebookExplorer from './components/notebook/NotebookExplorer';
import OneNoteWorkspace from './components/notebook/OneNoteWorkspace';
import SettingsView from './components/settings/SettingsView';
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
  applyDocumentTheme,
  loadAppSettings,
  loadNavState,
  saveAppSettings,
  saveNavState,
  type AppSettings,
} from './lib/appSettings';
import {
  DEFAULT_LAYERS,
  getVisibleRange,
  type CalendarLayerFilter,
  type CalendarViewMode,
} from './lib/calendar';
import {
  DEFAULT_SECTION_COLOR,
  DEFAULT_SECTION_NAME,
  createEmptyPageContent,
  serializeOneNoteContent,
} from './lib/oneNoteModel';
import type { LectureNote } from './types';

const LEFT_PANE_KEY = 'satlas_left_pane_open';
const RIGHT_PANE_KEY = 'satlas_right_pane_open';
const TUTORIAL_SEEN_KEY = 'satlas_onenote_tutorial_seen_v2';

function resolveInitialSection(settings: AppSettings): NavSection {
  if (settings.startupView !== 'last') {
    return settings.startupView;
  }
  if (window.location.hash && window.location.hash.length > 1) {
    return normalizeNavSection(window.location.hash);
  }
  return normalizeNavSection(loadNavState().section);
}

export default function App() {
  const { auth, refresh: refreshAuth, logout } = useAuth();
  const timetable = useTimetable();
  const { layouts, onLayoutChange, resetLayout, syncState } = useDashboardLayout();

  // アプリ統合設定＆テーマ
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
  );
  const resolvedTheme: 'dark' | 'light' =
    appSettings.themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : appSettings.themeMode;

  const updateAppSettings = useCallback((patch: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAppSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    applyDocumentTheme(appSettings.themeMode);
  }, [appSettings.themeMode, systemPrefersDark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleThemeQuick = useCallback(() => {
    updateAppSettings({ themeMode: resolvedTheme === 'dark' ? 'light' : 'dark' });
  }, [resolvedTheme, updateAppSettings]);

  // 3ペイン開閉状態（リロード復元 + 設定デフォルトフォールバック）
  const [leftPaneOpen, setLeftPaneOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(LEFT_PANE_KEY);
    if (stored !== null) return stored !== '0';
    return loadAppSettings().defaultLeftPaneOpen;
  });
  const [rightPaneOpen, setRightPaneOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(RIGHT_PANE_KEY);
    if (stored !== null) return stored !== '0';
    return loadAppSettings().defaultRightPaneOpen;
  });

  // ナビゲーション＆選択ノート状態（リロード完全復元 + URL ハッシュ同期）
  const [section, setSectionState] = useState<NavSection>(() => resolveInitialSection(loadAppSettings()));
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(() => loadNavState().selectedNoteId);
  const [activeNoteDraft, setActiveNoteDraft] = useState<LectureNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [calendarRightTab, setCalendarRightTab] = useState<'calendar' | 'ai'>('calendar');
  const [loginError, setLoginError] = useState(() => new URLSearchParams(window.location.search).has('login_error'));

  const setSection = useCallback((next: NavSection) => {
    setSectionState(next);
    const targetHash = `#/${next}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, []);

  // ブラウザの戻る／進む（hashchange）に追従
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash) {
        setSectionState(normalizeNavSection(window.location.hash));
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 初回ハッシュ同期 & localStorage へリアルタイム保存
  const lectureNotes = useNotes();
  const selectedNote = useMemo(() => {
    if (lectureNotes.notes.length === 0) return null;
    if (selectedNoteId !== null) {
      const found = lectureNotes.notes.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return lectureNotes.notes[0];
  }, [lectureNotes.notes, selectedNoteId]);

  useEffect(() => {
    saveNavState({
      section,
      selectedNoteId: selectedNote?.id ?? selectedNoteId,
      selectedSubject: selectedNote?.subjectName ?? null,
      selectedSection: selectedNote?.sectionName ?? null,
    });
    const targetHash = `#/${section}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [section, selectedNote, selectedNoteId]);

  const toggleLeftPane = useCallback(() => {
    setLeftPaneOpen((prev) => {
      const next = !prev;
      localStorage.setItem(LEFT_PANE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const toggleRightPane = useCallback(() => {
    setRightPaneOpen((prev) => {
      const next = !prev;
      localStorage.setItem(RIGHT_PANE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  // Ctrl + \ で左ペインをトグル
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.code === 'Backslash')) {
        e.preventDefault();
        toggleLeftPane();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleLeftPane]);

  // カレンダー状態
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [layers, setLayers] = useState<CalendarLayerFilter>(DEFAULT_LAYERS);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [quickSyncing, setQuickSyncing] = useState(false);

  const visibleRange = useMemo(() => getVisibleRange(anchorDate, calendarView), [anchorDate, calendarView]);
  const calendar = useCalendar(visibleRange.start, visibleRange.end);

  const timetableSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const entry of timetable.entries) {
      if (entry.subject.trim()) set.add(entry.subject.trim());
    }
    return Array.from(set);
  }, [timetable.entries]);

  const activeNoteForAi =
    section === 'notes'
      ? activeNoteDraft && selectedNote && activeNoteDraft.id === selectedNote.id
        ? activeNoteDraft
        : selectedNote
      : null;

  const handleCreatePage = useCallback(
    async (
      subjectName: string,
      sectionName: string = DEFAULT_SECTION_NAME,
      sectionColor: string = DEFAULT_SECTION_COLOR,
    ) => {
      const created = await lectureNotes.createNote({
        subjectName: subjectName || '未分類',
        sectionName,
        sectionColor,
        title: '新しいページ',
        contentJson: serializeOneNoteContent(createEmptyPageContent(appSettings.defaultPageBackground)),
      });
      setSelectedNoteId(created.id);
    },
    [lectureNotes, appSettings.defaultPageBackground],
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

  const handleImportBackup = useCallback(
    async (data: { settings?: Partial<AppSettings>; notes?: LectureNote[] }): Promise<number> => {
      if (data.settings) {
        updateAppSettings(data.settings);
      }
      let importedCount = 0;
      if (Array.isArray(data.notes)) {
        for (const n of data.notes) {
          await lectureNotes.createNote({
            subjectName: n.subjectName || '未分類',
            sectionName: n.sectionName || DEFAULT_SECTION_NAME,
            sectionColor: n.sectionColor || DEFAULT_SECTION_COLOR,
            title: n.title || '復元されたページ',
            contentJson: n.contentJson || serializeOneNoteContent(createEmptyPageContent('grid')),
            isPinned: Boolean(n.isPinned),
          });
          importedCount++;
        }
      }
      return importedCount;
    },
    [lectureNotes, updateAppSettings],
  );

  const currentUser = auth.status === 'ready' ? auth.user : null;
  const googleIcalUrl = currentUser?.googleIcalUrl ?? loadOfflineIcalUrl();
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

  // ホーム（ダッシュボード）ビュー：直近ノート＆時間割クイック遷移＋カスタマイズグリッド
  const recentNotes = lectureNotes.notes.slice(0, 4);
  const homeWorkspace = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
              <BookOpen className="h-4 w-4" />
              直近の講義ノート
            </span>
            <button
              type="button"
              onClick={() => setSection('notes')}
              className="text-[11px] text-slate-400 hover:text-indigo-400"
            >
              すべて開く →
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-xs text-slate-500">まだノートがありません。</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {recentNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedNoteId(n.id);
                    setSection('notes');
                  }}
                  style={{ borderLeftColor: n.sectionColor || DEFAULT_SECTION_COLOR }}
                  className="rounded-lg border border-l-4 border-slate-800 bg-slate-950/50 px-2.5 py-2 text-left transition-colors hover:bg-slate-800"
                >
                  <div className="truncate text-xs font-semibold text-slate-100">{n.title || '無題のページ'}</div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                    {n.subjectName} / {n.sectionName}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
              <CalendarDays className="h-4 w-4" />
              クイックナビゲーション
            </span>
            <span className="text-[11px] text-slate-500">登録科目 {timetableSubjects.length} 件</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSection('timetable')}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              <CalendarDays className="h-4 w-4 text-blue-400" />
              週間時間割を見る
            </button>
            <button
              type="button"
              onClick={() => setSection('calendar')}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              <Calendar className="h-4 w-4 text-emerald-400" />
              ハイブリッドカレンダー
            </button>
          </div>
        </div>
      </div>

      <Dashboard
        layouts={layouts}
        onLayoutChange={onLayoutChange}
        isEditing={isEditing}
        timetable={timetable}
        onOpenImport={openImport}
      />
    </div>
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
          <OneNoteWorkspace
            key={selectedNote?.id ?? 'empty'}
            note={selectedNote}
            offline={lectureNotes.offline}
            leftPaneOpen={leftPaneOpen}
            rightPaneOpen={rightPaneOpen}
            codeTabSize={appSettings.codeTabSize}
            codeAutoClosePairs={appSettings.codeAutoClosePairs}
            onToggleLeftPane={toggleLeftPane}
            onToggleRightPane={toggleRightPane}
            onSave={lectureNotes.updateNote}
            onCreateNew={() =>
              void handleCreatePage(timetableSubjects[0] ?? '未分類', '講義ノート', DEFAULT_SECTION_COLOR)
            }
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
          <SettingsView
            settings={appSettings}
            onUpdateSettings={updateAppSettings}
            auth={auth}
            onRefreshAuth={refreshAuth}
            onLogout={() => void logout()}
            leftPaneOpen={leftPaneOpen}
            rightPaneOpen={rightPaneOpen}
            notes={lectureNotes.notes}
            onImportBackup={handleImportBackup}
            onOpenGoogleModal={() => setGoogleModalOpen(true)}
            onReplayTutorial={() => {
              localStorage.removeItem(TUTORIAL_SEEN_KEY);
              setSection('notes');
            }}
          />
        );
      default:
        return homeWorkspace;
    }
  })();

  const tools = (
    <>
      {section === 'calendar' ? (
        <>
          <div className="grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCalendarRightTab('calendar')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-colors ${
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
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-colors ${
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
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700"
              >
                <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                講義ノートブックを開く
              </button>
              <button
                type="button"
                onClick={() => setSection('calendar')}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700"
              >
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                ハイブリッドカレンダーを開く
              </button>
              <button
                type="button"
                onClick={openImport}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700"
              >
                <FileUp className="h-3.5 w-3.5 text-blue-400" />
                PDFから時間割をAI取込
              </button>
              <button
                type="button"
                onClick={() => {
                  setSection('home');
                  setIsEditing((v) => !v);
                }}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700"
              >
                {isEditing ? <Unlock className="h-3.5 w-3.5 text-blue-400" /> : <Lock className="h-3.5 w-3.5 text-slate-400" />}
                {isEditing ? 'レイアウト編集を終了' : 'ホームレイアウトを編集'}
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
        activeSection={section}
        leftPaneOpen={leftPaneOpen}
        rightPaneOpen={rightPaneOpen}
        onToggleLeftPane={toggleLeftPane}
        onToggleRightPane={toggleRightPane}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleThemeQuick}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing((v) => !v)}
        onResetLayout={resetLayout}
        syncState={syncState}
        onOpenAiSettings={() => setAiSettingsOpen(true)}
      />

      {loginError && (
        <div className="flex items-center justify-between border-b border-rose-500/30 bg-rose-500/10 px-6 py-2 text-xs text-rose-400">
          Discord ログインに失敗しました（指定サーバーへの参加が必要な場合があります）。
          <button
            type="button"
            className="underline"
            onClick={() => {
              setLoginError(false);
              window.history.replaceState(null, '', window.location.pathname + window.location.hash);
            }}
          >
            閉じる
          </button>
        </div>
      )}

      {/* 常に 3 ペイン構成（ThreePaneShell）で表示 */}
      <ThreePaneShell
        activeSection={section}
        onSectionChange={setSection}
        leftPaneOpen={leftPaneOpen}
        rightPaneOpen={rightPaneOpen}
        leftSubPane={
          section === 'notes' ? (
            <NotebookExplorer
              notes={lectureNotes.notes}
              timetableSubjects={timetableSubjects}
              selectedNoteId={selectedNote?.id ?? null}
              offline={lectureNotes.offline}
              loading={lectureNotes.loading}
              onSelectNote={setSelectedNoteId}
              onCreatePage={(subject, sec, color) => void handleCreatePage(subject, sec, color)}
              onTogglePin={(n) => void handleTogglePinNote(n)}
              onDeleteNote={(n) => void handleDeleteNote(n)}
            />
          ) : undefined
        }
        tools={tools}
      >
        {workspace}
      </ThreePaneShell>

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
