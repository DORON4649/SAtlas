import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, isNetworkError } from '../lib/api';
import {
  DEFAULT_SECTION_COLOR,
  DEFAULT_SECTION_NAME,
  createEmptyPageContent,
  createSampleOneNoteContent,
  serializeOneNoteContent,
} from '../lib/oneNoteModel';
import type { LectureNote, LectureNoteInput } from '../types';

const OFFLINE_NOTES_KEY = 'satlas_lecture_notes_onenote_v2';
const WELCOME_SEEDED_KEY = 'satlas_onenote_welcome_seeded_v2';

export const WELCOME_NOTE_TITLE = 'ようこそ！SAtlas OneNote 講義ノート';

function createWelcomeNoteLocal(): LectureNote {
  const now = new Date().toISOString();
  return {
    id: 1,
    subjectName: '未分類',
    sectionName: '講義ノート',
    sectionColor: DEFAULT_SECTION_COLOR,
    title: WELCOME_NOTE_TITLE,
    contentJson: serializeOneNoteContent(createSampleOneNoteContent()),
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
 * OneNote 風講義ノートの取得・CRUD を管理するフック。
 * - サーバー未接続時は localStorage に自動フォールバック。
 * - 初回アクセス時にノートが 0 件ならサンプルページを自動生成。
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
        sectionName: '講義ノート',
        sectionColor: DEFAULT_SECTION_COLOR,
        title: WELCOME_NOTE_TITLE,
        contentJson: serializeOneNoteContent(createSampleOneNoteContent()),
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
        sectionName: input.sectionName?.trim() || DEFAULT_SECTION_NAME,
        sectionColor: input.sectionColor || DEFAULT_SECTION_COLOR,
        title: input.title?.trim() || '無題のページ',
        contentJson: input.contentJson ?? serializeOneNoteContent(createEmptyPageContent('grid')),
        isPinned: Boolean(input.isPinned),
      };

      const createOffline = () => {
        const now = new Date().toISOString();
        const created: LectureNote = {
          id: Date.now(),
          subjectName: payload.subjectName!,
          sectionName: payload.sectionName!,
          sectionColor: payload.sectionColor!,
          title: payload.title!,
          contentJson: payload.contentJson!,
          isPinned: Boolean(payload.isPinned),
          createdAt: now,
          updatedAt: now,
        };
        const next = sortNotes([created, ...loadOfflineNotes()]);
        saveOfflineNotes(next);
        setNotes(next);
        return created;
      };

      if (offline) return createOffline();

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
            sectionName:
              patch.sectionName !== undefined ? patch.sectionName.trim() || DEFAULT_SECTION_NAME : n.sectionName,
            sectionColor: patch.sectionColor !== undefined ? patch.sectionColor : n.sectionColor,
            title: patch.title !== undefined ? patch.title.trim() || '無題のページ' : n.title,
            contentJson: patch.contentJson !== undefined ? patch.contentJson : n.contentJson,
            isPinned: patch.isPinned !== undefined ? patch.isPinned : n.isPinned,
            updatedAt: now,
          };
          return updated;
        });
        if (!updated) throw new Error('ノートが見つかりません');
        const sorted = sortNotes(nextList);
        saveOfflineNotes(sorted);
        setNotes(sorted);
        return updated;
      };

      if (offline) return applyOffline();

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

  return { notes, loading, offline, error, reload, createNote, updateNote, deleteNote };
}
