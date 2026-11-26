import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BookOpen, Check, LoaderCircle, Pin, Plus, Save, Tag, Trash2 } from 'lucide-react';
import {
CODE_LANGUAGE_META,
  isLocalRunnerConnected,
  subscribeRunnerStatus,
  type CodeLanguage,
} from '../../lib/codeRunner';
import {
  cloneBlock,
  convertBlockType,
  createCodeCellBlock,
  createLectureHeaderBlocks,
  createMathBlock,
  markdownToVisualBlocks,
  nextBlockId,
  visualBlocksToMarkdown,
  type VisualBlock,
} from '../../lib/notebookBlocks';
import type { LectureNote, LectureNoteInput } from '../../types';
import EditorContextMenu, { type ContextMenuState } from './EditorContextMenu';
import HandwritingCanvasModal from './HandwritingCanvasModal';
import NotebookPreview from './NotebookPreview';
import NotebookRibbon, { type WorkspaceViewMode } from './NotebookRibbon';
import NotebookTutorialModal from './NotebookTutorialModal';
import RunnerSettingsModal from './RunnerSettingsModal';
import VisualBlockEditor from './VisualBlockEditor';

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface Props {
  note: LectureNote | null;
  subjectOptions: string[];
  offline: boolean;
  onSave: (id: number, patch: LectureNoteInput) => Promise<LectureNote>;
  onCreateNew: () => void;
  onDelete: (note: LectureNote) => void;
  /** 編集中（未保存含む）の最新ノート状態を右ペインの AI 連携へ伝える */
  onDraftChange?: (draft: LectureNote | null) => void;
}

const AUTOSAVE_DELAY_MS = 800;
const TUTORIAL_SEEN_KEY = 'satlas_notebook_tutorial_seen_v1';

/**
 * 講義用ノートブックの中央ワークスペース。
 * Office 風リボンバー・ビジュアルブロック編集（デフォルト）・Markdown ソース編集・
 * 右クリックメニュー・手書きキャンバス・ローカルランナー設定・チュートリアルを統合する。
 */
