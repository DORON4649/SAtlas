import type { PageBackground } from './oneNoteModel';

export type ThemeMode = 'dark' | 'light' | 'system';
export type StartupView = 'last' | 'home' | 'notes' | 'timetable';
export type AiProviderPriority = 'auto' | 'gemini' | 'ollama';

export interface AppSettings {
  themeMode: ThemeMode;
  startupView: StartupView;
  defaultLeftPaneOpen: boolean;
  defaultRightPaneOpen: boolean;
  aiProviderPriority: AiProviderPriority;
  defaultPageBackground: PageBackground;
  codeTabSize: 2 | 4;
  codeAutoClosePairs: boolean;
  discordWebhookUrl: string;
  discordRichPresence: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: 'dark',
  startupView: 'last',
  defaultLeftPaneOpen: true,
  defaultRightPaneOpen: true,
  aiProviderPriority: 'auto',
  defaultPageBackground: 'grid',
  codeTabSize: 2,
  codeAutoClosePairs: true,
  discordWebhookUrl: '',
  discordRichPresence: false,
};

export const APP_SETTINGS_KEY = 'satlas_app_settings_v1';
export const NAV_STATE_KEY = 'satlas_nav_state_v1';
export const OFFLINE_GEMINI_KEY_STORAGE = 'satlas_gemini_api_key_local';

export interface PersistedNavState {
  section: string;
  selectedNoteId: number | null;
  selectedSubject: string | null;
  selectedSection: string | null;
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'system'
          ? parsed.themeMode
          : DEFAULT_APP_SETTINGS.themeMode,
      startupView:
        parsed.startupView === 'last' ||
        parsed.startupView === 'home' ||
        parsed.startupView === 'notes' ||
        parsed.startupView === 'timetable'
          ? parsed.startupView
          : DEFAULT_APP_SETTINGS.startupView,
      defaultLeftPaneOpen: parsed.defaultLeftPaneOpen ?? DEFAULT_APP_SETTINGS.defaultLeftPaneOpen,
      defaultRightPaneOpen: parsed.defaultRightPaneOpen ?? DEFAULT_APP_SETTINGS.defaultRightPaneOpen,
      aiProviderPriority:
        parsed.aiProviderPriority === 'gemini' ||
        parsed.aiProviderPriority === 'ollama' ||
        parsed.aiProviderPriority === 'auto'
          ? parsed.aiProviderPriority
          : DEFAULT_APP_SETTINGS.aiProviderPriority,
      defaultPageBackground:
        parsed.defaultPageBackground === 'blank' ||
        parsed.defaultPageBackground === 'ruled' ||
        parsed.defaultPageBackground === 'grid'
          ? parsed.defaultPageBackground
          : DEFAULT_APP_SETTINGS.defaultPageBackground,
      codeTabSize: parsed.codeTabSize === 4 ? 4 : 2,
      codeAutoClosePairs: parsed.codeAutoClosePairs ?? DEFAULT_APP_SETTINGS.codeAutoClosePairs,
      discordWebhookUrl: typeof parsed.discordWebhookUrl === 'string' ? parsed.discordWebhookUrl : '',
      discordRichPresence: Boolean(parsed.discordRichPresence),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadNavState(): PersistedNavState {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    if (!raw) {
      return { section: 'home', selectedNoteId: null, selectedSubject: null, selectedSection: null };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedNavState>;
    return {
      section: typeof parsed.section === 'string' ? parsed.section : 'home',
      selectedNoteId: typeof parsed.selectedNoteId === 'number' ? parsed.selectedNoteId : null,
      selectedSubject: typeof parsed.selectedSubject === 'string' ? parsed.selectedSubject : null,
      selectedSection: typeof parsed.selectedSection === 'string' ? parsed.selectedSection : null,
    };
  } catch {
    return { section: 'home', selectedNoteId: null, selectedSubject: null, selectedSection: null };
  }
}

export function saveNavState(state: PersistedNavState): void {
  localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
}

/** themeMode ('dark' | 'light' | 'system') を実際の 'dark' | 'light' に解決して <html> に反映 */
export function applyDocumentTheme(mode: ThemeMode): 'dark' | 'light' {
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved: 'dark' | 'light' = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}
