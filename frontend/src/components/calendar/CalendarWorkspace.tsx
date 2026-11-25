import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Globe, Plus, Share2, WifiOff } from 'lucide-react';
import {
  addDays,
  buildMonthGrid,
  buildWeekDays,
  eventOccursOnDate,
  formatTimeRange,
  matchesLayerFilter,
  resolveEventColor,
  toDateKey,
  type CalendarLayerFilter,
  type CalendarViewMode,
} from '../../lib/calendar';
import type { CalendarEvent, CalendarEventInput } from '../../types';
import EventModal from './EventModal';

interface Props {
  view: CalendarViewMode;
  onViewChange: (v: CalendarViewMode) => void;
  anchorDate: Date;
  onAnchorDateChange: (d: Date) => void;
  events: CalendarEvent[];
  loading: boolean;
  offline: boolean;
  error: string | null;
  layers: CalendarLayerFilter;
  onChangeLayers: (next: CalendarLayerFilter) => void;
  onOpenGoogleModal: () => void;
  onCreateEvent: (input: CalendarEventInput) => Promise<CalendarEvent>;
  onUpdateEvent: (eventId: number, patch: Partial<CalendarEventInput>) => Promise<CalendarEvent>;
  onDeleteEvent: (eventId: number) => Promise<void>;
}

const WEEKDAY_HEADERS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 48; // px

