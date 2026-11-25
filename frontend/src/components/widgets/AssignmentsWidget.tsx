import { useEffect, useState } from 'react';
import { Circle, CircleCheck, ClipboardList, Plus, WifiOff } from 'lucide-react';
import { api, errorMessage, isNetworkError } from '../../lib/api';
import type { Assignment } from '../../types';
import WidgetHeader from './WidgetHeader';

const OFFLINE_KEY = 'satlas_assignments_offline';

const sortAssignments = (list: Assignment[]) =>
  [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

const loadOffline = (): Assignment[] => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? '[]') as Assignment[];
  } catch {
    return [];
  }
};

function dueBadge(dueDate: string | null, completed: boolean) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const label = due.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (completed) return <span className="text-slate-500">{label}</span>;

  const hours = (due.getTime() - Date.now()) / 3_600_000;
  if (hours < 0) return <span className="font-semibold text-rose-400">期限切れ・{label}</span>;
  if (hours < 24) return <span className="font-semibold text-amber-300">あと{Math.ceil(hours)}時間・{label}</span>;
  return <span className="text-slate-400">あと{Math.floor(hours / 24)}日・{label}</span>;
}

export default function AssignmentsWidget({ isEditing }: { isEditing: boolean }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [due, setDue] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<Assignment[]>('/api/assignments')
      .then((list) => !cancelled && setItems(sortAssignments(list)))
      .catch((e) => {
        if (cancelled) return;
        if (isNetworkError(e)) {
          setOffline(true);
          setItems(sortAssignments(loadOffline()));
        } else {
          setError(errorMessage(e));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = (next: Assignment[]) => {
    const sorted = sortAssignments(next);
    setItems(sorted);
    if (offline) localStorage.setItem(OFFLINE_KEY, JSON.stringify(sorted));
  };

  const add = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      subject: subject.trim() || null,
      dueDate: due ? `${due}:00` : null,
    };
    setError(null);
    if (offline) {
      commit([...items, { id: -Date.now(), completed: false, ...payload }]);
    } else {
      try {
        const created = await api.post<Assignment>('/api/assignments', payload);
        commit([...items, created]);
      } catch (e) {
        setError(errorMessage(e));
        return;
      }
    }
    setTitle('');
    setSubject('');
    setDue('');
  };

  const toggle = async (item: Assignment) => {
    const updated = { ...item, completed: !item.completed };
    commit(items.map((a) => (a.id === item.id ? updated : a))); // 楽観的更新
    if (offline) return;
    try {
      await api.patch<Assignment>(`/api/assignments/${item.id}`, { completed: updated.completed });
    } catch (e) {
      setError(errorMessage(e));
      commit(items); // ロールバック
    }
  };

  const visible = showDone ? items : items.filter((a) => !a.completed);
  const pending = items.filter((a) => !a.completed).length;

  return (
    <>
      <WidgetHeader
        icon={<ClipboardList className="h-4 w-4 text-violet-400" />}
        title={`課題リスト（未完了 ${pending}）`}
        isEditing={isEditing}
      >
        {offline && (
          <span className="flex items-center gap-1 text-amber-300" title="サーバー未接続のためブラウザにのみ保存">
            <WifiOff className="h-3.5 w-3.5" />
            ローカル
          </span>
        )}
        <label className="flex cursor-pointer items-center gap-1 text-slate-400">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-blue-500" />
          完了も表示
        </label>
      </WidgetHeader>

      <form
        className="mt-3 grid grid-cols-[1fr_auto] gap-1.5 sm:grid-cols-[2fr_1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="課題名（例: レポート第3回）"
          className="min-w-0 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="科目"
          className="hidden min-w-0 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none sm:block"
        />
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="hidden rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none sm:block"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          追加
        </button>
      </form>

      {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}

      <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {loading && <li className="text-xs text-slate-500">読み込み中...</li>}
        {!loading && visible.length === 0 && <li className="text-xs text-slate-500">課題はありません 🎉</li>}
        {visible.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-2.5 py-2 text-xs"
          >
            <button
              type="button"
              onClick={() => void toggle(a)}
              className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-400"
              aria-label={a.completed ? '未完了に戻す' : '完了にする'}
            >
              {a.completed ? <CircleCheck className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className={`truncate font-medium ${a.completed ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                {a.title}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                {a.subject && <span className="text-blue-300">{a.subject}</span>}
                {dueBadge(a.dueDate, a.completed)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
