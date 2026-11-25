import { useEffect, useState } from 'react';
import { Globe, Link, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { loadOfflineIcalUrl, saveOfflineIcalUrl } from '../../hooks/useCalendar';
import type { GoogleSyncResponse, CurrentUser } from '../../types';

interface Props {
  initialUrl: string;
  offline: boolean;
  onClose: () => void;
  onSavedUrl: () => Promise<void>;
  onSync: () => Promise<GoogleSyncResponse>;
}

export default function GoogleIcalModal({ initialUrl, offline, onClose, onSavedUrl, onSync }: Props) {
  const [url, setUrl] = useState(initialUrl || loadOfflineIcalUrl());
  const [busy, setBusy] = useState<'idle' | 'saving' | 'syncing'>('idle');
  const [result, setResult] = useState<GoogleSyncResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && busy === 'idle' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const saveUrl = async (): Promise<boolean> => {
    const trimmed = url.trim();
    saveOfflineIcalUrl(trimmed);
    if (offline) {
      setMessage('ローカルに URL を保存しました（サーバー接続後に同期できます）');
      return true;
    }
    await api.patch<CurrentUser>('/api/me', { googleIcalUrl: trimmed });
    await onSavedUrl();
    return true;
  };

  const handleSaveOnly = async () => {
    setBusy('saving');
    setError(null);
    setMessage(null);
    try {
      await saveUrl();
      if (!offline) setMessage('iCal URL を保存しました');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('idle');
    }
  };

  const handleSaveAndSync = async () => {
    if (!url.trim()) {
      setError('Google カレンダーの iCal URL (.ics) を入力してください');
      return;
    }
    setBusy('syncing');
    setError(null);
    setMessage(null);
    setResult(null);
    try {
      await saveUrl();
      if (offline) {
        setError('サーバー未接続のため同期できません（URL のみローカルに保存しました）');
        return;
      }
      const res = await onSync();
      setResult(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && busy === 'idle' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Globe className="h-4 w-4 text-emerald-400" />
            Google カレンダー (iCal) 連携・同期
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== 'idle'}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-xs">
          <p className="leading-relaxed text-slate-400">
            Google カレンダーの「設定 → カレンダーの統合 →{' '}
            <span className="text-slate-200">iCal 形式の非公開 URL</span>」を登録すると、予定を取り込めます。
          </p>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-[11px] leading-relaxed text-cyan-200">
            タイトルまたは説明文に <code className="rounded bg-slate-800 px-1 py-0.5">[共有]</code> または{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5">#share</code>{' '}
            が含まれる予定は、同期時に自動でメンバー共有（共有フラグ ON）になります。
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
              <Link className="h-3.5 w-3.5 text-slate-400" />
              iCal URL (.ics)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {message && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300">
              {message}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-emerald-200">
              <div className="font-semibold">同期が完了しました（合計 {result.syncedCount} 件）</div>
              <div className="mt-1 text-[11px] text-emerald-300/90">
                新規 {result.createdCount} 件 / 更新 {result.updatedCount} 件 / 自動共有 {result.sharedCount} 件
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== 'idle'}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            閉じる
          </button>
          <button
            type="button"
            onClick={() => void handleSaveOnly()}
            disabled={busy !== 'idle'}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            {busy === 'saving' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            URLを保存
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAndSync()}
            disabled={busy !== 'idle' || !url.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {busy === 'syncing' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {busy === 'syncing' ? '同期中...' : '保存して今すぐ同期'}
          </button>
        </div>
      </div>
    </div>
  );
}
