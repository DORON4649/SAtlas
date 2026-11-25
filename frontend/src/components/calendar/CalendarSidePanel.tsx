import { Globe, Layers, RefreshCw } from 'lucide-react';
import type { CalendarLayerFilter } from '../../lib/calendar';

interface Props {
  layers: CalendarLayerFilter;
  onChangeLayers: (next: CalendarLayerFilter) => void;
  hasGoogleUrl: boolean;
  syncing: boolean;
  onOpenGoogleModal: () => void;
  onQuickSync: () => void;
}

const LAYER_ITEMS: { key: keyof CalendarLayerFilter; label: string; dotClass: string }[] = [
  { key: 'personal', label: '自分の予定', dotClass: 'bg-blue-500' },
  { key: 'google', label: 'Googleカレンダー', dotClass: 'bg-emerald-500' },
  { key: 'shared', label: 'メンバー共有予定', dotClass: 'bg-cyan-400' },
  { key: 'assignments', label: '課題締切', dotClass: 'bg-rose-500' },
];

/** カレンダー用の右サイドパネル（レイヤー切替 + Google iCal 同期） */
export default function CalendarSidePanel({
  layers,
  onChangeLayers,
  hasGoogleUrl,
  syncing,
  onOpenGoogleModal,
  onQuickSync,
}: Props) {
  const toggle = (key: keyof CalendarLayerFilter) =>
    onChangeLayers({ ...layers, [key]: !layers[key] });

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Layers className="h-3.5 w-3.5 text-blue-400" />
          表示レイヤー
        </h3>
        <div className="space-y-2">
          {LAYER_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800/70"
            >
              <input
                type="checkbox"
                checked={layers[item.key]}
                onChange={() => toggle(item.key)}
                className="accent-blue-500"
              />
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClass}`} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Globe className="h-3.5 w-3.5 text-emerald-400" />
          Googleカレンダー連携
        </h3>
        <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
          {hasGoogleUrl
            ? 'iCal URL 設定済み。[共有] / #share 付き予定は自動共有されます。'
            : '非公開 iCal URL (.ics) を設定して予定を同期できます。'}
        </p>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onOpenGoogleModal}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
          >
            <Globe className="h-3.5 w-3.5" />
            iCal URL設定＆同期
          </button>
          {hasGoogleUrl && (
            <button
              type="button"
              disabled={syncing}
              onClick={onQuickSync}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同期中...' : '今すぐ同期'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
