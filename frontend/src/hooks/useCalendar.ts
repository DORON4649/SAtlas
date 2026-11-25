import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, isNetworkError } from '../lib/api';
import { toLocalIso } from '../lib/calendar';
import type { Assignment, CalendarEvent, CalendarEventInput, GoogleSyncResponse } from '../types';

const OFFLINE_EVENTS_KEY = 'satlas_calendar_events_offline';
const OFFLINE_ASSIGNMENTS_KEY = 'satlas_assignments_offline';
const OFFLINE_ICAL_URL_KEY = 'satlas_google_ical_url_offline';

function loadOfflineEvents(): CalendarEvent[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_EVENTS_KEY) ?? '[]') as CalendarEvent[];
  } catch {
    return [];
  }
}

function saveOfflineEvents(events: CalendarEvent[]) {
  localStorage.setItem(OFFLINE_EVENTS_KEY, JSON.stringify(events));
}

function loadOfflineAssignmentEvents(): CalendarEvent[] {
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_ASSIGNMENTS_KEY) ?? '[]') as Assignment[];
    return list
      .filter((a) => !a.completed && a.dueDate)
      .map((a) => ({
        id: `assignment-${a.id}`,
        eventId: null,
        assignmentId: a.id,
        userId: 0,
        ownerName: 'ローカルユーザー',
        title: `[締切] ${a.title}`,
        description: a.subject ? `科目: ${a.subject}` : null,
        startAt: a.dueDate as string,
        endAt: a.dueDate as string,
        allDay: false,
        isShared: false,
        source: 'ASSIGNMENT' as const,
        externalUid: null,
        color: '#f43f5e',
        mine: true,
        editable: false,
      }));
  } catch {
    return [];
  }
}

export function loadOfflineIcalUrl(): string {
  return localStorage.getItem(OFFLINE_ICAL_URL_KEY) ?? '';
}

export function saveOfflineIcalUrl(url: string) {
  localStorage.setItem(OFFLINE_ICAL_URL_KEY, url);
}

/**
 * カレンダー予定の取得・CRUD・Google iCal 同期を管理するフック。
 * サーバー未起動時は localStorage にフォールバックする。
 */
export function useCalendar(rangeStart: Date, rangeEnd: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startIso = toLocalIso(rangeStart);
  const endIso = toLocalIso(rangeEnd);

  const fetchRange = useCallback(async () => {
    setError(null);
    try {
      const list = await api.get<CalendarEvent[]>(
        `/api/calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
      );
      setEvents(list);
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) {
        setOffline(true);
        const local = [...loadOfflineEvents(), ...loadOfflineAssignmentEvents()].sort((a, b) =>
          a.startAt.localeCompare(b.startAt),
        );
        setEvents(local);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<CalendarEvent[]>(
        `/api/calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
      )
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
        setOffline(false);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isNetworkError(e)) {
          setOffline(true);
          const local = [...loadOfflineEvents(), ...loadOfflineAssignmentEvents()].sort((a, b) =>
            a.startAt.localeCompare(b.startAt),
          );
          setEvents(local);
        } else {
          setError(errorMessage(e));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [startIso, endIso]);

  const createEvent = useCallback(
    async (input: CalendarEventInput): Promise<CalendarEvent> => {
      if (offline) {
        const idNum = Date.now();
        const created: CalendarEvent = {
          id: `event-${idNum}`,
          eventId: idNum,
          assignmentId: null,
          userId: 0,
          ownerName: 'ローカルユーザー',
          title: input.title,
          description: input.description ?? null,
          startAt: input.startAt,
          endAt: input.endAt,
          allDay: Boolean(input.allDay),
          isShared: Boolean(input.isShared),
          source: 'SATLAS',
          externalUid: null,
          color: input.color ?? '#3b82f6',
          mine: true,
          editable: true,
        };
        const stored = [...loadOfflineEvents(), created];
        saveOfflineEvents(stored);
        setEvents([...stored, ...loadOfflineAssignmentEvents()].sort((a, b) => a.startAt.localeCompare(b.startAt)));
        return created;
      }
      const created = await api.post<CalendarEvent>('/api/calendar/events', input);
      await fetchRange();
      return created;
    },
    [offline, fetchRange],
  );

  const updateEvent = useCallback(
    async (eventId: number, patch: Partial<CalendarEventInput>): Promise<CalendarEvent> => {
      if (offline) {
        const stored = loadOfflineEvents().map((ev) =>
          ev.eventId === eventId
            ? {
                ...ev,
                ...patch,
                description: patch.description !== undefined ? patch.description : ev.description,
                color: patch.color !== undefined ? patch.color : ev.color,
              }
            : ev,
        );
        saveOfflineEvents(stored);
        const updated = stored.find((ev) => ev.eventId === eventId)!;
        setEvents([...stored, ...loadOfflineAssignmentEvents()].sort((a, b) => a.startAt.localeCompare(b.startAt)));
        return updated;
      }
      const updated = await api.patch<CalendarEvent>(`/api/calendar/events/${eventId}`, patch);
      await fetchRange();
      return updated;
    },
    [offline, fetchRange],
  );

  const deleteEvent = useCallback(
    async (eventId: number) => {
      if (offline) {
        const stored = loadOfflineEvents().filter((ev) => ev.eventId !== eventId);
        saveOfflineEvents(stored);
        setEvents([...stored, ...loadOfflineAssignmentEvents()].sort((a, b) => a.startAt.localeCompare(b.startAt)));
        return;
      }
      await api.del(`/api/calendar/events/${eventId}`);
      await fetchRange();
    },
    [offline, fetchRange],
  );

  const syncGoogle = useCallback(async (): Promise<GoogleSyncResponse> => {
    const res = await api.post<GoogleSyncResponse>('/api/calendar/sync-google');
    await fetchRange();
    return res;
  }, [fetchRange]);

  return {
    events,
    loading,
    offline,
    error,
    reload: fetchRange,
    createEvent,
    updateEvent,
    deleteEvent,
    syncGoogle,
  };
}
