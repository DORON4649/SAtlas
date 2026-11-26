// ---- ハイブリッドコード実行アダプター（Local PC WebSocket -> Browser WASM Pyodide -> 外部/ガイド） ----

export type CodeLanguage = 'python' | 'java' | 'c';

export type CodeRuntimeKind = 'local-pc' | 'browser-wasm' | 'sandbox' | 'guide' | 'custom';

export interface CodeRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: CodeRuntimeKind;
  durationMs: number;
}

export interface LocalRunnerConfig {
  url: string;
  token: string;
  enabled: boolean;
}

export type CodeRunnerAdapter = (language: CodeLanguage, code: string) => Promise<CodeRunResult>;

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    set: (key: string, value: unknown) => void;
    get: (key: string) => unknown;
    delete: (key: string) => void;
  };
}

declare global {
  interface Window {
    __SATLAS_CODE_RUNNER__?: CodeRunnerAdapter;
    loadPyodide?: (options?: { indexURL?: string }) => Promise<PyodideInstance>;
  }
}

const RUNNER_CONFIG_KEY = 'satlas_local_runner_config_v1';
const DEFAULT_RUNNER_URL = 'ws://127.0.0.1:9123';
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

export const CODE_LANGUAGE_META: Record<
  CodeLanguage,
  { label: string; badgeClass: string; fileHint: string; template: string }
> = {
  python: {
    label: 'Python',
    badgeClass: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    fileHint: 'main.py',
    template: `def solve(n: int) -> int:\n    return n * (n + 1) // 2\n\nprint("Sum(1..10) =", solve(10))`,
  },
  java: {
    label: 'Java',
    badgeClass: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    fileHint: 'Main.java',
    template: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from SAtlas Notebook!");\n    }\n}`,
  },
  c: {
    label: 'C',
    badgeClass: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    fileHint: 'main.c',
    template: `#include <stdio.h>\n\nint main(void) {\n    printf("Hello from SAtlas Notebook!\\n");\n    return 0;\n}`,
  },
};

let customAdapter: CodeRunnerAdapter | null = null;
let localRunnerConnected = false;
let pyodidePromise: Promise<PyodideInstance> | null = null;
const statusListeners = new Set<() => void>();

function notifyStatusChange(): void {
  for (const listener of statusListeners) {
    listener();
  }
}

export function subscribeRunnerStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function loadRunnerConfig(): LocalRunnerConfig {
  try {
    const raw = localStorage.getItem(RUNNER_CONFIG_KEY);
    if (!raw) {
      return { url: DEFAULT_RUNNER_URL, token: '', enabled: true };
    }
    const parsed = JSON.parse(raw) as Partial<LocalRunnerConfig>;
    return {
      url: typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url.trim() : DEFAULT_RUNNER_URL,
      token: typeof parsed.token === 'string' ? parsed.token.trim() : '',
      enabled: parsed.enabled !== false,
    };
  } catch {
    return { url: DEFAULT_RUNNER_URL, token: '', enabled: true };
  }
}

export function saveRunnerConfig(config: LocalRunnerConfig): void {
  localStorage.setItem(
    RUNNER_CONFIG_KEY,
    JSON.stringify({
      url: config.url.trim() || DEFAULT_RUNNER_URL,
      token: config.token.trim(),
      enabled: config.enabled,
    }),
  );
  if (!config.enabled || !config.token.trim()) {
    localRunnerConnected = false;
  }
  notifyStatusChange();
}

export function isLocalRunnerConnected(): boolean {
  return localRunnerConnected;
}

