import { KeyRound, Lock, LogIn, LogOut, Moon, RotateCcw, Sun, Unlock, WifiOff } from 'lucide-react';
import type { AuthState } from '../../hooks/useAuth';
import type { LayoutSyncState } from '../../hooks/useDashboardLayout';
import { DISCORD_LOGIN_URL } from '../../lib/api';
import SidebarToggleIcon from './SidebarToggleIcon';
import type { NavSection } from './shellTypes';

interface Props {
  auth: AuthState;
  onLogout: () => void;
  activeSection: NavSection;
  leftPaneOpen: boolean;
  rightPaneOpen: boolean;
  onToggleLeftPane: () => void;
  onToggleRightPane: () => void;
  resolvedTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  onResetLayout: () => void;
  syncState: LayoutSyncState;
  onOpenAiSettings: () => void;
}

const SYNC_LABEL: Record<LayoutSyncState, string> = {
  local: 'ローカル保存',
  synced: 'サーバー同期済み',
  saving: '保存中...',
  error: '同期エラー',
};

export default function AppHeader({
  auth,
  onLogout,
  activeSection,
  leftPaneOpen,
  rightPaneOpen,
  onToggleLeftPane,
  onToggleRightPane,
  resolvedTheme,
  onToggleTheme,
  isEditing,
  onToggleEdit,
  onResetLayout,
  syncState,
  onOpenAiSettings,
}: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur md:px-6">
      {/* ロゴ ＋ 左サイドバー開閉 */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleLeftPane}
          title={leftPaneOpen ? '左サイドバーを折りたたむ (Ctrl+\\)' : '左サイドバーを展開 (Ctrl+\\)'}
          aria-label={leftPaneOpen ? '左サイドバーを折りたたむ' : '左サイドバーを展開'}
          aria-pressed={leftPaneOpen}
          className={`rounded-lg border p-1.5 transition-colors ${
            leftPaneOpen
              ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          <SidebarToggleIcon side="left" open={leftPaneOpen} className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E6BFF] to-[#00A8FF] font-bold text-white shadow-lg shadow-blue-500/20">
          SA
        </div>
        <span className="hidden bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-lg font-bold tracking-wide text-transparent sm:inline">
          SAtlas
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* ホーム表示時のみダッシュボードレイアウト編集コントロール */}
        {activeSection === 'home' && (
          <>
            <span className="hidden text-[11px] text-slate-500 lg:inline">{SYNC_LABEL[syncState]}</span>
            {isEditing && (
              <button
                type="button"
                onClick={onResetLayout}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">配置リセット</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleEdit}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                isEditing
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isEditing ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isEditing ? '編集完了' : 'レイアウト編集'}</span>
            </button>
          </>
        )}

        {/* ワンクリック ライト / ダーク テーマ切替 */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={resolvedTheme === 'dark' ? 'ライトテーマへ切替' : 'ダークテーマへ切替'}
          aria-label="テーマ切替"
          className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition-colors hover:bg-slate-700 hover:text-amber-400"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-indigo-500" />}
        </button>

        <button
          type="button"
          onClick={onOpenAiSettings}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-500 transition-colors hover:bg-cyan-500/20 dark:text-cyan-200"
          title="個人 Gemini API キー・Ollama フォールバック設定"
        >
          <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden md:inline">AI・API設定</span>
        </button>

        <div className="mx-1 h-6 w-px bg-slate-700" />

        {/* 認証 */}
        {auth.status === 'loading' && <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-800" />}

        {auth.status === 'offline' && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400" title="server/ (localhost:8080) に接続できません">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">オフライン</span>
          </span>
        )}

        {auth.status === 'ready' && auth.authenticated && auth.user ? (
          <div className="flex items-center gap-2">
            {auth.user.avatarUrl ? (
              <img src={auth.user.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-slate-700" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-white">
                {auth.user.name.slice(0, 1)}
              </div>
            )}
            <span className="hidden max-w-32 truncate text-sm text-slate-200 md:inline">{auth.user.name}</span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              title="ログアウト"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          auth.status !== 'loading' && (
            <>
              {auth.status === 'ready' && auth.devFallback && (
                <span
                  className="hidden rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 lg:inline"
                  title="未ログインのため開発用テストユーザーで API を利用中"
                >
                  DEV
                </span>
              )}
              <a
                href={DISCORD_LOGIN_URL}
                className="flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-colors hover:bg-[#4752C4]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Discordでログイン</span>
              </a>
            </>
          )
        )}

        {/* 右サイドバー開閉 */}
        <button
          type="button"
          onClick={onToggleRightPane}
          title={rightPaneOpen ? 'AIパネルを折りたたむ' : 'AIパネルを展開'}
          aria-label={rightPaneOpen ? 'AIパネルを折りたたむ' : 'AIパネルを展開'}
          aria-pressed={rightPaneOpen}
          className={`rounded-lg border p-1.5 transition-colors ${
            rightPaneOpen
              ? 'border-violet-500/40 bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          <SidebarToggleIcon side="right" open={rightPaneOpen} className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
