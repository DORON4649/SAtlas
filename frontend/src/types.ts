// ---- バックエンド API の型定義（server/ の DTO と対応） ----

export type Semester = 'SPRING' | 'FALL' | 'FULL_YEAR';

export interface TimetableEntry {
  id?: number;
  academicYear: number;
  semester: Semester;
  /** 1=月 … 7=日 */
  dayOfWeek: number;
  period: number;
  subject: string;
  campus?: string | null;
  room?: string | null;
  color?: string | null;
}

export interface TimetableDraft {
  semester: Semester;
  dayOfWeek: number;
  period: number;
  subject: string;
  campus?: string | null;
  room?: string | null;
}

export type AiProvider = 'GEMINI' | 'OLLAMA_FALLBACK';

export type AiContextType = 'NONE' | 'TODAY_SCHEDULE' | 'ASSIGNMENTS' | 'NOTEBOOK';

export interface AiChatResponse {
  reply: string;
  provider: AiProvider;
  model: string;
  contextType: AiContextType;
}

export interface TimetableImportResponse {
  fileName: string;
  provider?: AiProvider;
  model: string;
  entries: TimetableDraft[];
}

export interface Assignment {
  id: number;
  title: string;
  subject: string | null;
  /** ISO LocalDateTime (例: 2026-11-30T23:59:00) */
  dueDate: string | null;
  completed: boolean;
}

export interface Memo {
  id: number;
  content: string;
  isShared: boolean;
  updatedAt: string | null;
  mine: boolean;
}

export interface CurrentUser {
  id: number;
  discordId: string;
  name: string;
  avatarUrl: string | null;
  email: string | null;
  role: 'USER' | 'ADMIN';
  theme: string | null;
  language: string | null;
  prefecture: string | null;
  birthday: string | null;
  hasGeminiApiKey: boolean;
  geminiApiKeyMasked: string | null;
  enableOllamaFallback: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  googleIcalUrl: string | null;
}

export interface MeResponse {
  authenticated: boolean;
  devFallback: boolean;
  user: CurrentUser | null;
}

export type CalendarEventSource = 'SATLAS' | 'GOOGLE_ICAL' | 'ASSIGNMENT';

export interface CalendarEvent {
  id: string;
  eventId: number | null;
  assignmentId: number | null;
  userId: number;
  ownerName: string;
  title: string;
  description: string | null;
  /** ISO LocalDateTime (例: 2026-11-25T10:00:00) */
  startAt: string;
  endAt: string;
  allDay: boolean;
  isShared: boolean;
  source: CalendarEventSource;
  externalUid: string | null;
  color: string | null;
  mine: boolean;
  editable: boolean;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  isShared?: boolean;
  color?: string | null;
}

export interface GoogleSyncResponse {
  syncedCount: number;
  createdCount: number;
  updatedCount: number;
  sharedCount: number;
  syncedAt: string;
}

export interface LectureNote {
  id: number;
  userId?: number;
  subjectName: string;
  sectionName: string;
  sectionColor: string;
  title: string;
  contentJson: string;
  isPinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LectureNoteInput {
  subjectName?: string;
  sectionName?: string;
  sectionColor?: string;
  title?: string;
  contentJson?: string;
  isPinned?: boolean;
}