export function registerCodeRunner(adapter: CodeRunnerAdapter | null): void {
  customAdapter = adapter;
  notifyStatusChange();
}

    /** 現在の設定・接続状態から、指定言語で想定される実行環境ラベルを返す */
    export function getRuntimeBadge(language: CodeLanguage): {
      label: string;
      kind: CodeRuntimeKind;
      className: string;
    } {
      if (localRunnerConnected) {
        return {
          label: 'Local PC',
          kind: 'local-pc',
          className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        };
      }
      if (language === 'python') {
        return {
          label: 'Browser WASM',
          kind: 'browser-wasm',
          className: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300',
        };
      }
      return {
        label: 'Local PC 推奨',
        kind: 'guide',
        className: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
      };
    }

    /** ローカル WebSocket ブリッジへ1回リクエストを送信し JSON 応答を受け取る */
    function sendLocalWsRequest(
      config: LocalRunnerConfig,
      payload: Record<string, unknown>,
      timeoutMs = 12_000,
    ): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number; durationMs: number }> {
      return new Promise((resolve, reject) => {
        let settled = false;
        let ws: WebSocket;
        try {
          ws = new WebSocket(config.url);
        } catch (e) {
          reject(e instanceof Error ? e : new Error('WebSocket 接続の作成に失敗しました'));
          return;
        }

        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            ws.close();
          } catch {
            /* noop */
          }
          reject(new Error('ローカルランナーへの接続がタイムアウトしました'));
        }, timeoutMs);

        const cleanup = () => {
          window.clearTimeout(timer);
        };

        ws.onopen = () => {
          ws.send(JSON.stringify({ ...payload, token: config.token }));
        };

        ws.onmessage = (event) => {
          if (settled) return;
          settled = true;
          cleanup();
          try {
            ws.close();
          } catch {
            /* noop */
          }
          try {
            const data = JSON.parse(String(event.data)) as {
              ok?: boolean;
              stdout?: string;
              stderr?: string;
              exitCode?: number;
              durationMs?: number;
            };
            resolve({
              ok: Boolean(data.ok),
              stdout: data.stdout ?? '',
              stderr: data.stderr ?? '',
              exitCode: typeof data.exitCode === 'number' ? data.exitCode : data.ok ? 0 : 1,
              durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
            });
          } catch {
            reject(new Error('ローカルランナーからの応答解析に失敗しました'));
          }
        };

        ws.onerror = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('ローカルランナー（127.0.0.1:9123）に接続できません'));
        };

        ws.onclose = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('ローカルランナーとの接続が閉じられました'));
        };
      });
    }

    /** ローカルランナーへの接続テスト（ping + トークン検証） */
    export async function testLocalRunnerConnection(
      overrideConfig?: LocalRunnerConfig,
    ): Promise<{ connected: boolean; message: string }> {
      const cfg = overrideConfig ?? loadRunnerConfig();
      if (!cfg.enabled) {
        localRunnerConnected = false;
        notifyStatusChange();
        return { connected: false, message: 'ローカルランナー連携はオフになっています' };
      }
      if (!cfg.token.trim()) {
        localRunnerConnected = false;
        notifyStatusChange();
        return { connected: false, message: 'ワンタイムトークンを入力してください' };
      }
      try {
        const res = await sendLocalWsRequest(cfg, { type: 'ping', id: `ping-${Date.now()}` }, 4000);
        localRunnerConnected = res.ok;
        notifyStatusChange();
        if (res.ok) {
          return { connected: true, message: `接続成功（${cfg.url}）` };
        }
        return { connected: false, message: res.stderr || 'トークン認証に失敗しました' };
      } catch (e) {
        localRunnerConnected = false;
        notifyStatusChange();
        return {
          connected: false,
          message: e instanceof Error ? e.message : 'ローカルランナーへ接続できませんでした',
        };
      }
    }

    /** CDN から Pyodide (WebAssembly Python) を遅延ロードする */
    async function ensurePyodide(): Promise<PyodideInstance> {
      if (pyodidePromise) return pyodidePromise;

      pyodidePromise = (async () => {
        if (typeof window === 'undefined') {
          throw new Error('ブラウザ環境ではありません');
        }
        if (!window.loadPyodide) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(`script[src="${PYODIDE_SCRIPT_URL}"]`);
            if (existing) {
              existing.addEventListener('load', () => resolve(), { once: true });
              existing.addEventListener('error', () => reject(new Error('Pyodide スクリプトの読み込みに失敗しました')), {
                once: true,
              });
              return;
            }
            const script = document.createElement('script');
            script.src = PYODIDE_SCRIPT_URL;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Pyodide (WASM) の読み込みに失敗しました（オフラインの可能性があります）'));
            document.head.appendChild(script);
          });
        }
        if (!window.loadPyodide) {
          throw new Error('Pyodide の初期化に失敗しました');
        }
        return window.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      })().catch((err) => {
        pyodidePromise = null;
        throw err;
      });

      return pyodidePromise;
    }

    async function runPythonInBrowserWasm(code: string): Promise<CodeRunResult> {
      const startedAt = performance.now();
      try {
        const pyodide = await ensurePyodide();
        pyodide.globals.set('__satlas_user_code__', code);
        const jsonResult = (await pyodide.runPythonAsync(`
import io, json, contextlib, traceback
_out = io.StringIO()
_err = io.StringIO()
_ok = True
with contextlib.redirect_stdout(_out), contextlib.redirect_stderr(_err):
    try:
        exec(__satlas_user_code__, {"__name__": "__main__"})
    except Exception:
        _ok = False
        traceback.print_exc(file=_err)
json.dumps({"ok": _ok, "stdout": _out.getvalue(), "stderr": _err.getvalue()})
`)) as string;
        pyodide.globals.delete('__satlas_user_code__');
        const parsed = JSON.parse(jsonResult) as { ok: boolean; stdout: string; stderr: string };
        return {
          ok: parsed.ok,
          stdout: parsed.stdout,
          stderr: parsed.stderr,
          exitCode: parsed.ok ? 0 : 1,
          runtime: 'browser-wasm',
          durationMs: Math.round(performance.now() - startedAt),
        };
      } catch (e) {
        return {
          ok: false,
          stdout: '',
          stderr: e instanceof Error ? e.message : 'Browser WASM (Pyodide) での実行に失敗しました',
          exitCode: 1,
          runtime: 'browser-wasm',
          durationMs: Math.round(performance.now() - startedAt),
        };
      }
    }

    /**
     * 3段階ハイブリッドコード実行:
     * 1. ローカル WebSocket ブリッジ（ws://127.0.0.1:9123 + トークン）接続中は Local PC で実行
     * 2. 未接続かつ Python の場合は Browser WASM (Pyodide) を遅延ロードして実行
     * 3. 未接続かつ C / Java の場合はガイド表示を返す
     */
    export async function runCodeCell(language: CodeLanguage, code: string): Promise<CodeRunResult> {
      const startedAt = performance.now();

      if (customAdapter) {
        return customAdapter(language, code);
      }
      if (typeof window !== 'undefined' && typeof window.__SATLAS_CODE_RUNNER__ === 'function') {
        return window.__SATLAS_CODE_RUNNER__(language, code);
      }

        // 1. ローカル PC WebSocket ブリッジ
        const cfg = loadRunnerConfig();
        if (cfg.enabled && cfg.token.trim()) {
          try {
            const res = await sendLocalWsRequest(cfg, {
              type: 'run',
              id: `run-${Date.now()}`,
              language,
              code,
            });
            if (res.exitCode !== 401) {
              localRunnerConnected = true;
              notifyStatusChange();
            } else {
              localRunnerConnected = false;
              notifyStatusChange();
            }
            return {
              ...res,
              runtime: 'local-pc',
            };
          } catch {
            if (localRunnerConnected) {
              localRunnerConnected = false;
              notifyStatusChange();
            }
            // フォールバックへ継続
          }
        }

        // 2. Browser WASM (Pyodide) で Python 実行
        if (language === 'python') {
          return runPythonInBrowserWasm(code);
        }

        // 3. 未接続かつ Java / C の場合は案内を表示
        const meta = CODE_LANGUAGE_META[language];
        return {
          ok: false,
          stdout: '',
          stderr: [
            `${meta.label} の実行にはローカルコード実行ブリッジ（runner/satlas_runner.py）の接続が必要です。`,
            '1. ターミナルで `python runner/satlas_runner.py` を起動してください。',
            '2. 上部リボン「表示・ツール」→「ランナー接続設定」からワンタイムトークンを貼り付けて接続してください。',
            '※ Python セルは未接続でもブラウザ内 WebAssembly (Pyodide) でそのまま実行できます。',
          ].join('\n'),
          exitCode: 0,
          runtime: 'guide',
          durationMs: Math.round(performance.now() - startedAt),
        };
      }