export default function NotebookWorkspace({
  note,
  subjectOptions,
  offline,
  onSave,
  onCreateNew,
  onDelete,
  onDraftChange,
}: Props) {
  const [title, setTitle] = useState(() => note?.title ?? '');
  const [subjectName, setSubjectName] = useState(() => note?.subjectName ?? '未分類');
  const [customSubjectMode, setCustomSubjectMode] = useState(false);
  const [tags, setTags] = useState(() => note?.tags ?? '');
  const [contentMarkdown, setContentMarkdown] = useState(() => note?.contentMarkdown ?? '');
  const [blocks, setBlocks] = useState<VisualBlock[]>(() => markdownToVisualBlocks(note?.contentMarkdown ?? ''));
  const [isPinned, setIsPinned] = useState(() => note?.isPinned ?? false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('visual');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [handwritingOpen, setHandwritingOpen] = useState(false);
  const [runnerModalOpen, setRunnerModalOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(() => localStorage.getItem(TUTORIAL_SEEN_KEY) !== '1');

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);

  const localRunnerConnected = useSyncExternalStore(subscribeRunnerStatus, isLocalRunnerConnected, () => false);

  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [lastSaved, setLastSaved] = useState(() => ({
    title: note?.title ?? '',
    subjectName: note?.subjectName ?? '未分類',
    tags: note?.tags ?? '',
    contentMarkdown: note?.contentMarkdown ?? '',
    isPinned: note?.isPinned ?? false,
  }));

  const mergedSubjects = useMemo(() => {
    const set = new Set<string>(['未分類', ...subjectOptions]);
    if (subjectName.trim()) set.add(subjectName.trim());
    return Array.from(set);
  }, [subjectOptions, subjectName]);

  // 編集中ドラフトを親（AI パネル連携）へ通知
  useEffect(() => {
    if (!note) {
      onDraftChange?.(null);
      return;
    }
    onDraftChange?.({
      ...note,
      title,
      subjectName,
      tags: tags.trim() ? tags : null,
      contentMarkdown,
      isPinned,
    });
  }, [note, title, subjectName, tags, contentMarkdown, isPinned, onDraftChange]);

  const isDirty =
    note !== null &&
    (title !== lastSaved.title ||
      subjectName !== lastSaved.subjectName ||
      tags !== lastSaved.tags ||
      contentMarkdown !== lastSaved.contentMarkdown ||
      isPinned !== lastSaved.isPinned);

  const performSave = useCallback(async () => {
    if (!note) return;
    setSaveStatus('saving');
    setSaveError(null);
    const patch: LectureNoteInput = {
      title: title.trim() || '無題のノート',
      subjectName: subjectName.trim() || '未分類',
      tags: tags.trim() ? tags.trim() : null,
      contentMarkdown,
      isPinned,
    };
    try {
      const saved = await onSave(note.id, patch);
      setLastSaved({
        title: saved.title,
        subjectName: saved.subjectName,
        tags: saved.tags ?? '',
        contentMarkdown: saved.contentMarkdown,
        isPinned: saved.isPinned,
      });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }, [note, title, subjectName, tags, contentMarkdown, isPinned, onSave]);

  // デバウンス自動保存
  useEffect(() => {
    if (!note || !isDirty) return;
    const timer = window.setTimeout(() => {
      void performSave();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [note, isDirty, performSave]);

      /** ビジュアルブロック配列を更新し、Markdown 文字列へ同期する */
      const applyBlocks = useCallback((updater: (prev: VisualBlock[]) => VisualBlock[]) => {
        setBlocks((prev) => {
          const next = updater(prev);
          const safeNext = next.length > 0 ? next : [{ id: nextBlockId(), type: 'paragraph' as const, text: '' }];
          setContentMarkdown(visualBlocksToMarkdown(safeNext));
          setSaveStatus('dirty');
          return safeNext;
        });
      }, []);

      /** ビジュアル / Markdown ソースモード切替 */
      const handleChangeViewMode = (nextMode: WorkspaceViewMode) => {
        if (nextMode === viewMode) return;
        if (nextMode === 'visual') {
          setBlocks(markdownToVisualBlocks(contentMarkdown));
        }
        setViewMode(nextMode);
      };

      /** 選択ブロックの後ろ（未選択時は末尾）にブロック群を挿入 */
      const insertBlocksAfterSelection = useCallback(
        (newBlocks: VisualBlock[], autoEditFirst = false) => {
          if (viewMode === 'markdown') {
            const snippet = visualBlocksToMarkdown(newBlocks);
            const el = sourceTextareaRef.current;
            if (el) {
              const start = el.selectionStart ?? contentMarkdown.length;
              const end = el.selectionEnd ?? contentMarkdown.length;
              const nextMd = `${contentMarkdown.slice(0, start)}\n${snippet}\n${contentMarkdown.slice(end)}`;
              setContentMarkdown(nextMd);
              setSaveStatus('dirty');
            } else {
              setContentMarkdown((prev) => `${prev}${prev ? '\n\n' : ''}${snippet}`);
              setSaveStatus('dirty');
            }
            return;
          }

          applyBlocks((prev) => {
            const idx = selectedBlockId ? prev.findIndex((b) => b.id === selectedBlockId) : -1;
            if (idx === -1) {
              return [...prev, ...newBlocks];
            }
            const next = [...prev];
            next.splice(idx + 1, 0, ...newBlocks);
            return next;
          });

          const first = newBlocks[0];
          if (first) {
            setSelectedBlockId(first.id);
            if (autoEditFirst) {
              setEditingBlockId(first.id);
            }
          }
        },
        [viewMode, contentMarkdown, selectedBlockId, applyBlocks],
      );

      const handleFormatBlock = (
        target: 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet-list' | 'ordered-list' | 'checklist' | 'quote',
      ) => {
        if (viewMode === 'markdown') {
          const prefixMap: Record<typeof target, string> = {
            paragraph: '',
            h1: '# ',
            h2: '## ',
            h3: '### ',
            'bullet-list': '- ',
            'ordered-list': '1. ',
            checklist: '- [ ] ',
            quote: '> ',
          };
          setContentMarkdown((prev) => `${prev}${prev.endsWith('\n') || !prev ? '' : '\n'}${prefixMap[target]}`);
          setSaveStatus('dirty');
          return;
        }

          const targetId = selectedBlockId ?? blocks[blocks.length - 1]?.id ?? null;
          if (!targetId) return;
          applyBlocks((prev) => prev.map((b) => (b.id === targetId ? convertBlockType(b, target) : b)));
          setSelectedBlockId(targetId);
          setEditingBlockId(targetId);
        };

        const handleWrapInline = (prefix: string, suffix: string, placeholder: string) => {
          if (viewMode === 'markdown') {
            const el = sourceTextareaRef.current;
            if (el) {
              const start = el.selectionStart ?? contentMarkdown.length;
              const end = el.selectionEnd ?? contentMarkdown.length;
              const selected = contentMarkdown.slice(start, end) || placeholder;
              const nextMd = `${contentMarkdown.slice(0, start)}${prefix}${selected}${suffix}${contentMarkdown.slice(end)}`;
              setContentMarkdown(nextMd);
              setSaveStatus('dirty');
              return;
            }
          }

          const targetId = selectedBlockId ?? blocks[blocks.length - 1]?.id ?? null;
          if (!targetId) return;
          applyBlocks((prev) =>
            prev.map((b) => {
              if (b.id !== targetId) return b;
              const wrapped = `${prefix}${placeholder}${suffix}`;
              if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
                return { ...b, text: `${b.text}${b.text ? ' ' : ''}${wrapped}` };
              }
              return b;
            }),
          );
          setEditingBlockId(targetId);
        };

        const handleMoveBlock = (direction: -1 | 1) => {
          if (!selectedBlockId) return;
          applyBlocks((prev) => {
            const idx = prev.findIndex((b) => b.id === selectedBlockId);
            const nextIdx = idx + direction;
            if (idx === -1 || nextIdx < 0 || nextIdx >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(idx, 1);
            copy.splice(nextIdx, 0, moved);
            return copy;
          });
        };

          const handleDeleteSelectedBlock = () => {
            if (!selectedBlockId) return;
            applyBlocks((prev) => prev.filter((b) => b.id !== selectedBlockId));
            setSelectedBlockId(null);
            setEditingBlockId(null);
          };

          const handleDuplicateSelectedBlock = () => {
            if (!selectedBlockId) return;
            let clonedId: string | null = null;
            applyBlocks((prev) => {
              const idx = prev.findIndex((b) => b.id === selectedBlockId);
              if (idx === -1) return prev;
              const cloned = cloneBlock(prev[idx]);
              clonedId = cloned.id;
              const next = [...prev];
              next.splice(idx + 1, 0, cloned);
              return next;
            });
            if (clonedId) setSelectedBlockId(clonedId);
          };

          const handleInsertCodeCell = (lang: CodeLanguage) => {
            if (viewMode === 'markdown') {
              const tpl = CODE_LANGUAGE_META[lang].template;
              setContentMarkdown((prev) => `${prev}${prev ? '\n\n' : ''}\`\`\`run:${lang}\n${tpl}\n\`\`\`\n`);
              setSaveStatus('dirty');
              return;
            }
            insertBlocksAfterSelection([createCodeCellBlock(lang)], false);
          };

          const handleInsertMath = () => {
            insertBlocksAfterSelection([createMathBlock()], true);
          };

          const handleInsertDrawing = (dataUrl: string, caption: string) => {
            insertBlocksAfterSelection([{ id: nextBlockId(), type: 'drawing', dataUrl, caption }], false);
          };

          const handleInsertDivider = () => {
            insertBlocksAfterSelection([{ id: nextBlockId(), type: 'divider' }], false);
          };

          const handleInsertLectureHeader = () => {
            insertBlocksAfterSelection(createLectureHeaderBlocks(subjectName), true);
          };

          const handleAddParagraphAfter = (afterId?: string) => {
            const newPara: VisualBlock = { id: nextBlockId(), type: 'paragraph', text: '' };
            applyBlocks((prev) => {
              if (!afterId) return [...prev, newPara];
              const idx = prev.findIndex((b) => b.id === afterId);
              if (idx === -1) return [...prev, newPara];
              const next = [...prev];
              next.splice(idx + 1, 0, newPara);
              return next;
            });
            setSelectedBlockId(newPara.id);
            setEditingBlockId(newPara.id);
          };

          const handleOpenContextMenu = (e: React.MouseEvent, blockId: string | null) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, blockId });
          };

          const closeTutorial = () => {
            localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
            setTutorialOpen(false);
          };

          if (!note) {
            return (
              <div className="flex h-[calc(100vh-7rem)] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-cyan-400/70" />
                <h2 className="text-base font-semibold text-slate-200">講義ノートを選択または新規作成</h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                  Office風リボンバーと右クリックメニューから、KaTeX 数式・手書き図解・Python / Java / C コード実行セルを含む講義ノートを直感的に作成できます。
                </p>
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  新しい講義ノートを作成
                </button>
              </div>
            );
          }

          return (
            <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90">
              {/* ヘッダー：タイトル・科目・タグ・保存インジケーター */}
                <div className="space-y-2 border-b border-slate-800 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setSaveStatus('dirty');
                      }}
                      placeholder="ノートタイトルを入力..."
                      className="min-w-0 flex-1 bg-transparent text-base font-bold text-white placeholder:text-slate-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-400">
                        {saveStatus === 'saving' ? (
                          <>
                            <LoaderCircle className="h-3 w-3 animate-spin text-cyan-400" />
                            保存中...
                          </>
                        ) : saveStatus === 'error' ? (
                          <span className="text-rose-400">{saveError ?? '保存エラー'}</span>
                        ) : isDirty ? (
                          <span className="text-amber-300">未保存（自動保存待ち）</span>
                        ) : (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            {offline ? 'ローカル保存済み' : '保存済み'}
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => void performSave()}
                        disabled={saveStatus === 'saving'}
                        className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                        title="手動で今すぐ保存"
                      >
                        <Save className="h-3.5 w-3.5 text-cyan-400" />
                        保存
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPinned((v) => !v);
                          setSaveStatus('dirty');
                        }}
                        className={`rounded-lg border p-1.5 transition ${isPinned
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        title={isPinned ? 'ピン留め解除' : 'ピン留め'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(note)}
                        className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
                        title="このノートを削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 科目選択・タグ */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">科目:</span>
                      {customSubjectMode ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={subjectName}
                            onChange={(e) => {
                              setSubjectName(e.target.value);
                              setSaveStatus('dirty');
                            }}
                            placeholder="任意フォルダ名"
                            className="w-36 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomSubjectMode(false)}
                            className="rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-200"
                          >
                            一覧へ
                          </button>
                        </div>
                      ) : (
                        <select
                          value={subjectName}
                          onChange={(e) => {
                            if (e.target.value === '__CUSTOM__') {
                              setCustomSubjectMode(true);
                              return;
                            }
                            setSubjectName(e.target.value);
                            setSaveStatus('dirty');
                          }}
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                        >
                          {mergedSubjects.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          <option value="__CUSTOM__">+ 任意フォルダ名を入力...</option>
                        </select>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => {
                          setTags(e.target.value);
                          setSaveStatus('dirty');
                        }}
                        placeholder="タグ（カンマ区切り 例: 試験範囲,微分積分）"
                        className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                  {/* Office 風リボンバー */}
                  <NotebookRibbon
                    viewMode={viewMode}
                    hasSelection={selectedBlockId !== null}
                    localRunnerConnected={localRunnerConnected}
                    onChangeViewMode={handleChangeViewMode}
                    onFormatBlock={handleFormatBlock}
                    onWrapInline={handleWrapInline}
                    onMoveBlockUp={() => handleMoveBlock(-1)}
                    onMoveBlockDown={() => handleMoveBlock(1)}
                    onDeleteBlock={handleDeleteSelectedBlock}
                    onInsertMath={handleInsertMath}
                    onInsertCodeCell={handleInsertCodeCell}
                    onOpenHandwriting={() => setHandwritingOpen(true)}
                    onInsertDivider={handleInsertDivider}
                    onInsertLectureHeader={handleInsertLectureHeader}
                    onOpenRunnerSettings={() => setRunnerModalOpen(true)}
                    onOpenTutorial={() => setTutorialOpen(true)}
                  />

                    {/* メイン編集領域：ビジュアルブロック編集（デフォルト） / Markdown ソース分割編集 */}
                    {viewMode === 'visual' ? (
                      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-900/40">
                        <VisualBlockEditor
                          blocks={blocks}
                          selectedBlockId={selectedBlockId}
                          editingBlockId={editingBlockId}
                          onSelectBlock={setSelectedBlockId}
                          onStartEditBlock={setEditingBlockId}
                          onStopEditBlock={() => setEditingBlockId(null)}
                          onUpdateBlock={(id, updater) => applyBlocks((prev) => prev.map((b) => (b.id === id ? updater(b) : b)))}
                          onAddParagraphAfter={handleAddParagraphAfter}
                          onOpenContextMenu={handleOpenContextMenu}
                          onOpenRunnerSettings={() => setRunnerModalOpen(true)}
                        />
                      </div>
      ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-800 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
                      <textarea
                        ref={sourceTextareaRef}
                        value={contentMarkdown}
                        onChange={(e) => {
                          setContentMarkdown(e.target.value);
                          setSaveStatus('dirty');
                        }}
                        onContextMenu={(e) => handleOpenContextMenu(e, null)}
                        spellCheck={false}
                        placeholder="# Markdown ソースを入力..."
                        className="h-full w-full resize-none bg-slate-950/60 p-4 font-mono text-xs leading-6 text-slate-100 placeholder:text-slate-600 focus:outline-none"
                      />
                        <div className="min-h-0 overflow-y-auto bg-slate-900/40 p-5">
                          <NotebookPreview
                            markdown={contentMarkdown}
                            onChangeMarkdown={(nextMd) => {
                              setContentMarkdown(nextMd);
                              setSaveStatus('dirty');
                            }}
                          />
                        </div>
                  </div>
      )}

                  {/* 右クリック・コンテキストメニュー */}
                  {contextMenu && (
                    <EditorContextMenu
                      menu={contextMenu}
                      onClose={() => setContextMenu(null)}
                      onInsertMath={handleInsertMath}
                      onInsertCodeCell={handleInsertCodeCell}
                      onOpenHandwriting={() => setHandwritingOpen(true)}
                      onConvertBlock={(target) => handleFormatBlock(target)}
                      onDuplicateBlock={handleDuplicateSelectedBlock}
                      onDeleteBlock={handleDeleteSelectedBlock}
                    />
                  )}

                  {/* 手書きキャンバスモーダル */}
                  {handwritingOpen && (
                    <HandwritingCanvasModal
                      onClose={() => setHandwritingOpen(false)}
                      onInsert={handleInsertDrawing}
                    />
                  )}

                  {/* ローカルランナー接続設定モーダル */}
                  {runnerModalOpen && <RunnerSettingsModal onClose={() => setRunnerModalOpen(false)} />}

                  {/* 使い方チュートリアルモーダル */}
                  {tutorialOpen && <NotebookTutorialModal onClose={closeTutorial} />}
                </div>
                );
}
