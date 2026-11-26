import { Fragment, useMemo } from 'react';
import type { CodeLanguage } from '../../lib/codeRunner';
import {
  parseNotebookBlocks,
  renderKatexToHtml,
  replaceCodeCellInMarkdown,
  tokenizeInline,
} from '../../lib/notebookMarkdown';
import CodeExecutionCell from './CodeExecutionCell';

interface Props {
  markdown: string;
  onChangeMarkdown?: (nextMarkdown: string) => void;
}

function InlineText({ text }: { text: string }) {
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

/** Markdown + KaTeX 数式 + インタラクティブなコード実行セルのプレビュー描画 */
export default function NotebookPreview({ markdown, onChangeMarkdown }: Props) {
  const blocks = useMemo(() => parseNotebookBlocks(markdown), [markdown]);

  if (!markdown.trim()) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-xs text-slate-500">
        プレビューする内容がありません。左のエディタに Markdown や KaTeX 数式（$...$ / $$...$$）を入力してください。
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const cls =
              block.level === 1
                ? 'border-b border-slate-800 pb-2 text-xl font-bold text-white'
                : block.level === 2
                  ? 'pt-2 text-lg font-bold text-slate-100'
                  : block.level === 3
                    ? 'pt-1 text-base font-semibold text-slate-100'
                    : 'text-sm font-semibold text-slate-200';
            return (
              <div key={idx} className={cls}>
                <InlineText text={block.text} />
              </div>
            );
          }
          case 'paragraph':
            return (
              <p key={idx} className="text-sm leading-7 text-slate-200">
                <InlineText text={block.text} />
              </p>
            );
          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-blue-500/70 bg-slate-800/40 px-3.5 py-2 text-sm text-slate-300"
              >
                <InlineText text={block.text} />
              </blockquote>
            );
          case 'list':
            if (block.ordered) {
              return (
                <ol key={idx} className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
                  {block.items.map((item, itemIdx) => (
                    <li key={itemIdx}>
                      <InlineText text={item} />
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={idx} className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            );
          case 'hr':
            return <hr key={idx} className="border-slate-800" />;
          case 'math-block':
            return (
              <div
                key={idx}
                className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-cyan-50"
                dangerouslySetInnerHTML={{ __html: renderKatexToHtml(block.expr, true) }}
              />
            );
          case 'drawing':
            return (
              <figure key={idx} className="space-y-1">
                <img
                  src={block.dataUrl}
                  alt={block.caption}
                  className="max-h-96 w-full rounded-xl border border-slate-700 bg-white object-contain"
                />
                <figcaption className="text-center text-[11px] text-slate-400">{block.caption}</figcaption>
              </figure>
            );
          case 'code':
            return (
              <div key={idx} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-1 font-mono text-[10px] uppercase text-slate-400">
                  {block.language}
                </div>
                <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-slate-200">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          case 'code-cell':
            return (
              <CodeExecutionCell
                key={`${idx}-${block.startOffset}`}
                language={block.language}
                code={block.code}
                onChangeCode={
                  onChangeMarkdown
                    ? (nextCode) =>
                        onChangeMarkdown(
                          replaceCodeCellInMarkdown(
                            markdown,
                            block.startOffset,
                            block.endOffset,
                            block.language,
                            nextCode,
                          ),
                        )
                    : undefined
                }
                onChangeLanguage={
                  onChangeMarkdown
                    ? (nextLang: CodeLanguage) =>
                        onChangeMarkdown(
                          replaceCodeCellInMarkdown(
                            markdown,
                            block.startOffset,
                            block.endOffset,
                            nextLang,
                            block.code,
                          ),
                        )
                    : undefined
                }
              />
            );
        }
      })}
    </div>
  );
}
