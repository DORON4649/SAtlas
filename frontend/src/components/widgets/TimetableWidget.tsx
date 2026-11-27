import { BookOpen, FileUp, Sparkles } from 'lucide-react';
import type { TimetableSource } from '../../hooks/useTimetable';
import { useNow } from '../../hooks/useNow';
import { buildSampleTimetable, getCurrentOrNextClass, todaysClasses } from '../../lib/timetable';
import type { TimetableEntry } from '../../types';
import WidgetHeader from './WidgetHeader';

interface Props {
  isEditing: boolean;
  entries: TimetableEntry[];
  source: TimetableSource;
  onOpenImport: () => void;
}

export default function TimetableWidget({ isEditing, entries, source, onOpenImport }: Props) {
  const now = useNow(30_000);
  const isSample = source !== 'server';
  const data = isSample ? buildSampleTimetable(now) : entries;
  const classInfo = getCurrentOrNextClass(data, now);
  const todayCount = todaysClasses(data, now).length;

  return (
    <>
      <WidgetHeader
        icon={<BookOpen className="h-4 w-4 text-blue-400" />}
        title="時間割ステータス"
        titleClassName="text-blue-300 font-semibold"
        isEditing={isEditing}
      >
        {classInfo.status === 'IN_PROGRESS' && (
          <span className="truncate rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-300">
            開講中（残り {classInfo.remain}分）
          </span>
        )}
        {classInfo.status === 'NEXT' && (
          <span className="truncate rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 font-medium text-amber-300">
            次の授業（あと {classInfo.remain}分）
          </span>
        )}
      </WidgetHeader>

      <div className="mt-2 min-h-0 flex-1">
        {classInfo.item ? (
          <>
            <div className="truncate text-lg font-bold text-white">
              {classInfo.item.period}限：{classInfo.item.subject}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              {classInfo.item.campus && (
                <span className="rounded border border-blue-500/30 bg-blue-600/30 px-2 py-0.5 font-medium text-blue-200">
                  {classInfo.item.campus}
                </span>
              )}
              <span className="truncate font-semibold text-slate-200">{classInfo.item.room}</span>
              <span className="ml-auto shrink-0 text-slate-400">
                {classInfo.item.start}〜{classInfo.item.end}
              </span>
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-400">
            {classInfo.status === 'FINISHED' ? '本日の講義はすべて終了しました' : '本日の講義はありません'}
          </div>
        )}
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="shrink-0">今日 {todayCount} コマ</span>
        {isSample && (
          <span className="truncate rounded border border-slate-700 px-1.5 py-0.5 text-slate-400">
            {source === 'offline' ? 'サンプル（サーバー未接続）' : 'サンプル表示'}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenImport}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-600/20 px-2.5 py-1 font-semibold text-blue-200 transition hover:bg-blue-600/40"
        >
          <FileUp className="h-3.5 w-3.5" />
          PDFからAI取込
          <Sparkles className="h-3 w-3 text-cyan-300" />
        </button>
      </div>
    </>
  );
}
