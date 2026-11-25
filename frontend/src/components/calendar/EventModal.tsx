import { useEffect, useState } from 'react';
import { Calendar, Clock, Globe, LoaderCircle, Share2, Trash, User, X } from 'lucide-react';
import { errorMessage } from '../../lib/api';
import { EVENT_COLORS, fromDateTimeInput, toDateTimeInput, toLocalIso } from '../../lib/calendar';
import type { CalendarEvent, CalendarEventInput } from '../../types';

interface Props {
  /** null の場合は新規作成 */
  event: CalendarEvent | null;
  /** 新規作成時の初期日時 */
  initialDate: Date;
  onClose: () => void;
  onCreate: (input: CalendarEventInput) => Promise<CalendarEvent>;
  onUpdate: (eventId: number, patch: Partial<CalendarEventInput>) => Promise<CalendarEvent>;
  onDelete: (eventId: number) => Promise<void>;
}

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60';

export default function EventModal({ event, initialDate, onClose, onCreate, onUpdate, onDelete }: Props) {
  const isNew = event === null;
  const readOnly = !isNew && !event.editable;

  const defaultStart = new Date(initialDate);
  if (defaultStart.getHours() === 0 && defaultStart.getMinutes() === 0) {
    defaultStart.setHours(9, 0, 0, 0);
  }
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startVal, setStartVal] = useState(toDateTimeInput(event?.startAt ?? toLocalIso(defaultStart)));
  const [endVal, setEndVal] = useState(toDateTimeInput(event?.endAt ?? toLocalIso(defaultEnd)));
  const [isShared, setIsShared] = useState(event?.isShared ?? false);
  const [color, setColor] = useState(event?.color ?? EVENT_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [togglingShare, setTogglingShare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  /** 既存予定ではワンクリックで共有フラグを即時反映 */
  const handleToggleShare = async () => {
    if (readOnly || togglingShare) return;
    const next = !isShared;
    setIsShared(next);
    if (!isNew && event?.eventId != null) {
      setTogglingShare(true);
      setError(null);
      try {
        await onUpdate(event.eventId, { isShared: next });
      } catch (e) {
        setIsShared(!next);
        setError(errorMessage(e));
      } finally {
        setTogglingShare(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (readOnly || !title.trim()) return;
    const startAt = allDay ? `${startVal.slice(0, 10)}T00:00:00` : fromDateTimeInput(startVal);
    let endAt = allDay ? `${endVal.slice(0, 10)}T23:59:59` : fromDateTimeInput(endVal);
    if (endAt < startAt) {
      endAt = startAt;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CalendarEventInput = {
        title: title.trim(),
        description: description.trim() || null,
        startAt,
        endAt,
        allDay,
        isShared,
        color,
      };
      if (isNew) {
        await onCreate(payload);
      } else if (event?.eventId != null) {
        await onUpdate(event.eventId, payload);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (readOnly || event?.eventId == null) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete(event.eventId);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Calendar className="h-4 w-4 text-blue-400" />
            {isNew ? '予定を作成' : readOnly ? '予定の詳細（閲覧のみ）' : '予定を編集'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {/* ソース・作成者バッジ */}
          {!isNew && event && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-slate-300">
                <User className="h-3 w-3 text-slate-400" />
                {event.ownerName}
              </span>
              {event.source === 'GOOGLE_ICAL' && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-emerald-300">
                  <Globe className="h-3 w-3" />
                  Googleカレンダー同期
                </span>
              )}
              {event.source === 'ASSIGNMENT' && (
                <span className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-rose-300">
                  <Clock className="h-3 w-3" />
                  課題締切（課題リストから編集）
                </span>
              )}
              {!event.mine && (
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-0.5 text-cyan-300">
                  メンバー共有予定
                </span>
              )}
            </div>
          )}

          {/* メンバーに共有する（ワンクリックトグルスイッチ） */}
          {event?.source !== 'ASSIGNMENT' && (
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/50 px-3.5 py-2.5">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                  <Share2 className="h-3.5 w-3.5 text-cyan-400" />
                  メンバーに共有する
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {readOnly
                    ? '他のメンバーが共有している予定です'
                    : isShared
                      ? 'オン：他のメンバーのカレンダーにも表示されます'
                      : 'オフ：自分だけに表示される個人予定です'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isShared}
                disabled={readOnly || togglingShare}
                onClick={() => void handleToggleShare()}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  isShared ? 'bg-cyan-500' : 'bg-slate-700'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    isShared ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* タイトル */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">タイトル</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
              placeholder="例: ゼミ発表準備 / バイト"
              className={inputCls}
              required
            />
          </div>

          {/* 終日 + 開始・終了日時 */}
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={allDay}
                disabled={readOnly}
                onChange={(e) => setAllDay(e.target.checked)}
                className="accent-blue-500"
              />
              終日の予定
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">開始</label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? startVal.slice(0, 10) : startVal}
                  disabled={readOnly}
                  onChange={(e) =>
                    setStartVal(allDay ? `${e.target.value}T00:00` : e.target.value)
                  }
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">終了</label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? endVal.slice(0, 10) : endVal}
                  disabled={readOnly}
                  onChange={(e) =>
                    setEndVal(allDay ? `${e.target.value}T23:59` : e.target.value)
                  }
                  className={inputCls}
                  required
                />
              </div>
            </div>
          </div>

          {/* 説明 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">メモ・説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              rows={3}
              placeholder="場所や持ち物など"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* カラー */}
          {!readOnly && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">カラー</label>
              <div className="flex items-center gap-2">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`h-6 w-6 rounded-full transition ${
                      color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* フッターボタン */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            {!isNew && !readOnly && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="mr-auto flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
              >
                <Trash className="h-3.5 w-3.5" />
                削除
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              {readOnly ? '閉じる' : 'キャンセル'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {isNew ? '作成' : '保存'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
