import type { Semester, TimetableEntry } from '../types';

/** 時限ごとの時刻（千葉工業大学の時程を基準。大学に合わせて調整） */
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '09:00', end: '10:30' },
  2: { start: '10:40', end: '12:10' },
  3: { start: '13:00', end: '14:30' },
  4: { start: '14:40', end: '16:10' },
  5: { start: '16:20', end: '17:50' },
  6: { start: '18:00', end: '19:30' },
  7: { start: '19:40', end: '21:10' },
};

/** index = ISO 曜日 (1=月 … 7=日) */
export const DAY_LABELS = ['', '月', '火', '水', '木', '金', '土', '日'] as const;

export const SEMESTER_LABELS: Record<Semester, string> = {
  SPRING: '前期',
  FALL: '後期',
  FULL_YEAR: '通年',
};

/** JS の Date → ISO 曜日 (1=月 … 7=日) */
export const isoDayOfWeek = (d: Date): number => (d.getDay() === 0 ? 7 : d.getDay());

/** 4月始まりの年度と、前期(4〜9月)/後期(10〜3月) */
export function currentAcademicTerm(d: Date): { academicYear: number; semester: Semester } {
  const month = d.getMonth() + 1;
  return {
    academicYear: month < 4 ? d.getFullYear() - 1 : d.getFullYear(),
    semester: month >= 4 && month <= 9 ? 'SPRING' : 'FALL',
  };
}

export interface ScheduledClass extends TimetableEntry {
  start: string;
  end: string;
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** 今日（今学期・今曜日）の授業を時限順に */
export function todaysClasses(entries: TimetableEntry[], now: Date): ScheduledClass[] {
  const { academicYear, semester } = currentAcademicTerm(now);
  const day = isoDayOfWeek(now);
  return entries
    .filter(
      (e) =>
        e.academicYear === academicYear &&
        (e.semester === semester || e.semester === 'FULL_YEAR') &&
        e.dayOfWeek === day &&
        PERIOD_TIMES[e.period],
    )
    .sort((a, b) => a.period - b.period)
    .map((e) => ({ ...e, ...PERIOD_TIMES[e.period] }));
}

export type ClassStatus =
  | { status: 'IN_PROGRESS' | 'NEXT'; item: ScheduledClass; remain: number }
  | { status: 'FINISHED' | 'NONE'; item: null; remain: 0 };

export function getCurrentOrNextClass(entries: TimetableEntry[], now: Date): ClassStatus {
  const today = todaysClasses(entries, now);
  if (today.length === 0) return { status: 'NONE', item: null, remain: 0 };

  const cur = now.getHours() * 60 + now.getMinutes();
  for (const c of today) {
    const s = toMinutes(c.start);
    const e = toMinutes(c.end);
    if (cur >= s && cur <= e) return { status: 'IN_PROGRESS', item: c, remain: e - cur };
    if (cur < s) return { status: 'NEXT', item: c, remain: s - cur };
  }
  return { status: 'FINISHED', item: null, remain: 0 };
}

/** サーバー未接続・未登録時に表示するサンプル（今日の曜日に表示） */
export function buildSampleTimetable(now: Date): TimetableEntry[] {
  const { academicYear, semester } = currentAcademicTerm(now);
  const dayOfWeek = isoDayOfWeek(now);
  const base = { academicYear, semester, dayOfWeek };
  return [
    { ...base, period: 1, subject: '線形代数学Ⅱ', campus: '津田沼', room: '2号館 201教室' },
    { ...base, period: 2, subject: 'データサイエンス概論', campus: '津田沼', room: '6号館 6204教室' },
    { ...base, period: 3, subject: 'ネットワーク工学', campus: '新習志野', room: '7号館 7102教室' },
    { ...base, period: 4, subject: '情報数学演習', campus: '新習志野', room: '3号館 PC演習室B' },
  ];
}
