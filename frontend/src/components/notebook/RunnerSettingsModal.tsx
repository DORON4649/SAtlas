import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Plug, Terminal, X, XCircle } from 'lucide-react';
import {
  loadRunnerConfig,
  saveRunnerConfig,
  testLocalRunnerConnection,
  type LocalRunnerConfig,
} from '../../lib/codeRunner';

interface Props {
  onClose: () => void;
}

/** ローカルコード実行ブリッジ (runner/satlas_runner.py) の接続設定モーダル */
export default function RunnerSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<LocalRunnerConfig>(() => loadRunnerConfig());
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);

  const handleSaveAndTest = async () => {
    saveRunnerConfig(config);
    setTesting(true);
    try {
      const res = await testLocalRunnerConnection(config);
      setStatus(res);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">ローカルコード実行ブリッジ設定</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 leading-relaxed text-slate-300">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-cyan-300">
              <Terminal className="h-3.5 w-3.5" />
              起動手順（Python / Java / C をローカル PC で実行）
            </div>
            <p className="text-[11px] text-slate-400">
              1. ターミナルで以下のコマンドを実行します（追加ライブラリ不要）：
            </p>
            <pre className="my-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-emerald-300">
              python runner/satlas_runner.py
            </pre>
            <p className="text-[11px] text-slate-400">
              2. 表示されたワンタイムトークンを下の欄に貼り付けて「保存して接続テスト」を押してください。
              未接続時でも Python セルはブラウザ内 WebAssembly (Pyodide) でそのまま実行できます。
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500"
            />
            ローカル PC ランナーへの自動接続を有効にする
          </label>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-400">WebSocket URL</label>
            <input
              type="text"
              value={config.url}
              onChange={(e) => setConfig((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="ws://127.0.0.1:9123"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-400">ワンタイムトークン</label>
            <input
              type="password"
              value={config.token}
              onChange={(e) => setConfig((prev) => ({ ...prev, token: e.target.value }))}
              placeholder="satlas_runner.py 起動時に表示されたトークンを貼り付け"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {status && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                status.connected
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
              }`}
            >
              {status.connected ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{status.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            閉じる
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAndTest()}
            disabled={testing}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {testing && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            保存して接続テスト
          </button>
        </div>
      </div>
    </div>
  );
}
