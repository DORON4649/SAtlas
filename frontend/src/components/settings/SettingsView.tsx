import { useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  CircleCheck,
  Code,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Plug,
  PlugZap,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Trash,
  Upload,
  User,
  WifiOff,
} from 'lucide-react';
import type { AuthState } from '../../hooks/useAuth';
import { api, errorMessage } from '../../lib/api';
import {
  OFFLINE_GEMINI_KEY_STORAGE,
  type AiProviderPriority,
  type AppSettings,
  type StartupView,
  type ThemeMode,
} from '../../lib/appSettings';
import {
  loadRunnerConfig,
  saveRunnerConfig,
  testLocalRunnerConnection,
  type LocalRunnerConfig,
} from '../../lib/codeRunner';
import type { PageBackground } from '../../lib/oneNoteModel';
import {
  checkForDesktopUpdate,
  installDesktopUpdateAndRelaunch,
  isTauriDesktop,
  type UpdateCheckResult,
} from '../../lib/tauriUpdater';
import type { AiChatResponse, CurrentUser, LectureNote } from '../../types';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  auth: AuthState;
  onRefreshAuth: () => Promise<void>;
  onLoginWithDiscord: () => void;
  onLogout: () => void;
  leftPaneOpen: boolean;
  rightPaneOpen: boolean;
  notes: LectureNote[];
  onImportBackup: (data: { settings?: Partial<AppSettings>; notes?: LectureNote[] }) => Promise<number>;
  onOpenGoogleModal: () => void;
  onReplayTutorial: () => void;
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma4:12b';

const cardCls = 'rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4';
const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none';
const btnCls =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-40';

/**
 * SAtlas 統合「設定（Settings）」ビュー。
 * 1. 外観・表示レイアウト / 2. アカウント・同期 / 3. AI アシスタント /
 * 4. ノート・エディタ / 5. Discord 連携 / 6. データ管理・バックアップ
 */
