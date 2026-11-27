import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Copy, LoaderCircle, Play, Plug, Terminal, Trash } from 'lucide-react';
import {
  CODE_BLOCK_META,
  DISPLAY_LANGUAGES,
  RUNNABLE_LANGUAGES,
  highlightCodeHtml,
  isRunnableLanguage,
  type CodeBlockLanguage,
} from '../../lib/codeHighlight';
import {
  getRuntimeBadge,
  isLocalRunnerConnected,
  runCodeCell,
  subscribeRunnerStatus,
  type CodeRunResult,
} from '../../lib/codeRunner';

interface Props {
  language: CodeBlockLanguage;
  code: string;
  fileName?: string;
  /** 設定画面からのインデント幅上書き (2 or 4) */
  tabSizeOverride?: 2 | 4;
  /** 設定画面からの括弧・クォート自動補完 ON/OFF */
  autoClosePairs?: boolean;
  onChangeCode?: (nextCode: string) => void;
  onChangeLanguage?: (nextLang: CodeBlockLanguage) => void;
  onChangeFileName?: (nextFileName: string) => void;
  onOpenRunnerSettings?: () => void;
}

const AUTO_CLOSE_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};
const CLOSING_CHARS = new Set([')', ']', '}', '"', "'", '`']);
const QUOTE_CHARS = new Set(['"', "'", '`']);

/**
 * VS Code Dark+ 風の多言語コードブロック＆ハイブリッド実行セル。
 * - Python / Java / C: 実行ボタン・実行環境バッジ・出力コンソールを表示
 * - その他 12 言語: 純粋なシンタックスハイライト付きコードブロックとして表示
 * - 行番号ガター・Tab / Shift+Tab インデント・Enter 自動インデント・ファイル名編集・コピー対応
 */
