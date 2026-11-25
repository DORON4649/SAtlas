import { useEffect, useState } from 'react';
import { Plus, Share2, StickyNote, Users, WifiOff } from 'lucide-react';
import { api, errorMessage, isNetworkError } from '../../lib/api';
import type { Memo } from '../../types';
import WidgetHeader from './WidgetHeader';

const OFFLINE_KEY = 'satlas_memos_offline';

const loadOffline = (): Memo[] => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? '[]') as Memo[];
  } catch {
    return [];
  }
};

export default function MemoWidget({ isEditing }: { isEditing: boolean }) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeShared, setIncludeShared] = useState(false);
  const [content, setContent] = useState('');
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Memo[]>(`/api/memos?includeShared=${includeShared}`)
      .then((list) => {
        if (cancelled) return;
        setMemos(list);
        setOffline(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isNetworkError(e)) {
          setOffline(true);
          setMemos(loadOffline());
        } else {
          setError(errorMessage(e));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [includeShared]);

  const add = async () => {
    if (!content.trim()) return;
    setError(null);
    if (offline) {
      const memo: Memo = { id: -Date.now(), content, isShared, updatedAt: new Date().toISOString(), mine: true };
      const next = [memo, ...memos];
      setMemos(next);
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(next));
    } else {
      try {
        const created = await api.post<Memo>('/api/memos', { content, isShared });
        setMemos((prev) => [created, ...prev]);
      } catch (e) {
        setError(errorMessage(e));
        return;
      }
    }
    setContent('');
    setIsShared(false);
  };

  return (
    <>
      <WidgetHeader icon={<StickyNote className="h-4 w-4 text-amber-300" />} title="メモ" isEditing={isEditing}>
        {offline && (
          <span className="flex items-center gap-1 text-amber-300" title="サーバー未接続のためブラウザにのみ保存">
            <WifiOff className="h-3.5 w-3.5" />
            ローカル
          </span>
        )}
        {!offline && (
          <label className="flex cursor-pointer items-center gap-1 text-slate-400">
            <input
              type="checkbox"
              checked={includeShared}
              onChange={(e) => setIncludeShared(e.target.checked)}
              className="accent-blue-500"
            />
            共有メモも表示
          </label>
        )}
      </WidgetHeader>

      <form
        className="mt-3 space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void add();
            }
          }}
          rows={2}
          placeholder="メモを入力（Ctrl+Enter で保存）"
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-400">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="accent-blue-500" />
            <Share2 className="h-3 w-3" />
            他のメンバーに共有
          </label>
          <button
            type="submit"
            disabled={!content.trim()}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            保存
          </button>
        </div>
      </form>

      {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}

      <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {loading && <li className="text-xs text-slate-500">読み込み中...</li>}
        {!loading && memos.length === 0 && <li className="text-xs text-slate-500">メモはまだありません</li>}
        {memos.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg border px-2.5 py-2 text-xs ${
              m.mine ? 'border-slate-800 bg-slate-800/40' : 'border-cyan-500/20 bg-cyan-500/5'
            }`}
          >
            <div className="whitespace-pre-wrap break-words text-slate-200">{m.content}</div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
              {m.updatedAt && <span>{new Date(m.updatedAt).toLocaleString('ja-JP')}</span>}
              {m.isShared && (
                <span className="flex items-center gap-0.5 text-cyan-400">
                  <Users className="h-3 w-3" />
                  {m.mine ? '共有中' : '共有メモ'}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
