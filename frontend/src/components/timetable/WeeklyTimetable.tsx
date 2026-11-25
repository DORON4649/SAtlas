import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { TimetableSource } from '../../hooks/useTimetable';
import { DAY_LABELS, PERIOD_TIMES, SEMESTER_LABELS, buildSampleTimetable, currentAcademicTerm } from '../../lib/timetable';
import type { Semester, TimetableEntry } from '../../types';

interface Props {
  entries: TimetableEntry[];
  source: TimetableSource;
}

const DAYS = [1, 2, 3, 4, 5, 6];
const PERIODS = [1, 2, 3, 4, 5, 6];

/** 3 ペインの「時間割」セクション用の週間表 */
export default function WeeklyTimetable({ entries, source }: Props) {
  const now = new Date();
  const term = currentAcademicTerm(now);
  const [semester, setSemester] = useState<Exclude<Semester, 'FULL_YEAR'>>(term.semester === 'FALL' ? 'FALL' : 'SPRING');
  const data = source === 'server' ? entries : buildSampleTimetable(now);

  const cell = (day: number, period: number) =>
    data.find(
      (e) =>
        e.academicYear === term.academicYear &&
        (e.semester === semester || e.semester === 'FULL_YEAR') &&
        e.dayOfWeek === day &&
        e.period === period,
    );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-semibold">{term.academicYear}年度 時間割</h2>
        {source !== 'server' && <span className="text-[11px] text-slate-500">（サンプル表示）</span>}
        <div className="ml-auto flex rounded-lg border border-slate-700 p-0.5 text-xs">
          {(['SPRING', 'FALL'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSemester(s)}
              className={`rounded-md px-3 py-1 ${semester === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {SEMESTER_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-16" />
              {DAYS.map((d) => (
                <th key={d} className="py-1 font-medium text-slate-400">
                  {DAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p}>
                <td className="text-center text-slate-500">
                  <div className="font-semibold text-slate-300">{p}限</div>
                  <div className="text-[10px]">{PERIOD_TIMES[p]?.start}</div>
                </td>
                {DAYS.map((d) => {
                  const c = cell(d, p);
                  return (
                    <td key={d} className="h-16 align-top">
                      {c ? (
                        <div className="h-full rounded-lg border border-blue-500/30 bg-blue-600/15 p-1.5">
                          <div className="line-clamp-2 font-semibold text-slate-100">{c.subject}</div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-400">
                            {[c.campus, c.room].filter(Boolean).join(' / ')}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full rounded-lg border border-slate-800/80" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
