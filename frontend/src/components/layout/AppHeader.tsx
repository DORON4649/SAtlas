import { Columns3, KeyRound, LayoutGrid, Lock, LogIn, LogOut, RotateCcw, Unlock, WifiOff } from 'lucide-react';
import type { AuthState } from '../../hooks/useAuth';
import type { LayoutSyncState } from '../../hooks/useDashboardLayout';
import { DISCORD_LOGIN_URL } from '../../lib/api';
import type { ViewMode } from './shellTypes';

interface Props {
  auth: AuthState;
  onLogout: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
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
  viewMode,
  onViewModeChange,
  isEditing,
  onToggleEdit,
  onResetLayout,
  syncState,
  onOpenAiSettings,
}: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur md:px-6">
      {/* ロゴ */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E6BFF] to-[#00A8FF] font-bold text-white shadow-lg shadow-blue-500/20">
          SA
        </div>
        <span className="hidden bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-lg font-bold tracking-wide text-transparent sm:inline">
          SAtlas
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* 表示モード切替 */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-800/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onViewModeChange('dashboard')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${viewMode === 'dashboard' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            title="ダッシュボード（全幅）"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden md:inline">ダッシュボード</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('three-pane')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${viewMode === 'three-pane' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            title="3ペイン（左ナビ / ワークスペース / ツール）"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">3ペイン</span>
          </button>
        </div>

        {/* レイアウト編集 */}
        <span className="hidden text-[11px] text-slate-500 lg:inline">{SYNC_LABEL[syncState]}</span>
        {isEditing && (
          <button
            type="button"
            onClick={onResetLayout}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">配置リセット</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleEdit}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            isEditing ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {isEditing ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isEditing ? '編集完了（ロック）' : 'レイアウト編集'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenAiSettings}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
          title="個人 Gemini API キー・Ollama フォールバック設定"
        >
          <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden md:inline">AI・API設定</span>
        </button>

        <div className="mx-1 h-6 w-px bg-slate-700" />

        {/* 認証 */}
        {auth.status === 'loading' && <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-800" />}

        {auth.status === 'offline' && (
          <span className="flex items-center gap-1 text-[11px] text-amber-300" title="server/ (localhost:8080) に接続できません">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">サーバー未接続</span>
          </span>
        )}

        {auth.status === 'ready' && auth.authenticated && auth.user ? (
          <div className="flex items-center gap-2">
            {auth.user.avatarUrl ? (
              <img src={auth.user.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-slate-700" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold">
                {auth.user.name.slice(0, 1)}
              </div>
            )}
            <span className="hidden max-w-32 truncate text-sm text-slate-200 md:inline">{auth.user.name}</span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
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
                  className="hidden rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 lg:inline"
                  title="未ログインのため開発用テストユーザーで API を利用中"
                >
                  DEV
                </span>
              )}
              <a
                href={DISCORD_LOGIN_URL}
                className="flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:bg-[#4752C4]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Discordでログイン</span>
              </a>
            </>
          )
        )}
      </div>
    </header>
  );
}