export default function CalendarWorkspace({
  view,
  onViewChange,
  anchorDate,
  onAnchorDateChange,
  events,
  loading,
  offline,
  error,
  layers,
  onChangeLayers,
  onOpenGoogleModal,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: Props) {
  const [modalState, setModalState] = useState<{ open: boolean; event: CalendarEvent | null; date: Date }>({
    open: false,
    event: null,
    date: new Date(),
  });
  const timeGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((view === 'week' || view === 'day') && timeGridRef.current) {
      timeGridRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, [view]);

  const filtered = useMemo(() => events.filter((ev) => matchesLayerFilter(ev, layers)), [events, layers]);
  const todayKey = toDateKey(new Date());

  const navigate = (dir: -1 | 1) => {
    if (view === 'month') {
      onAnchorDateChange(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + dir, 1));
    } else if (view === 'week') {
      onAnchorDateChange(addDays(anchorDate, dir * 7));
    } else {
      onAnchorDateChange(addDays(anchorDate, dir));
    }
  };

  const rangeLabel = useMemo(() => {
    if (view === 'month') {
      return `${anchorDate.getFullYear()}年 ${anchorDate.getMonth() + 1}月`;
    }
    if (view === 'week') {
      const days = buildWeekDays(anchorDate);
      const first = days[0];
      const last = days[6];
      return `${first.getFullYear()}年 ${first.getMonth() + 1}/${first.getDate()} 〜 ${last.getMonth() + 1}/${last.getDate()}`;
    }
    return anchorDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }, [anchorDate, view]);

  const openCreate = (d: Date) => setModalState({ open: true, event: null, date: d });
  const openDetail = (ev: CalendarEvent) => setModalState({ open: true, event: ev, date: new Date(ev.startAt) });

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/90">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <button
            type="button"
            onClick={() => onAnchorDateChange(new Date())}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            今日
          </button>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="前へ"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="次へ"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-sm font-bold text-white sm:text-base">{rangeLabel}</h2>
          {offline && (
            <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
              <WifiOff className="h-3 w-3" />
              ローカル
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 月 / 週 / 日 切替 */}
          <div className="flex rounded-lg border border-slate-700 bg-slate-800/60 p-0.5 text-xs">
            {(
              [
                ['month', '月'],
                ['week', '週'],
                ['day', '日'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => onViewChange(m)}
                className={`rounded-md px-2.5 py-1 transition ${
                  view === m ? 'bg-blue-600 font-semibold text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 狭い画面向け Google 同期ボタン（lg 以上は右サイドパネルにも配置） */}
          <button
            type="button"
            onClick={onOpenGoogleModal}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 lg:hidden"
          >
            <Globe className="h-3.5 w-3.5" />
            Google同期
          </button>

          <button
            type="button"
            onClick={() => openCreate(anchorDate)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            予定を追加
          </button>
        </div>
      </div>

      {/* 狭い画面向けのコンパクトレイヤー切替（lg 以上は右サイドパネルを使用） */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-2 text-[11px] text-slate-300 lg:hidden">
        {(
          [
            ['personal', '自分の予定', 'bg-blue-500'],
            ['google', 'Google', 'bg-emerald-500'],
            ['shared', 'メンバー共有', 'bg-cyan-400'],
            ['assignments', '課題締切', 'bg-rose-500'],
          ] as const
        ).map(([k, label, dot]) => (
          <label key={k} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={layers[k]}
              onChange={() => onChangeLayers({ ...layers, [k]: !layers[k] })}
              className="accent-blue-500"
            />
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {label}
          </label>
        ))}
      </div>

      {error && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs text-rose-300">{error}</div>
      )}

      {/* 本体 */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'month' && (
          <MonthView
            anchorDate={anchorDate}
            todayKey={todayKey}
            events={filtered}
            loading={loading}
            onClickDay={openCreate}
            onClickEvent={openDetail}
          />
        )}
        {view === 'week' && (
          <WeekView
            days={buildWeekDays(anchorDate)}
            todayKey={todayKey}
            events={filtered}
            scrollRef={timeGridRef}
            onClickSlot={openCreate}
            onClickEvent={openDetail}
          />
        )}
        {view === 'day' && (
          <DayView
            day={anchorDate}
            todayKey={todayKey}
            events={filtered}
            scrollRef={timeGridRef}
            onClickSlot={openCreate}
            onClickEvent={openDetail}
          />
        )}
      </div>

      {modalState.open && (
        <EventModal
          event={modalState.event}
          initialDate={modalState.date}
          onClose={() => setModalState((s) => ({ ...s, open: false }))}
          onCreate={onCreateEvent}
          onUpdate={onUpdateEvent}
          onDelete={onDeleteEvent}
        />
      )}
    </div>
  );
}

/* ---------------- 月表示 ---------------- */
function MonthView({
  anchorDate,
  todayKey,
  events,
  loading,
  onClickDay,
  onClickEvent,
}: {
  anchorDate: Date;
  todayKey: string;
  events: CalendarEvent[];
  loading: boolean;
  onClickDay: (d: Date) => void;
  onClickEvent: (ev: CalendarEvent) => void;
}) {
  const days = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);
  const currentMonth = anchorDate.getMonth();

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/60 text-center text-xs font-medium">
        {WEEKDAY_HEADERS.map((w, idx) => (
          <div
            key={w}
            className={`py-2 ${idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-sky-400' : 'text-slate-400'}`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((d) => {
          const key = toDateKey(d);
          const isToday = key === todayKey;
          const isCurrentMonth = d.getMonth() === currentMonth;
          const dayEvents = events.filter((ev) => eventOccursOnDate(ev, d));
          const dow = d.getDay();

          return (
            <div
              key={key}
              onClick={() => onClickDay(d)}
              className={`flex min-h-0 cursor-pointer flex-col border-b border-r border-slate-800/80 p-1.5 transition hover:bg-slate-800/40 ${
                isCurrentMonth ? '' : 'bg-slate-950/40 opacity-50'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : dow === 0
                        ? 'text-rose-400'
                        : dow === 6
                          ? 'text-sky-400'
                          : 'text-slate-200'
                  }`}
                >
                  {d.getDate()}
                </span>
                {loading && isToday && <span className="text-[10px] text-slate-500">...</span>}
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClickEvent(ev);
                    }}
                    style={{
                      backgroundColor: `${resolveEventColor(ev)}26`,
                      borderLeftColor: resolveEventColor(ev),
                    }}
                    className="flex w-full items-center gap-1 truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] text-slate-100 transition hover:brightness-125"
                    title={`${ev.title} (${formatTimeRange(ev)})`}
                  >
                    {ev.isShared && <Share2 className="h-2.5 w-2.5 shrink-0 text-cyan-300" />}
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} 件</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- 週表示 ---------------- */
function WeekView({
  days,
  todayKey,
  events,
  scrollRef,
  onClickSlot,
  onClickEvent,
}: {
  days: Date[];
  todayKey: string;
  events: CalendarEvent[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onClickSlot: (d: Date) => void;
  onClickEvent: (ev: CalendarEvent) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-slate-800 bg-slate-900/80 text-center text-xs">
        <div className="border-r border-slate-800 py-2 text-[10px] text-slate-500">終日</div>
        {days.map((d) => {
          const isToday = toDateKey(d) === todayKey;
          const dow = d.getDay();
          return (
            <div key={toDateKey(d)} className="border-r border-slate-800/70 py-1.5">
              <div className={dow === 0 ? 'text-rose-400' : dow === 6 ? 'text-sky-400' : 'text-slate-400'}>
                {WEEKDAY_HEADERS[dow]}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
                  isToday ? 'bg-blue-600 text-white' : 'text-slate-200'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* 終日行 */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-slate-800 bg-slate-950/30">
        <div className="border-r border-slate-800 p-1 text-center text-[10px] text-slate-500">終日</div>
        {days.map((d) => {
          const allDayEvents = events.filter((ev) => ev.allDay && eventOccursOnDate(ev, d));
          return (
            <div key={toDateKey(d)} className="min-h-8 space-y-1 border-r border-slate-800/70 p-1">
              {allDayEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onClickEvent(ev)}
                  style={{ backgroundColor: `${resolveEventColor(ev)}33`, borderLeftColor: resolveEventColor(ev) }}
                  className="flex w-full items-center gap-1 truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[10px] text-slate-100"
                >
                  {ev.isShared && <Share2 className="h-2.5 w-2.5 shrink-0 text-cyan-300" />}
                  <span className="truncate">{ev.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* 時間軸グリッド */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* 時刻ラベル列 */}
          <div className="border-r border-slate-800">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="border-b border-slate-800/50 pr-1.5 pt-0.5 text-right text-[10px] text-slate-500"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* 7 日列 */}
          {days.map((d) => {
            const timed = events.filter((ev) => !ev.allDay && eventOccursOnDate(ev, d));
            return (
              <div key={toDateKey(d)} className="relative border-r border-slate-800/70">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => onClickSlot(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0))}
                    className="cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/30"
                  />
                ))}
                {timed.map((ev) => {
                  const s = new Date(ev.startAt);
                  const e = new Date(ev.endAt);
                  const startMin = s.getHours() * 60 + s.getMinutes();
                  const endMin = Math.max(startMin + 30, e.getHours() * 60 + e.getMinutes());
                  const top = (startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_HEIGHT);
                  const color = resolveEventColor(ev);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onClickEvent(ev);
                      }}
                      style={{
                        top,
                        height,
                        backgroundColor: `${color}33`,
                        borderLeftColor: color,
                      }}
                      className="absolute inset-x-0.5 overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-left text-[10px] text-slate-100 shadow-sm hover:brightness-125"
                    >
                      <div className="flex items-center gap-1 truncate font-semibold">
                        {ev.isShared && <Share2 className="h-2.5 w-2.5 shrink-0 text-cyan-300" />}
                        <span className="truncate">{ev.title}</span>
                      </div>
                      <div className="truncate text-[9px] text-slate-300">{formatTimeRange(ev)}</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 日表示 ---------------- */
function DayView({
  day,
  todayKey,
  events,
  scrollRef,
  onClickSlot,
  onClickEvent,
}: {
  day: Date;
  todayKey: string;
  events: CalendarEvent[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onClickSlot: (d: Date) => void;
  onClickEvent: (ev: CalendarEvent) => void;
}) {
  const isToday = toDateKey(day) === todayKey;
  const dayEvents = events.filter((ev) => eventOccursOnDate(ev, day));
  const allDayEvents = dayEvents.filter((ev) => ev.allDay);
  const timedEvents = dayEvents.filter((ev) => !ev.allDay);

  return (
    <div className="flex h-full flex-col">
      {/* 終日バー */}
      <div className="flex items-start gap-2 border-b border-slate-800 bg-slate-950/30 px-4 py-2">
        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
          終日
        </span>
        <div className="flex flex-wrap gap-1.5">
          {allDayEvents.length === 0 ? (
            <span className="text-xs text-slate-500">終日の予定はありません</span>
          ) : (
            allDayEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onClickEvent(ev)}
                style={{ backgroundColor: `${resolveEventColor(ev)}33`, borderLeftColor: resolveEventColor(ev) }}
                className="flex items-center gap-1.5 rounded border-l-2 px-2.5 py-1 text-xs text-slate-100 hover:brightness-125"
              >
                {ev.isShared && <Share2 className="h-3 w-3 text-cyan-300" />}
                <span>{ev.title}</span>
                {!ev.mine && <span className="text-[10px] text-cyan-300">({ev.ownerName})</span>}
              </button>
            ))
          )}
        </div>
      </div>

      {/* タイムライン */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[4rem_1fr]" style={{ height: 24 * HOUR_HEIGHT }}>
          <div className="border-r border-slate-800">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="border-b border-slate-800/50 pr-2 pt-0.5 text-right text-[11px] text-slate-500"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                onClick={() => onClickSlot(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0))}
                className="cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/30"
              />
            ))}
            {timedEvents.map((ev) => {
              const s = new Date(ev.startAt);
              const e = new Date(ev.endAt);
              const startMin = s.getHours() * 60 + s.getMinutes();
              const endMin = Math.max(startMin + 40, e.getHours() * 60 + e.getMinutes());
              const top = (startMin / 60) * HOUR_HEIGHT;
              const height = Math.max(32, ((endMin - startMin) / 60) * HOUR_HEIGHT);
              const color = resolveEventColor(ev);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(evt) => {
                    evt.stopPropagation();
                    onClickEvent(ev);
                  }}
                  style={{
                    top,
                    height,
                    backgroundColor: `${color}2b`,
                    borderLeftColor: color,
                  }}
                  className="absolute inset-x-2 overflow-hidden rounded-lg border-l-4 px-3 py-1 text-left text-xs text-slate-100 shadow hover:brightness-125"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {ev.isShared && <Share2 className="h-3 w-3 shrink-0 text-cyan-300" />}
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] font-normal text-slate-300">
                      {formatTimeRange(ev)}
                    </span>
                  </div>
                  {(ev.description || !ev.mine) && (
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">
                      {!ev.mine ? `共有元: ${ev.ownerName} ` : ''}
                      {ev.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
