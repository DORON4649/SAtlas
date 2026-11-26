import { useState, useSyncExternalStore } from 'react';
import { LoaderCircle, Play, Plug, Terminal, Trash2 } from 'lucide-react';
import {
  CODE_LANGUAGE_META,
  getRuntimeBadge,
  isLocalRunnerConnected,
  runCodeCell,
  subscribeRunnerStatus,
  type CodeLanguage,
  type CodeRunResult,
} from '../../lib/codeRunner';

interface Props {
  language: CodeLanguage;
  code: string;
  onChangeCode?: (nextCode: string) => void;
  onChangeLanguage?: (nextLang: CodeLanguage) => void;
  onOpenRunnerSettings?: () => void;
}

const LANGUAGES: CodeLanguage[] = ['python', 'java', 'c'];

  /** ノート内に埋め込まれるハイブリッドコード実行セル（Local PC / Browser WASM / ガイド） */
  export default function CodeExecutionCell({
    language,
    code,
    onChangeCode,
    onChangeLanguage,
    onOpenRunnerSettings,
  }: Props) {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<CodeRunResult | null>(null);

    // ローカルランナー接続状態をリアルタイム購読
    useSyncExternalStore(subscribeRunnerStatus, isLocalRunnerConnected, () => false);

    const meta = CODE_LANGUAGE_META[language];
    const badge = getRuntimeBadge(language);

    const handleRun = async () => {
      if (running) return;
      setRunning(true);
      try {
        const res = await runCodeCell(language, code);
        setResult(res);
      } finally {
        setRunning(false);
      }
    };

    const runtimeLabel = (runtime: CodeRunResult['runtime']) => {
      switch (runtime) {
        case 'local-pc':
          return 'Local PC';
        case 'browser-wasm':
          return 'Browser WASM (Pyodide)';
        case 'sandbox':
          return 'Sandbox';
        case 'custom':
          return 'Custom Runner';
        default:
          return '未接続ガイド';
      }
    };

    return (
        <div className="my-2 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-sm">
          {/* セルヘッダー */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                {onChangeLanguage ? (
                  <select
                    value={language}
                    onChange={(e) => onChangeLanguage(e.target.value as CodeLanguage)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-100 focus:border-blue-500 focus:outline-none"
                    aria-label="実行言語を選択"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {CODE_LANGUAGE_META[lang].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                )}
                <span className="font-mono text-[11px] text-slate-500">{meta.fileHint}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenRunnerSettings && badge.kind !== 'local-pc' && (
                  <button
                    type="button"
                    onClick={onOpenRunnerSettings}
                    className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    title="ローカル PC ランナーへ接続"
                  >
                    <Plug className="h-3 w-3 text-cyan-400" />
                    接続設定
                  </button>
                )}
                {result && (
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    title="出力をクリア"
                  >
                    <Trash2 className="h-3 w-3" />
                    クリア
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleRun()}
                  disabled={running}
                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {running ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                  実行 (Run)
                </button>
              </div>
            </div>

            {/* コード編集エリア */}
            <textarea
              value={code}
              onChange={(e) => onChangeCode?.(e.target.value)}
              readOnly={!onChangeCode}
              spellCheck={false}
              rows={Math.max(3, Math.min(18, code.split('\n').length + 1))}
              className="w-full resize-y bg-slate-950 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none"
              placeholder={`${meta.label} コードを入力...`}
            />

            {/* 出力コンソール枠 */}
            <div className="border-t border-slate-800 bg-slate-900/70 px-3.5 py-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
                <span>出力コンソール</span>
                {result && (
                    <span className="font-mono text-slate-400">
                      {runtimeLabel(result.runtime)}
                      {result.runtime !== 'guide' && ` · exit ${result.exitCode} · ${result.durationMs}ms`}
                    </span>
          )}
                  </div>
                  {
                    running?(
          <p className = "flex items-center gap-1.5 font-mono text-[11px] text-cyan-300" >
                        <LoaderCircle className="h-3 w-3 animate-spin" />
            { language === 'python' && badge.kind === 'browser-wasm'
                    ? 'Browser WASM (Pyodide) で実行中（初回のみランタイム読込を行います）...'
                    : 'コードを実行中...'}
              </p>
              ) : !result ? (
              <p className="font-mono text-[11px] text-slate-500">
                「実行 (Run)」を押すとここに標準出力・エラーが表示されます。
              </p>
              ) : (
              <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
                {result.stdout && (
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/90 p-2.5 text-emerald-300">
                    {result.stdout}
                  </pre>
                )}
                {result.stderr && (
                  <pre
                  result.runtime === 'guide'
                  ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {result.stderr}
              </pre>
            )}
              {!result.stdout && !result.stderr && (
                <p className="text-slate-500">（出力なし・正常終了）</p>
              )}
            </div>
        )}
          </div>
        </div>
        );
}
