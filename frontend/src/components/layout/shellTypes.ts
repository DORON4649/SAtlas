export type NavSection = 'home' | 'calendar' | 'timetable' | 'assignments' | 'notes' | 'memos' | 'settings';

export const VALID_NAV_SECTIONS: readonly NavSection[] = [
  'home',
  'calendar',
  'timetable',
  'assignments',
  'notes',
  'memos',
  'settings',
];

export function normalizeNavSection(raw: string | null | undefined): NavSection {
  if (!raw) return 'home';
  const cleaned = raw.replace(/^#\/?/, '').trim().toLowerCase();
  if (cleaned === 'dashboard') return 'home';
  return (VALID_NAV_SECTIONS as readonly string[]).includes(cleaned) ? (cleaned as NavSection) : 'home';
}
