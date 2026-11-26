import { Fragment } from 'react';
import { Plus, Sigma } from 'lucide-react';
import type { VisualBlock } from '../../lib/notebookBlocks';
import { renderKatexToHtml, tokenizeInline } from '../../lib/notebookMarkdown';
import CodeExecutionCell from './CodeExecutionCell';

interface Props {
  blocks: VisualBlock[];
  selectedBlockId: string | null;
  editingBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onStartEditBlock: (id: string) => void;
  onStopEditBlock: () => void;
  onUpdateBlock: (id: string, updater: (prev: VisualBlock) => VisualBlock) => void;
  onAddParagraphAfter: (afterId?: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, blockId: string | null) => void;
  onOpenRunnerSettings: () => void;
}

const MATH_SYMBOLS: { label: string; latex: string; title: string }[] = [
  { label: '分数', latex: '\\frac{a}{b}', title: '分数 \\frac{}{}' },
  { label: 'ルート', latex: '\\sqrt{x}', title: '平方根 \\sqrt{}' },
  { label: 'シグマ', latex: '\\sum_{i=1}^{n} ', title: '総和 \\sum' },
  { label: '積分', latex: '\\int_{a}^{b} f(x)\\,dx', title: '定積分 \\int' },
  { label: '極限', latex: '\\lim_{x \\to \\infty} ', title: '極限 \\lim' },
  { label: 'ベクトル', latex: '\\vec{v}', title: 'ベクトル \\vec{}' },
  { label: '上付き', latex: 'x^{2}', title: '累乗・上付き' },
  { label: '下付き', latex: 'a_{n}', title: '添字・下付き' },
];

function InlineFormatted({ text }: { text: string }) {
  if (!text) return <span className="text-slate-600">（クリックして入力）</span>;
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, lineIdx) => (
        <Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {tokenizeInline(line).map((token, idx) => {
            switch (token.type) {
              case 'math-inline':
                return (
                  <span
                    key={idx}
                    className="mx-0.5 inline-block align-middle text-cyan-100"
                    dangerouslySetInnerHTML={{ __html: renderKatexToHtml(token.expr, false) }}
                  />
                );
              case 'code-inline':
                return (
                  <code
                    key={idx}
                    className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-300"
                  >
                    {token.value}
                  </code>
                );
              case 'bold':
                return (
                  <strong key={idx} className="font-semibold text-white">
                    {token.value}
                  </strong>
                );
              case 'italic':
                return (
                  <em key={idx} className="italic text-slate-200">
                    {token.value}
                  </em>
                );
              case 'link':
                return (
                  <a
                    key={idx}
                    href={token.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-400 underline decoration-blue-400/50 hover:text-blue-300"
                  >
                    {token.label}
                  </a>
                );
              default:
                return <Fragment key={idx}>{token.value}</Fragment>;
            }
          })}
        </Fragment>
      ))}
    </>
  );
}

