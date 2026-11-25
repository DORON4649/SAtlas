import { useEffect, useState } from 'react';
import { Cpu, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, Trash, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { CurrentUser } from '../../types';

interface Props {
  user: CurrentUser | null;
  offline: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma4:12b';

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50';

/**
 * 個人 Gemini API キー（BYOK・AES-GCM 暗号化保存）と
 * トークン上限時のローカル LLM（Ollama）自動フォールバック設定モーダル。
 */
export default function AiSettingsModal({ user, offline, onClose, onUpdated }: Props) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [enableOllamaFallback, setEnableOllamaFallback] = useState(user?.enableOllamaFallback ?? false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(user?.ollamaBaseUrl || DEFAULT_OLLAMA_URL);
  const [ollamaModel, setOllamaModel] = useState(user?.ollamaModel || DEFAULT_OLLAMA_MODEL);

  const [busy, setBusy] = useState<'idle' | 'saving' | 'deleting'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasKey = Boolean(user?.hasGeminiApiKey);
  const maskedKey = user?.geminiApiKeyMasked ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && busy === 'idle' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const handleSave = async () => {
    if (offline) {
      setError('サーバー未接続のため設定を保存できません（server/ を起動してください）');
      return;
    }
    setBusy('saving');
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        enableOllamaFallback,
        ollamaBaseUrl: ollamaBaseUrl.trim() || DEFAULT_OLLAMA_URL,
        ollamaModel: ollamaModel.trim() || DEFAULT_OLLAMA_MODEL,
      };
      // 空欄のまま保存した場合は既存キーを維持（削除は専用ボタンから）
      if (apiKeyInput.trim()) {
        payload.geminiApiKey = apiKeyInput.trim();
      }
      await api.patch<CurrentUser>('/api/me', payload);
      await onUpdated();
      setApiKeyInput('');
      setMessage('AI・API設定を保存しました');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('idle');
    }
  };

  const handleDeleteKey = async () => {
    if (offline) {
      setError('サーバー未接続のため削除できません');
      return;
    }
    setBusy('deleting');
    setError(null);
    setMessage(null);
    try {
      await api.patch<CurrentUser>('/api/me', { geminiApiKey: '' });
      await onUpdated();
      setApiKeyInput('');
      setMessage('登録済みの Gemini API キーを削除しました');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && busy === 'idle' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <KeyRound className="h-4 w-4 text-cyan-400" />
            AI・API 個人設定（BYOK）
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== 'idle'}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          {/* 個人 Gemini API キー */}
          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-800/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-100">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                個人 Gemini API キー
              </span>
              {hasKey ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  登録済み {maskedKey ? `(${maskedKey})` : ''}
                </span>
              ) : (
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                  未登録
                </span>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-slate-400">
              登録したキーはサーバー側で AES-256-GCM 暗号化して保存され、チャット・PDF時間割解析で最優先に使用されます。
            </p>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasKey ? '新しいキーで上書きする場合のみ入力' : 'AIza...'}
                  autoComplete="off"
                  className={`${inputCls} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showKey ? 'キーを隠す' : 'キーを表示'}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {hasKey && (
                <button
                  type="button"
                  disabled={busy !== 'idle'}
                  onClick={() => void handleDeleteKey()}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                  title="登録済みキーを削除"
                >
                  {busy === 'deleting' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" />}
                  削除
                </button>
              )}
            </div>
          </div>

          {/* Ollama 自動フォールバック設定 */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                  <Cpu className="h-4 w-4 text-amber-400" />
                  トークン切れ時にローカルLLM（Ollama）へ自動フォールバックする
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Gemini のレート制限 (429) やクォータ超過時、またはキー未設定時に自動で Ollama へ切り替えます。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enableOllamaFallback}
                onClick={() => setEnableOllamaFallback((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${
                  enableOllamaFallback ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    enableOllamaFallback ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {enableOllamaFallback && (
              <div className="grid grid-cols-1 gap-2.5 border-t border-slate-800 pt-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">Ollama 接続先 URL</label>
                  <input
                    type="url"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder={DEFAULT_OLLAMA_URL}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">モデル名</label>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder={DEFAULT_OLLAMA_MODEL}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>

          {message && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
              {error}
            </div>
          )}

          {/* フッター */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy !== 'idle'}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={busy !== 'idle'}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {busy === 'saving' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              設定を保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