export default function SettingsView({
  settings,
  onUpdateSettings,
  auth,
  onRefreshAuth,
  onLoginWithDiscord,
  onLogout,
  leftPaneOpen,
  rightPaneOpen,
  notes,
  onImportBackup,
  onOpenGoogleModal,
  onReplayTutorial,
}: Props) {
  const user = auth.status === 'ready' ? auth.user : null;
  const offline = auth.status === 'offline';

  // AI 設定
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [localGeminiKey, setLocalGeminiKey] = useState(() => localStorage.getItem(OFFLINE_GEMINI_KEY_STORAGE) ?? '');
  const [ollamaUrl, setOllamaUrl] = useState(() => user?.ollamaBaseUrl || DEFAULT_OLLAMA_URL);
  const [ollamaModel, setOllamaModel] = useState(() => user?.ollamaModel || DEFAULT_OLLAMA_MODEL);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<'idle' | 'saving' | 'testing' | 'ollama'>('idle');
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // ローカルランナー設定
  const [runnerCfg, setRunnerCfg] = useState<LocalRunnerConfig>(() => loadRunnerConfig());
  const [runnerTesting, setRunnerTesting] = useState(false);
  const [runnerStatus, setRunnerStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Discord Webhook
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // バックアップ
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [paneSavedToast, setPaneSavedToast] = useState(false);

  // デスクトップ自動アップデート
  const isDesktop = isTauriDesktop();
  const [updateBusy, setUpdateBusy] = useState<'idle' | 'checking' | 'installing'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateMessage, setUpdateMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleCheckUpdate = async () => {
    if (!isDesktop) {
      setUpdateMessage({ ok: true, text: 'Web ブラウザ版で実行中です（自動アップデートは Desktop アプリ版で利用できます）' });
      return;
    }
    setUpdateBusy('checking');
    setUpdateMessage(null);
    try {
      const res = await checkForDesktopUpdate();
      setUpdateInfo(res);
      setUpdateMessage(
        res.available
          ? { ok: true, text: `新しいバージョン v${res.version} が利用可能です！` }
          : { ok: true, text: 'お使いの SAtlas Desktop は最新バージョンです。' },
      );
    } catch (e) {
      setUpdateMessage({
        ok: false,
        text: `アップデート確認に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setUpdateBusy('idle');
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateInfo?.update) return;
    setUpdateBusy('installing');
    setUpdateProgress(0);
    setUpdateMessage(null);
    try {
      await installDesktopUpdateAndRelaunch(updateInfo.update, setUpdateProgress);
    } catch (e) {
      setUpdateMessage({
        ok: false,
        text: `アップデートの適用に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
      });
      setUpdateBusy('idle');
    }
  };

  const hasGeminiKey = offline ? Boolean(localGeminiKey) : Boolean(user?.hasGeminiApiKey);
  const maskedGeminiKey = offline
    ? localGeminiKey
      ? `${localGeminiKey.slice(0, 4)}****`
      : null
    : user?.geminiApiKeyMasked ?? null;

  // ---- 3. AI アシスタント操作 ----
  const handleSaveAiConfig = async () => {
    setAiBusy('saving');
    setAiStatus(null);
    const enableFallback = settings.aiProviderPriority !== 'gemini';
    try {
      if (offline) {
        if (geminiKeyInput.trim()) {
          localStorage.setItem(OFFLINE_GEMINI_KEY_STORAGE, geminiKeyInput.trim());
          setLocalGeminiKey(geminiKeyInput.trim());
          setGeminiKeyInput('');
        }
        setAiStatus({ ok: true, text: 'オフラインのためブラウザのローカル設定へ保存しました' });
        return;
      }
      const payload: Record<string, unknown> = {
        enableOllamaFallback: enableFallback,
        ollamaBaseUrl: ollamaUrl.trim() || DEFAULT_OLLAMA_URL,
        ollamaModel: ollamaModel.trim() || DEFAULT_OLLAMA_MODEL,
      };
      if (geminiKeyInput.trim()) {
        payload.geminiApiKey = geminiKeyInput.trim();
      }
      await api.patch<CurrentUser>('/api/me', payload);
      await onRefreshAuth();
      setGeminiKeyInput('');
      setAiStatus({ ok: true, text: 'AI・API設定をサーバーに暗号化保存しました' });
    } catch (e) {
      setAiStatus({ ok: false, text: errorMessage(e) });
    } finally {
      setAiBusy('idle');
    }
  };

  const handleDeleteGeminiKey = async () => {
    setAiBusy('saving');
    setAiStatus(null);
    try {
      if (offline) {
        localStorage.removeItem(OFFLINE_GEMINI_KEY_STORAGE);
        setLocalGeminiKey('');
        setAiStatus({ ok: true, text: 'ローカル保存の Gemini API キーを削除しました' });
        return;
      }
      await api.patch<CurrentUser>('/api/me', { geminiApiKey: '' });
      await onRefreshAuth();
      setAiStatus({ ok: true, text: '登録済みの Gemini API キーを削除しました' });
    } catch (e) {
      setAiStatus({ ok: false, text: errorMessage(e) });
    } finally {
      setAiBusy('idle');
    }
  };

  const handleTestAiConnection = async () => {
    setAiBusy('testing');
    setAiStatus(null);
    try {
      const res = await api.post<AiChatResponse>('/api/ai/chat', {
        message: '接続テストです。「OK」とだけ短く返答してください。',
        contextType: 'NONE',
      });
      setAiStatus({
        ok: true,
        text: `接続成功（${res.provider === 'OLLAMA_FALLBACK' ? 'Ollama' : 'Gemini'} / ${res.model}）: ${res.reply.slice(0, 60)}`,
      });
    } catch (e) {
      setAiStatus({ ok: false, text: errorMessage(e) });
    } finally {
      setAiBusy('idle');
    }
  };

  const handleFetchOllamaModels = async () => {
    setAiBusy('ollama');
    setAiStatus(null);
    const base = (ollamaUrl.trim() || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models?: { name: string }[] };
      const names = (data.models ?? []).map((m) => m.name).filter(Boolean);
      setOllamaModels(names);
      if (names.length > 0 && !names.includes(ollamaModel)) {
        setOllamaModel(names[0]);
      }
      setAiStatus({
        ok: true,
        text: names.length > 0 ? `Ollama 接続成功（${names.length} 件のモデルを検出）` : 'Ollama 接続成功（モデル未登録）',
      });
    } catch (e) {
      setAiStatus({
        ok: false,
        text: `Ollama (${base}) へ接続できませんでした: ${e instanceof Error ? e.message : 'CORSまたは未起動'}`,
      });
    } finally {
      setAiBusy('idle');
    }
  };

  // ---- 4. ローカルランナー ----
  const handleSaveAndTestRunner = async () => {
    saveRunnerConfig(runnerCfg);
    setRunnerTesting(true);
    setRunnerStatus(null);
    try {
      const res = await testLocalRunnerConnection(runnerCfg);
      setRunnerStatus({ ok: res.connected, text: res.message });
    } finally {
      setRunnerTesting(false);
    }
  };

  // ---- 5. Discord Webhook テスト ----
  const handleTestDiscordWebhook = async () => {
    const url = settings.discordWebhookUrl.trim();
    if (!url.startsWith('https://discord.com/api/webhooks/') && !url.startsWith('https://discordapp.com/api/webhooks/')) {
      setWebhookStatus({ ok: false, text: '有効な Discord Webhook URL (https://discord.com/api/webhooks/...) を入力してください' });
      return;
    }
    setWebhookBusy(true);
    setWebhookStatus(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'SAtlas',
          content: '✅ SAtlas からのテスト通知です（Discord Webhook 連携が正常に動作しています）',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWebhookStatus({ ok: true, text: 'Discord へテスト通知を送信しました！' });
    } catch (e) {
      setWebhookStatus({
        ok: false,
        text: `送信に失敗しました: ${e instanceof Error ? e.message : 'ネットワークエラー'}`,
      });
    } finally {
      setWebhookBusy(false);
    }
  };

  // ---- 6. バックアップ ----
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 2,
      settings,
      notes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus({ ok: true, text: `ノート ${notes.length} 件と設定を JSON エクスポートしました` });
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setBackupStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { settings?: Partial<AppSettings>; notes?: LectureNote[] };
      const count = await onImportBackup(parsed);
      setBackupStatus({ ok: true, text: `バックアップを復元しました（ノート ${count} 件を取り込み）` });
    } catch (e) {
      setBackupStatus({ ok: false, text: `復元に失敗しました: ${e instanceof Error ? e.message : '不正なJSON'}` });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-white">
            <Settings className="h-5 w-5 text-indigo-400" />
            環境設定（Settings）
          </h1>
          <p className="mt-0.5 text-slate-400">
            外観・レイアウト・AI・エディタ・Discord 連携・バックアップを一元管理します。
          </p>
        </div>
      </div>

      {/* 1. 外観・表示レイアウト */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sun className="h-4 w-4 text-amber-400" />
          1. 外観・表示レイアウト
        </h2>

        {/* カラーテーマ */}
        <div className="space-y-1.5">
          <label className="block font-medium text-slate-300">カラーテーマ</label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['dark', 'ダーク', Moon],
                ['light', 'ライト', Sun],
                ['system', 'システム設定に従う', Monitor],
              ] as [ThemeMode, string, typeof Moon][]
            ).map(([mode, label, Icon]) => {
              const active = settings.themeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdateSettings({ themeMode: mode })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 font-medium transition-colors ${
                    active
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/40'
                      : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 起動時の初期ビュー */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block font-medium text-slate-300">起動時の初期ビュー</label>
            <select
              value={settings.startupView}
              onChange={(e) => onUpdateSettings({ startupView: e.target.value as StartupView })}
              className={inputCls}
            >
              <option value="last">前回の続き（デフォルト・リロード時復元）</option>
              <option value="home">ホーム（ダッシュボード）</option>
              <option value="notes">講義ノートブック</option>
              <option value="timetable">時間割</option>
            </select>
          </div>

          {/* 3ペインのデフォルト開閉設定 */}
          <div className="space-y-1.5">
            <label className="block font-medium text-slate-300">3ペインのデフォルト開閉</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ defaultLeftPaneOpen: !settings.defaultLeftPaneOpen })}
                className={btnCls}
              >
                左ペイン: <strong className="text-indigo-300">{settings.defaultLeftPaneOpen ? '展開' : '折りたたみ'}</strong>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ defaultRightPaneOpen: !settings.defaultRightPaneOpen })}
                className={btnCls}
              >
                右ペイン: <strong className="text-violet-300">{settings.defaultRightPaneOpen ? '展開' : '折りたたみ'}</strong>
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({
                    defaultLeftPaneOpen: leftPaneOpen,
                    defaultRightPaneOpen: rightPaneOpen,
                  });
                  setPaneSavedToast(true);
                  window.setTimeout(() => setPaneSavedToast(false), 2000);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                {paneSavedToast ? <CircleCheck className="h-3.5 w-3.5" /> : null}
                {paneSavedToast ? '保存しました' : '現在のペイン配置をデフォルトとして保存'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. アカウント・同期 */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <User className="h-4 w-4 text-cyan-400" />
          2. アカウント・同期
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full border border-slate-700" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">
                {user?.name?.slice(0, 1) ?? 'G'}
              </div>
            )}
            <div>
              <div className="font-semibold text-white">
                {auth.status === 'ready' && auth.authenticated && user
                  ? user.name
                  : auth.status === 'ready' && auth.devFallback
                    ? `${user?.name ?? '開発用ユーザー'}（DEV モード）`
                    : 'オフライン（ローカルモード）'}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                {offline ? (
                  <span className="flex items-center gap-1 text-amber-300">
                    <WifiOff className="h-3 w-3" />
                    バックエンド未接続（localStorage 動作中）
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CircleCheck className="h-3 w-3" />
                    バックエンド接続済み
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onOpenGoogleModal} className={btnCls}>
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              Google iCal 設定
            </button>
            {auth.status === 'ready' && auth.authenticated ? (
              <button type="button" onClick={onLogout} className={btnCls}>
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                ログアウト
              </button>
            ) : (
              <button
                type="button"
                onClick={onLoginWithDiscord}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752C4]"
              >
                <LogIn className="h-3.5 w-3.5" />
                Discord でログイン
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. AI アシスタント設定 */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-cyan-400" />
          3. AI アシスタント設定（BYOK / Ollama フォールバック）
        </h2>

        <div className="space-y-1.5">
          <label className="block font-medium text-slate-300">AI プロバイダー優先順位</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ['auto', '自動フォールバック（推奨）'],
                ['gemini', 'Gemini API 優先'],
                ['ollama', 'ローカル Ollama 優先'],
              ] as [AiProviderPriority, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onUpdateSettings({ aiProviderPriority: val })}
                className={`rounded-xl border px-3 py-2 text-left font-medium transition-colors ${
                  settings.aiProviderPriority === val
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200'
                    : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              個人 Gemini API キー
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
              {hasGeminiKey ? `登録済み (${maskedGeminiKey ?? '****'})` : '未登録'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder={hasGeminiKey ? '新しいキーで上書きする場合のみ入力' : 'AIza...'}
                className={`${inputCls} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {hasGeminiKey && (
              <button type="button" onClick={() => void handleDeleteGeminiKey()} className={btnCls}>
                <Trash className="h-3.5 w-3.5 text-rose-400" />
                削除
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1 font-medium text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-amber-400" />
              ローカル Ollama URL
            </label>
            <input
              type="url"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder={DEFAULT_OLLAMA_URL}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-300">使用モデル名</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="gemma4:12b / gemma2:2b"
              className={inputCls}
            />
          </div>
        </div>

        {ollamaModels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">検出モデル:</span>
            {ollamaModels.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setOllamaModel(m)}
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  ollamaModel === m
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={aiBusy !== 'idle'}
            onClick={() => void handleSaveAiConfig()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {aiBusy === 'saving' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            AI 設定を保存
          </button>
          <button type="button" disabled={aiBusy !== 'idle'} onClick={() => void handleTestAiConnection()} className={btnCls}>
            {aiBusy === 'testing' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 text-cyan-400" />}
            AI 接続テスト
          </button>
          <button type="button" disabled={aiBusy !== 'idle'} onClick={() => void handleFetchOllamaModels()} className={btnCls}>
            {aiBusy === 'ollama' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-amber-400" />}
            Ollama モデル一覧取得テスト
          </button>
        </div>

        {aiStatus && (
          <div
            className={`rounded-lg border px-3 py-2 ${
              aiStatus.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {aiStatus.text}
          </div>
        )}
      </section>

      {/* 4. ノート・エディタ設定 */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Code className="h-4 w-4 text-emerald-400" />
          4. ノート・エディタ設定
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block font-medium text-slate-300">新規ページのデフォルト背景</label>
            <select
              value={settings.defaultPageBackground}
              onChange={(e) => onUpdateSettings({ defaultPageBackground: e.target.value as PageBackground })}
              className={inputCls}
            >
              <option value="blank">無地</option>
              <option value="ruled">横罫線</option>
              <option value="grid">5mm方眼</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-300">コードブロックのインデント幅</label>
            <select
              value={settings.codeTabSize}
              onChange={(e) => onUpdateSettings({ codeTabSize: Number(e.target.value) === 4 ? 4 : 2 })}
              className={inputCls}
            >
              <option value={2}>2 スペース</option>
              <option value={4}>4 スペース</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
            <div>
              <div className="font-medium text-slate-200">括弧・クォート自動補完</div>
              <div className="text-[10px] text-slate-500">Auto-Closing Pairs</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.codeAutoClosePairs}
              onClick={() => onUpdateSettings({ codeAutoClosePairs: !settings.codeAutoClosePairs })}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                settings.codeAutoClosePairs ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  settings.codeAutoClosePairs ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ローカルコード実行ブリッジ */}
        <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Plug className="h-3.5 w-3.5 text-cyan-400" />
              ローカルコード実行ブリッジ（runner/satlas_runner.py）
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={runnerCfg.enabled}
                onChange={(e) => setRunnerCfg({ ...runnerCfg, enabled: e.target.checked })}
                className="accent-indigo-500"
              />
              有効
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={runnerCfg.url}
              onChange={(e) => setRunnerCfg({ ...runnerCfg, url: e.target.value })}
              placeholder="ws://127.0.0.1:9123"
              className={inputCls}
            />
            <input
              type="password"
              value={runnerCfg.token}
              onChange={(e) => setRunnerCfg({ ...runnerCfg, token: e.target.value })}
              placeholder="ワンタイムトークン"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={runnerTesting}
              onClick={() => void handleSaveAndTestRunner()}
              className={btnCls}
            >
              {runnerTesting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 text-emerald-400" />}
              保存して接続テスト
            </button>
            {runnerStatus && (
              <span className={runnerStatus.ok ? 'text-emerald-300' : 'text-rose-300'}>{runnerStatus.text}</span>
            )}
          </div>
        </div>
      </section>

      {/* 5. Discord 連携 */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Bell className="h-4 w-4 text-indigo-400" />
          5. Discord 連携（Web / Desktop 共通下地）
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block font-medium text-slate-300">Discord Webhook URL（課題・予定リマインダー通知用）</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={settings.discordWebhookUrl}
                onChange={(e) => onUpdateSettings({ discordWebhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className={`${inputCls} min-w-0 flex-1`}
              />
              <button
                type="button"
                disabled={webhookBusy || !settings.discordWebhookUrl.trim()}
                onClick={() => void handleTestDiscordWebhook()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4752C4] disabled:opacity-40"
              >
                {webhookBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                テスト通知を送信
              </button>
            </div>
            {webhookStatus && (
              <p className={`mt-1.5 ${webhookStatus.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {webhookStatus.text}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-1.5 font-medium text-slate-200">
                <Radio className="h-3.5 w-3.5 text-indigo-400" />
                Discord Rich Presence（作業中ステータス共有）
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                将来の Desktop アプリ版で、開いている科目ノートや学習中ステータスを Discord プロフィールに表示します。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.discordRichPresence}
              onClick={() => onUpdateSettings({ discordRichPresence: !settings.discordRichPresence })}
              className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                settings.discordRichPresence ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  settings.discordRichPresence ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 6. データ管理・バックアップ */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database className="h-4 w-4 text-violet-400" />
          6. データ管理・バックアップ
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleExportJson} className={btnCls}>
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            ノート＆設定を JSON エクスポート
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={btnCls}>
            <Upload className="h-3.5 w-3.5 text-emerald-400" />
            JSON からインポート（復元）
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void handleImportFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={onReplayTutorial} className={btnCls}>
            <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
            ノートブックの使い方チュートリアルを再表示
          </button>
        </div>
        {backupStatus && (
          <div
            className={`rounded-lg border px-3 py-2 ${
              backupStatus.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {backupStatus.text}
          </div>
        )}
      </section>

      {/* 7. デスクトップアプリ・自動アップデート */}
      <section className={cardCls}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <RefreshCw className="h-4 w-4 text-emerald-400" />
          7. アプリのアップデート（GitHub Releases）
        </h2>
        <p className="text-[11px] leading-relaxed text-slate-400">
          {isDesktop
            ? 'Tauri Desktop 環境で動作中です。GitHub Releases から最新バージョンを確認し、ワンクリックで更新・再起動できます。'
            : '現在は Web ブラウザ版で動作中です。Windows 向け Desktop アプリ版（Tauri v2）では自動アップデートとネイティブコード実行が利用できます。'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={updateBusy !== 'idle'}
            onClick={() => void handleCheckUpdate()}
            className={btnCls}
          >
            {updateBusy === 'checking' ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
            )}
            アップデートを確認
          </button>

          {updateInfo?.available && updateInfo.update && (
            <button
              type="button"
              disabled={updateBusy !== 'idle'}
              onClick={() => void handleInstallUpdate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {updateBusy === 'installing' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              {updateBusy === 'installing'
                ? `ダウンロード中${updateProgress !== null ? ` (${updateProgress}%)` : '...'}`
                : `v${updateInfo.version} をダウンロード＆再起動`}
            </button>
          )}
        </div>

        {updateMessage && (
          <div
            className={`rounded-lg border px-3 py-2 ${
              updateMessage.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {updateMessage.text}
          </div>
        )}
      </section>
    </div>
  );
}