/** 見たまま編集できるビジュアルブロックエディタ（数式記号パレット・右クリック対応） */
export default function VisualBlockEditor({
  blocks,
  selectedBlockId,
  editingBlockId,
  onSelectBlock,
  onStartEditBlock,
  onStopEditBlock,
  onUpdateBlock,
  onAddParagraphAfter,
  onOpenContextMenu,
  onOpenRunnerSettings,
}: Props) {
  return (
    <div
      className="min-h-full space-y-2.5 p-5"
      onContextMenu={(e) => onOpenContextMenu(e, null)}
      onClick={() => onStopEditBlock()}
    >
      {blocks.map((block) => {
        const selected = block.id === selectedBlockId;
        const editing = block.id === editingBlockId;

        return (
          <div
            key={block.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBlock(block.id);
              if (block.type !== 'code-cell' && block.type !== 'drawing' && block.type !== 'divider') {
                onStartEditBlock(block.id);
              }
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
              onSelectBlock(block.id);
              onOpenContextMenu(e, block.id);
            }}
            className={`group relative rounded-xl border px-3.5 py-2.5 transition ${
              selected
                ? 'border-blue-500/50 bg-slate-800/40 ring-1 ring-blue-500/20'
                : 'border-transparent hover:border-slate-800 hover:bg-slate-900/50'
            }`}
          >
            {/* 見出しブロック */}
            {block.type === 'heading' &&
              (editing ? (
                <input
                  type="text"
                  autoFocus
                  value={block.text}
                  onChange={(e) =>
                    onUpdateBlock(block.id, (prev) =>
                      prev.type === 'heading' ? { ...prev, text: e.target.value } : prev,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddParagraphAfter(block.id);
                    }
                  }}
                  placeholder={`見出し ${block.level} を入力...`}
                  className={`w-full bg-transparent font-bold text-white focus:outline-none ${
                    block.level === 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : 'text-base'
                  }`}
                />
              ) : (
                <div
                  className={
                    block.level === 1
                      ? 'border-b border-slate-800 pb-1.5 text-xl font-bold text-white'
                      : block.level === 2
                        ? 'text-lg font-bold text-slate-100'
                        : 'text-base font-semibold text-slate-100'
                  }
                >
                  <InlineFormatted text={block.text} />
                </div>
              ))}

            {/* 段落ブロック */}
            {block.type === 'paragraph' &&
              (editing ? (
                <textarea
                  autoFocus
                  value={block.text}
                  onChange={(e) =>
                    onUpdateBlock(block.id, (prev) =>
                      prev.type === 'paragraph' ? { ...prev, text: e.target.value } : prev,
                    )
                  }
                  rows={Math.max(2, block.text.split('\n').length)}
                  placeholder="テキストを入力（**太字**、$数式$ も利用可・右クリックでメニュー）"
                  className="w-full resize-none bg-transparent text-sm leading-7 text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
              ) : (
                <p className="min-h-[1.75rem] text-sm leading-7 text-slate-200">
                  <InlineFormatted text={block.text} />
                </p>
              ))}

            {/* 引用ブロック */}
            {block.type === 'quote' &&
              (editing ? (
                <textarea
                  autoFocus
                  value={block.text}
                  onChange={(e) =>
                    onUpdateBlock(block.id, (prev) =>
                      prev.type === 'quote' ? { ...prev, text: e.target.value } : prev,
                    )
                  }
                  rows={Math.max(2, block.text.split('\n').length)}
                  placeholder="引用・重要ポイントを入力..."
                  className="w-full resize-none border-l-2 border-blue-500 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 focus:outline-none"
                />
              ) : (
                <blockquote className="border-l-2 border-blue-500/70 bg-slate-800/40 px-3.5 py-2 text-sm text-slate-300">
                  <InlineFormatted text={block.text} />
                </blockquote>
              ))}

            {/* 箇条書き / 番号リスト */}
            {(block.type === 'bullet-list' || block.type === 'ordered-list') &&
              (editing ? (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-500">1行ごとに1項目として入力できます</div>
                  <textarea
                    autoFocus
                    value={block.items.join('\n')}
                    onChange={(e) => {
                      const nextItems = e.target.value.split('\n');
                      onUpdateBlock(block.id, (prev) =>
                        prev.type === 'bullet-list' || prev.type === 'ordered-list'
                          ? { ...prev, items: nextItems }
                          : prev,
                      );
                    }}
                    rows={Math.max(2, block.items.length + 1)}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-sm leading-6 text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ) : block.type === 'ordered-list' ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
                  {block.items.map((item, idx) => (
                    <li key={idx}>
                      <InlineFormatted text={item} />
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                  {block.items.map((item, idx) => (
                    <li key={idx}>
                      <InlineFormatted text={item} />
                    </li>
                  ))}
                </ul>
              ))}

            {/* チェックリスト */}
            {block.type === 'checklist' && (
              <div className="space-y-1.5">
                {block.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onUpdateBlock(block.id, (prev) => {
                          if (prev.type !== 'checklist') return prev;
                          const next = prev.items.map((it, i) =>
                            i === idx ? { ...it, checked: e.target.checked } : it,
                          );
                          return { ...prev, items: next };
                        })
                      }
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500"
                    />
                    {editing ? (
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) =>
                          onUpdateBlock(block.id, (prev) => {
                            if (prev.type !== 'checklist') return prev;
                            const next = prev.items.map((it, i) =>
                              i === idx ? { ...it, text: e.target.value } : it,
                            );
                            return { ...prev, items: next };
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onUpdateBlock(block.id, (prev) => {
                              if (prev.type !== 'checklist') return prev;
                              const next = [...prev.items];
                              next.splice(idx + 1, 0, { checked: false, text: '' });
                              return { ...prev, items: next };
                            });
                          }
                        }}
                        className={`min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${
                          item.checked ? 'text-slate-500 line-through' : 'text-slate-100'
                        }`}
                        placeholder="チェック項目を入力..."
                      />
                    ) : (
                      <span
                        className={`text-sm ${
                          item.checked ? 'text-slate-500 line-through' : 'text-slate-200'
                        }`}
                      >
                        <InlineFormatted text={item.text} />
                      </span>
                    )}
                  </div>
                ))}
                {editing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateBlock(block.id, (prev) =>
                        prev.type === 'checklist'
                          ? { ...prev, items: [...prev.items, { checked: false, text: '' }] }
                          : prev,
                      );
                    }}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    <Plus className="h-3 w-3" />
                    項目を追加
                  </button>
                )}
              </div>
            )}

            {/* KaTeX 数式ブロック＋記号パレット */}
            {block.type === 'math' && (
              <div className="space-y-2">
                {editing && (
                  <div
                    className="space-y-2 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
                        <Sigma className="h-3 w-3" />
                        記号パレット:
                      </span>
                      {MATH_SYMBOLS.map((sym) => (
                        <button
                          key={sym.label}
                          type="button"
                          title={sym.title}
                          onClick={() =>
                            onUpdateBlock(block.id, (prev) =>
                              prev.type === 'math'
                                ? { ...prev, expr: `${prev.expr}${prev.expr ? ' ' : ''}${sym.latex}` }
                                : prev,
                            )
                          }
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/15 hover:text-cyan-200"
                        >
                          {sym.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      autoFocus
                      value={block.expr}
                      onChange={(e) =>
                        onUpdateBlock(block.id, (prev) =>
                          prev.type === 'math' ? { ...prev, expr: e.target.value } : prev,
                        )
                      }
                      rows={2}
                      placeholder="LaTeX 数式を入力（例: \frac{-b \pm \sqrt{b^2-4ac}}{2a}）"
                      className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono text-xs text-cyan-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                )}

                <div
                  className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-cyan-50"
                  dangerouslySetInnerHTML={{
                    __html: renderKatexToHtml(block.expr || '\\text{（クリックして数式を入力）}', true),
                  }}
                />
              </div>
            )}

            {/* コード実行セル */}
            {block.type === 'code-cell' && (
              <div onClick={(e) => e.stopPropagation()}>
                <CodeExecutionCell
                  language={block.language}
                  code={block.code}
                  onOpenRunnerSettings={onOpenRunnerSettings}
                  onChangeCode={(nextCode) =>
                    onUpdateBlock(block.id, (prev) =>
                      prev.type === 'code-cell' ? { ...prev, code: nextCode } : prev,
                    )
                  }
                  onChangeLanguage={(nextLang) =>
                    onUpdateBlock(block.id, (prev) =>
                      prev.type === 'code-cell' ? { ...prev, language: nextLang } : prev,
                    )
                  }
                />
              </div>
            )}

            {/* 手書き図解ブロック */}
            {block.type === 'drawing' && (
              <figure className="space-y-1.5">
                <img
                  src={block.dataUrl}
                  alt={block.caption || '手書き図解'}
                  className="max-h-96 w-full rounded-xl border border-slate-700 bg-white object-contain"
                />
                <figcaption className="text-center text-[11px] text-slate-400">
                  {block.caption || '手書き図解'}
                </figcaption>
              </figure>
            )}

            {/* 区切り線 */}
            {block.type === 'divider' && <hr className="my-2 border-slate-700" />}
          </div>
        );
      })}

      {/* 末尾のクイック段落追加ボタン */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddParagraphAfter();
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-800 py-2 text-xs text-slate-500 transition hover:border-slate-700 hover:bg-slate-900/50 hover:text-slate-300"
      >
        <Plus className="h-3.5 w-3.5" />
        新しいブロックを追加（または右クリックで挿入メニューを開く）
      </button>
    </div>
  );
}
