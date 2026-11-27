import { useState } from 'react';
import { BookOpen, Bot, Calculator, ChevronLeft, ChevronRight, Pen, Sparkles, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    title: '1. OneNote 風の 3 層整理（科目 ＞ セクション ＞ ページ）',
    icon: BookOpen,
    color: 'text-indigo-400',
    description:
      '左ペインに時間割から自動抽出された科目ノートブックが並びます。科目ごとに「講義ノート」「演習」「試験対策」などの色付きセクションを追加してページを整理できます。',
    tips: [
      '上部の検索バーから全ノートブック・全ページを横断検索できます。',
      '重要なページはピン留めしておくと一覧の最上部に固定されます。',
    ],
  },
  {
    title: '2. 自由配置キャンバス＆コード実行セル',
    icon: Sparkles,
    color: 'text-cyan-400',
    description:
      'ページ上の好きな場所をダブルクリック（または右クリック）すると、その座標にテキスト・KaTeX数式・Python / Java / C コードセルを配置できます。ドラッグ移動や右下ハンドルでのリサイズにも対応しています。',
    tips: [
      'Python セルはブラウザ内 Pyodide (WASM) でそのまま実行できます。',
      'ローカル PC の runner/satlas_runner.py に接続すると Python / Java / C を高速に実行できます。',
    ],
  },
  {
    title: '3. 直接ペン描画レイヤー（マウス・ペンタブ対応）',
    icon: Pen,
    color: 'text-amber-400',
    description:
      'リボンの「描画」タブを選ぶと、ページ全体に重ねた透明 SVG レイヤーへ直接書き込めます。ボールペン・文字が透ける蛍光マーカー・ストローク消し／部分消しゴム・カスタム HEX カラーに対応しています。',
    tips: [
      'Shift キーを押しながらドラッグすると、直線・矢印に自動でスナップ補正されます。',
      'リボン「表示・ツール」から背景を無地・横罫線・5mm方眼へ切り替えられます。',
    ],
  },
  {
    title: '4. 自然表示・関数電卓 ＆ AI アシスタント連携',
    icon: Calculator,
    color: 'text-emerald-400',
    description:
      'フローティング関数電卓は KaTeX で数式を自然表示しながらリアルタイム計算します。「ノートへ数式として挿入」で計算式と結果をそのまま配置でき、右ペインの AI でページの要約・解説・クイズ作成も行えます。',
    tips: [
      '関数電卓は RAD/DEG 切替、n! / nPr / nCr、DEC/HEX/BIN 進数変換に対応しています。',
      'このガイドはいつでもリボン「表示・ツール」→「使い方ガイド」から再表示できます。',
    ],
  },
] as const;

/** 4 ステップのインタラクティブチュートリアルモーダル */
export default function NotebookTutorialModal({ onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Bot className="h-4 w-4 text-indigo-400" />
            SAtlas 講義ノートブック 使い方ガイド
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* ステップインジケーター */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, idx) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setStepIdx(idx)}
                className={`h-1.5 flex-1 rounded-full transition ${
                  idx <= stepIdx ? 'bg-indigo-500' : 'bg-slate-800'
                }`}
                aria-label={`ステップ ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950">
              <Icon className={`h-5 w-5 ${step.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{step.description}</p>
            </div>
          </div>

          <ul className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            {step.tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            {stepIdx + 1} / {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => i - 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                戻る
              </button>
            )}
            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIdx((i) => i + 1)}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                次へ
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                ノートを始める
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