export default function CodeExecutionCell({
  language,
  code,
  fileName,
  tabSizeOverride,
  autoClosePairs = true,
  onChangeCode,
  onChangeLanguage,
  onChangeFileName,
  onOpenRunnerSettings,
}: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  useSyncExternalStore(subscribeRunnerStatus, isLocalRunnerConnected, () => false);

  const meta = CODE_BLOCK_META[language] ?? CODE_BLOCK_META.plaintext;
  const effectiveTabSize = tabSizeOverride ?? meta.tabSize;
  const runnable = isRunnableLanguage(language);
  const badge = runnable ? getRuntimeBadge(language) : null;
  const displayFileName = fileName ?? meta.defaultFileName;
  const lineCount = Math.max(1, code.split('\n').length);
  const visibleRows = Math.max(4, Math.min(20, lineCount + 1));

  const highlightedHtml = useMemo(() => {
    const html = highlightCodeHtml(code, language);
    return code.endsWith('\n') ? `${html}\n` : html;
  }, [code, language]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleRun = async () => {
    if (!runnable || running) return;
    setRunning(true);
    try {
      const res = await runCodeCell(language, code);
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  /** VS Code 準拠の Tab / Shift+Tab / Enter インデント＆括弧・クォート自動補完 (Auto-Closing Pairs) */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!onChangeCode || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const indent = ' '.repeat(effectiveTabSize);

    // 1. Tab / Shift+Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey && start === end) {
        const next = code.slice(0, start) + indent + code.slice(end);
        onChangeCode(next);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + indent.length, start + indent.length);
          syncScroll();
        });
        return;
      }

      const lineStart = code.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const rawEnd = code.indexOf('\n', end);
      const lineEnd = rawEnd === -1 ? code.length : rawEnd;
      const lines = code.slice(lineStart, lineEnd).split('\n');

      let firstDelta = 0;
      let totalDelta = 0;
      const updatedLines = lines.map((line, idx) => {
        if (e.shiftKey) {
          if (line.startsWith('\t')) {
            if (idx === 0) firstDelta = -1;
            totalDelta -= 1;
            return line.slice(1);
          }
          let spaces = 0;
          while (spaces < effectiveTabSize && line[spaces] === ' ') spaces++;
          if (idx === 0) firstDelta = -spaces;
          totalDelta -= spaces;
          return line.slice(spaces);
        }
        if (idx === 0) firstDelta = indent.length;
        totalDelta += indent.length;
        return indent + line;
      });

      const next = code.slice(0, lineStart) + updatedLines.join('\n') + code.slice(lineEnd);
      onChangeCode(next);
      requestAnimationFrame(() => {
        const nextStart = Math.max(lineStart, start + firstDelta);
        const nextEnd = Math.max(nextStart, end + totalDelta);
        el.setSelectionRange(nextStart, nextEnd);
        syncScroll();
      });
      return;
    }

    // 2. Backspace: 空ペア (|), [|], {|}, "|", '|', `|` の一括削除
    if (autoClosePairs && e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey && start === end && start > 0) {
      const prevChar = code[start - 1];
      const nextChar = code[start];
      if (AUTO_CLOSE_PAIRS[prevChar] === nextChar) {
        e.preventDefault();
        const next = code.slice(0, start - 1) + code.slice(start + 1);
        onChangeCode(next);
        requestAnimationFrame(() => {
          el.setSelectionRange(start - 1, start - 1);
          syncScroll();
        });
        return;
      }
    }

    // 3. Enter: {|} ブロック改行展開 ＆ 直前行インデント自動引き継ぎ
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const lineStart = code.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const currentLineBeforeCursor = code.slice(lineStart, start);
      const leadingSpaces = currentLineBeforeCursor.match(/^[\t ]*/)?.[0] ?? '';

      if (autoClosePairs && start === end && code[start - 1] === '{' && code[start] === '}') {
        const innerIndent = leadingSpaces + indent;
        const insert = `\n${innerIndent}\n${leadingSpaces}`;
        const next = code.slice(0, start) + insert + code.slice(end);
        onChangeCode(next);
        requestAnimationFrame(() => {
          const pos = start + 1 + innerIndent.length;
          el.setSelectionRange(pos, pos);
          syncScroll();
        });
        return;
      }

      const insert = `\n${leadingSpaces}`;
      const next = code.slice(0, start) + insert + code.slice(end);
      onChangeCode(next);
      requestAnimationFrame(() => {
        const pos = start + insert.length;
        el.setSelectionRange(pos, pos);
        syncScroll();
      });
      return;
    }

    if (!autoClosePairs || e.ctrlKey || e.metaKey || e.altKey) return;

    // 4. 選択テキストのペア囲み（開き記号入力時）
    const closingForOpen = AUTO_CLOSE_PAIRS[e.key];
    if (closingForOpen && start !== end) {
      e.preventDefault();
      const selected = code.slice(start, end);
      const next = code.slice(0, start) + e.key + selected + closingForOpen + code.slice(end);
      onChangeCode(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, end + 1);
        syncScroll();
      });
      return;
    }

    // 5. 閉じ記号のスキップ (Overtype)
    if (start === end && CLOSING_CHARS.has(e.key) && code[start] === e.key) {
      e.preventDefault();
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, start + 1);
        syncScroll();
      });
      return;
    }

    // 6. 自動ペア挿入（クォートは直前が英数字・アンダースコアなら誤爆防止のためスキップ）
    if (closingForOpen && start === end) {
      if (QUOTE_CHARS.has(e.key) && start > 0 && /[A-Za-z0-9_]/.test(code[start - 1])) {
        return;
      }
      e.preventDefault();
      const next = code.slice(0, start) + e.key + closingForOpen + code.slice(end);
      onChangeCode(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, start + 1);
        syncScroll();
      });
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

  const editorHeightPx = visibleRows * 20 + 20;

  return (
    <div className="satlas-code-editor my-1 overflow-hidden rounded-xl border border-slate-700/80 bg-[#1e1e1e] shadow-sm">
      {/* VS Code 風ヘッダーバー */}
      <div className="satlas-code-header flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#252526] px-3 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
          {onChangeLanguage ? (
            <select
              value={language}
              onChange={(e) => {
                const nextLang = e.target.value as CodeBlockLanguage;
                onChangeLanguage(nextLang);
                if (onChangeFileName && (!fileName || fileName === meta.defaultFileName)) {
                  onChangeFileName(CODE_BLOCK_META[nextLang].defaultFileName);
                }
              }}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-100 focus:border-blue-500 focus:outline-none"
              aria-label="言語を選択"
            >
              <optgroup label="実行対応 (Run)">
                {RUNNABLE_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {CODE_BLOCK_META[lang].label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="表示・編集専用">
                {DISPLAY_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {CODE_BLOCK_META[lang].label}
                  </option>
                ))}
              </optgroup>
            </select>
          ) : (
            <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
              {meta.label}
            </span>
          )}

          {/* 任意編集可能なファイル名ラベル */}
          {onChangeFileName ? (
            <input
              type="text"
              value={displayFileName}
              onChange={(e) => onChangeFileName(e.target.value)}
              placeholder={meta.defaultFileName}
              className="w-28 rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-slate-300 transition-colors hover:border-slate-700 focus:border-indigo-500 focus:bg-slate-900 focus:outline-none"
              title="ファイル名を編集"
            />
          ) : (
            <span className="font-mono text-[11px] text-slate-400">{displayFileName}</span>
          )}

          {runnable && badge && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* コードをコピーボタン */}
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title="コードをクリップボードにコピー"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300">コピー済</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                コピー
              </>
            )}
          </button>

          {runnable && onOpenRunnerSettings && badge?.kind !== 'local-pc' && (
            <button
              type="button"
              onClick={onOpenRunnerSettings}
              className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="ローカル PC ランナーへ接続"
            >
              <Plug className="h-3 w-3 text-cyan-400" />
              接続設定
            </button>
          )}

          {runnable && result && (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="出力をクリア"
            >
              <Trash className="h-3 w-3" />
              クリア
            </button>
          )}

          {runnable && (
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {running ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
              実行
            </button>
          )}
        </div>
      </div>

      {/* VS Code 風エディタ本体（行番号ガター ＋ シンタックスハイライト層 ＋ 透明テキストエリア） */}
      <div className="flex overflow-hidden bg-[#1e1e1e]" style={{ height: editorHeightPx }}>
        {/* 行番号ガター */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="satlas-code-gutter w-10 shrink-0 select-none overflow-hidden border-r border-slate-800/90 bg-[#1e1e1e] py-2.5 pr-2 text-right font-mono text-xs leading-5 text-slate-500"
        >
          {Array.from({ length: lineCount }, (_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* 重ね合わせエディタ */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre px-3 py-2.5 font-mono text-xs leading-5 text-[#D4D4D4]"
            style={{ tabSize: effectiveTabSize }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChangeCode?.(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            readOnly={!onChangeCode}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            style={{ tabSize: effectiveTabSize }}
            placeholder={`${meta.label} コードを入力...`}
            className="relative h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2.5 font-mono text-xs leading-5 text-transparent caret-white selection:bg-blue-500/35 focus:outline-none"
          />
        </div>
      </div>

      {/* 出力コンソール（実行対応言語のみ表示） */}
      {runnable && (
        <div className="border-t border-slate-800 bg-slate-900/80 px-3.5 py-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
            <span>出力コンソール</span>
            {result && (
              <span className="font-mono text-slate-400">
                {runtimeLabel(result.runtime)}
                {result.runtime !== 'guide' && ` · exit ${result.exitCode} · ${result.durationMs}ms`}
              </span>
            )}
          </div>
          {running ? (
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-300">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              {language === 'python' && badge?.kind === 'browser-wasm'
                ? 'Browser WASM (Pyodide) で実行中（初回のみランタイム読込を行います）...'
                : 'コードを実行中...'}
            </p>
          ) : !result ? (
            <p className="font-mono text-[11px] text-slate-500">
              「実行」を押すとここに標準出力・エラーが表示されます。
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
                  className={`whitespace-pre-wrap break-words rounded-lg p-2.5 ${
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
      )}
    </div>
  );
}
