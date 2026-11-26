import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, isNetworkError } from '../lib/api';
import type { LectureNote, LectureNoteInput } from '../types';

const OFFLINE_NOTES_KEY = 'satlas_lecture_notes_offline';
const WELCOME_SEEDED_KEY = 'satlas_notebook_welcome_seeded_v1';

export const WELCOME_NOTE_TITLE = 'ようこそ！SAtlas 講義ノートブック';

export const WELCOME_NOTE_MARKDOWN = `# 講義ノートの使い方ガイド

** Office風リボンバー ** や ** 右クリックメニュー ** から、Markdown の記法を覚えずに講義ノートを作成できます。ブロックをクリックするとそのまま編集できます。

## 1. KaTeX 数式ブロック
数式ブロックをクリックすると、分数・ルート・シグマ・積分・極限・ベクトルの記号パレットからワンクリック入力できます。

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## 2. ハイブリッドコード実行セル（Python / Java / C）
Python はそのままブラウザ内 WebAssembly (Pyodide) で実行できます。ローカルPCの \`runner/satlas_runner.py\` に接続すると Python / Java / C を高速に実行できます。

\`\`\`run:python
def fib(n: int) -> list[int]:
    a, b = 0, 1
    out = []
    for _ in range(n):
        out.append(a)
        a, b = b, a + b
    return out

print("フィボナッチ数列:", fib(8))
\`\`\`

## 3. やることチェックリスト
- [x] 左ペインで科目フォルダを確認する
- [ ] リボン「挿入」タブから手書きキャンバスを試す
- [ ] 右ペインの AI アシスタントで「ノートの要約」を押す
`;

  function createWelcomeNoteLocal(): LectureNote {
    const now = new Date().toISOString();
    return {
      id: 1,
      subjectName: '未分類',
      title: WELCOME_NOTE_TITLE,
      contentMarkdown: WELCOME_NOTE_MARKDOWN,
      tags: 'ガイド,KaTeX,Python',
      isPinned: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  function loadOfflineNotes(): LectureNote[] {
    try {
      const raw = localStorage.getItem(OFFLINE_NOTES_KEY);
      if (raw === null) {
        const initial = [createWelcomeNoteLocal()];
        localStorage.setItem(OFFLINE_NOTES_KEY, JSON.stringify(initial));
        localStorage.setItem(WELCOME_SEEDED_KEY, '1');
        return initial;
      }
      const parsed = JSON.parse(raw) as LectureNote[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveOfflineNotes(notes: LectureNote[]): void {
    localStorage.setItem(OFFLINE_NOTES_KEY, JSON.stringify(notes));
  }

  function sortNotes(list: LectureNote[]): LectureNote[] {
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    });
  }

  /**
   * 講義ノートの取得・CRUD を管理するフック。
   * - サーバー未接続時は localStorage に自動フォールバックする。
   * - 初回アクセス時にノートが0件の場合はウェルカムサンプルノートを自動生成する。
   */
  export function useNotes() {
    const [notes, setNotes] = useState<LectureNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [offline, setOffline] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const seedWelcomeIfNeeded = useCallback(async (list: LectureNote[]): Promise<LectureNote[]> => {
      if (list.length > 0 || localStorage.getItem(WELCOME_SEEDED_KEY) === '1') {
        return list;
      }
      localStorage.setItem(WELCOME_SEEDED_KEY, '1');
      try {
        const created = await api.post<LectureNote>('/api/notes', {
          subjectName: '未分類',
          title: WELCOME_NOTE_TITLE,
          contentMarkdown: WELCOME_NOTE_MARKDOWN,
          tags: 'ガイド,KaTeX,Python',
          isPinned: true,
        });
        return [created];
      } catch {
        return list;
      }
    }, []);

    const reload = useCallback(async () => {
      setError(null);
      try {
        const list = await api.get<LectureNote[]>('/api/notes');
        const seeded = await seedWelcomeIfNeeded(list);
        setNotes(sortNotes(seeded));
        setOffline(false);
      } catch (e) {
        if (isNetworkError(e)) {
          setOffline(true);
          setNotes(sortNotes(loadOfflineNotes()));
        } else {
          setError(errorMessage(e));
        }
      } finally {
        setLoading(false);
      }
  }, [seedWelcomeIfNeeded]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<LectureNote[]>('/api/notes')
      .then(async (list) => {
        if (cancelled) return;
        const seeded = await seedWelcomeIfNeeded(list);
        if (cancelled) return;
        setNotes(sortNotes(seeded));
        setOffline(false);
        setError(null);
      })
          .catch((e) => {
            if (cancelled) return;
            if (isNetworkError(e)) {
              setOffline(true);
              setNotes(sortNotes(loadOfflineNotes()));
            } else {
              setError(errorMessage(e));
            }
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
        return () => {
          cancelled = true;
        };
  }, [seedWelcomeIfNeeded]);

  const createNote = useCallback(
    async (input: LectureNoteInput): Promise<LectureNote> => {
      const payload: LectureNoteInput = {
        subjectName: input.subjectName?.trim() || '未分類',
        title: input.title?.trim() || '無題のノート',
        contentMarkdown: input.contentMarkdown ?? '',
        tags: input.tags ?? null,
        isPinned: Boolean(input.isPinned),
      };

        const createOffline = () => {
          const now = new Date().toISOString();
          const created: LectureNote = {
            id: Date.now(),
            subjectName: payload.subjectName!,
            title: payload.title!,
            contentMarkdown: payload.contentMarkdown!,
            tags: payload.tags ?? null,
            isPinned: Boolean(payload.isPinned),
            createdAt: now,
            updatedAt: now,
          };
          const next = sortNotes([created, ...loadOfflineNotes()]);
          saveOfflineNotes(next);
          setNotes(next);
          return created;
        };

        if (offline) {
          return createOffline();
        }

        try {
          const created = await api.post<LectureNote>('/api/notes', payload);
          setNotes((prev) => sortNotes([created, ...prev.filter((n) => n.id !== created.id)]));
          return created;
        } catch (e) {
          if (isNetworkError(e)) {
            setOffline(true);
            return createOffline();
          }
          throw e;
        }
      },
      [offline],
  );

  const updateNote = useCallback(
    async (id: number, patch: LectureNoteInput): Promise<LectureNote> => {
      const applyOffline = () => {
        const now = new Date().toISOString();
        const current = loadOfflineNotes();
        let updated: LectureNote | null = null;
        const nextList = current.map((n) => {
          if (n.id !== id) return n;
          updated = {
            ...n,
            subjectName: patch.subjectName !== undefined ? patch.subjectName.trim() || '未分類' : n.subjectName,
            title: patch.title !== undefined ? patch.title.trim() || '無題のノート' : n.title,
            contentMarkdown: patch.contentMarkdown !== undefined ? patch.contentMarkdown : n.contentMarkdown,
            tags: patch.tags !== undefined ? patch.tags : n.tags,
            isPinned: patch.isPinned !== undefined ? patch.isPinned : n.isPinned,
            updatedAt: now,
          };
          return updated;
        });
        if (!updated) {
          throw new Error('ノートが見つかりません');
        }
        const sorted = sortNotes(nextList);
        saveOfflineNotes(sorted);
        setNotes(sorted);
        return updated;
      };

      if (offline) {
        return applyOffline();
      }

      try {
        const updated = await api.patch<LectureNote>(`/api/notes/${id}`, patch);
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? updated : n))));
        return updated;
      } catch (e) {
        if (isNetworkError(e)) {
          setOffline(true);
          return applyOffline();
        }
        throw e;
      }
    },
    [offline],
  );

  const deleteNote = useCallback(
    async (id: number): Promise<void> => {
      const applyOffline = () => {
        const next = sortNotes(loadOfflineNotes().filter((n) => n.id !== id));
        saveOfflineNotes(next);
        setNotes(next);
      };

      if (offline) {
        applyOffline();
        return;
      }

      try {
        await api.del(`/api/notes/${id}`);
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } catch (e) {
        if (isNetworkError(e)) {
          setOffline(true);
          applyOffline();
          return;
        }
        throw e;
      }
    },
    [offline],
  );

  return {
    notes,
    loading,
    offline,
    error,
    reload,
    createNote,
    updateNote,
    deleteNote,
  };
}
