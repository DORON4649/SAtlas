import { useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, LayoutTemplate, PenTool, Sigma, Terminal, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    icon: LayoutTemplate,
    color: 'text-blue-400',
    title: '1. Office風リボン＆ビジュアルブロック編集',
    description:
      'Markdown 記法を覚えなくても、上部の「ホーム」「挿入」「表示・ツール」リボンから見出し・太字・箇条書き・チェックリストを直感的に作成できます。各ブロックをクリックするとその場で編集できます。',
    tip: 'ヒント: 「表示・ツール」タブからいつでも Markdown ソース編集へ切り替えられます。',
  },
  {
    icon: Sigma,
    color: 'text-cyan-400',
    title: '2. KaTeX 数式ブロック＆記号パレット',
    description:
      '「挿入」→「数式 (KaTeX)」で数式ブロックを追加できます。編集時には分数・ルート・シグマ・積分・極限・ベクトルの記号パレットが表示され、ワンクリックで入力しながらリアルタイムプレビューを確認できます。',
    tip: 'ヒント: 本文中でも $E = mc^2$ のように $ で囲むとインライン数式として綺麗に描画されます。',
  },
  {
    icon: PenTool,
    color: 'text-emerald-400',
    title: '3. 手書きキャンバス＆右クリックメニュー',
    description:
      'エディタ内のブロックや余白を右クリックすると、数式・コードセル・手書きキャンバスの挿入や、見出し・リスト変換、ブロック複製・削除をすぐ呼び出せます。手書きキャンバスは方眼・罫線やペン色切替に対応しています。',
    tip: 'ヒント: iPad やペンタブレットでも Pointer Events でスムーズに図解を描けます。',
  },
  {
    icon: Terminal,
    color: 'text-amber-400',
    title: '4. ハイブリッドコード実行＆AIアシスタント連携',
    description:
      'Python セルはブラウザ内 WebAssembly (Pyodide) ですぐ実行できます。PC で `python runner/satlas_runner.py` を起動して接続すれば、Python / Java / C をローカル環境で高速実行できます。右ペインの AI から要約・解説・クイズ作成もワンクリックです。',
    tip: 'ヒント: 右ペインの「開いているノートを含める」チップで、編集中の最新ノートを AI に共有できます。',
  },
];

/** 初回アクセス時・リボンから開ける 4 ステップのインタラクティブ使い方ガイド */
export default function NotebookTutorialModal({ onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const current = STEPS[stepIndex];
  const Icon = current.icon;
  const isLast = stepIndex === STEPS.length - 1;

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
            <Bot className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">SAtlas 講義ノートブック 使い方ガイド</h3>
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

        {/* ステップインジケーター */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {STEPS.map((s, idx) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStepIndex(idx)}
              className={`h-1.5 flex-1 rounded-full transition ${
                idx <= stepIndex ? 'bg-cyan-400' : 'bg-slate-800'
              }`}
              aria-label={`ステップ ${idx + 1}`}
            />
          ))}
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <Icon className={`h-5 w-5 ${current.color}`} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                STEP {stepIndex + 1} / {STEPS.length}
              </div>
              <h4 className="text-sm font-bold text-white">{current.title}</h4>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">{current.description}</p>

          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-200">
            {current.tip}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            前へ
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              ノートを書き始める
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              次へ
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
