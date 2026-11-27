import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyTextFormatAction,
  detectCurrentLineBlock,
  renderInlineMarkdownHtml,
  type TextFormatAction,
} from '../../lib/textMarkdown';

export interface TextContextMenuRequest {
  clientX: number;
  clientY: number;
  selectionStart: number;
  selectionEnd: number;
}

interface Props {
  containerId: string;
  text: string;
  editing: boolean;
  contextMenuOpen: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChangeText: (next: string) => void;
  onOpenTextContextMenu: (req: TextContextMenuRequest) => void;
  registerTextarea?: (id: string, el: HTMLTextAreaElement | null) => void;
}

/**
 * テキストボックスコンテナ本体。
 * - 編集モード: 行頭記法オートフォーマット（# / ## / ### / - / * / 1. / - [ ] / >）＋ Ctrl+B/I/U ＋ 右クリック書式メニュー
 * - 表示モード: リッチテキスト＆KaTeX インライン数式レンダリング（チェックボックスは直接クリック可能）
 * - 編集・表示でパディング・行間を一致させ、切替時のレイアウトシフトを防止する。
 */
export default function TextContainerBody({
  containerId,
  text,
  editing,
  contextMenuOpen,
  onStartEdit,
  onStopEdit,
  onChangeText,
  onOpenTextContextMenu,
  registerTextarea,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [cursorPos, setCursorPos] = useState(0);

  useEffect(() => {
    registerTextarea?.(containerId, editing ? textareaRef.current : null);
    return () => registerTextarea?.(containerId, null);
  }, [containerId, editing, registerTextarea]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const activeBlockLabel = useMemo(
    () => (editing ? detectCurrentLineBlock(text, cursorPos) : null),
    [editing, text, cursorPos],
  );

  const applyShortcut = (action: TextFormatAction) => {
    const el = textareaRef.current;
    if (!el) return;
    const res = applyTextFormatAction(text, el.selectionStart, el.selectionEnd, action);
    onChangeText(res.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(res.selectionStart, res.selectionEnd);
      setCursorPos(res.selectionEnd);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;

    // Ctrl+Enter で編集完了してリッチ表示へ
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onStopEdit();
      return;
    }

    // Ctrl+B / Ctrl+I / Ctrl+U トグル装飾
    if (e.ctrlKey || e.metaKey) {
      const lower = e.key.toLowerCase();
      if (lower === 'b') {
        e.preventDefault();
        applyShortcut('bold');
        return;
      }
      if (lower === 'i') {
        e.preventDefault();
        applyShortcut('italic');
        return;
      }
      if (lower === 'u') {
        e.preventDefault();
        applyShortcut('underline');
        return;
      }
    }

    // スペース押下時の行頭オートフォーマット（* -> - 、[] -> - [ ] など）
    if (e.key === ' ' && el.selectionStart === el.selectionEnd) {
      const pos = el.selectionStart;
      const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
      const beforeCursor = text.slice(lineStart, pos);
      if (beforeCursor === '*') {
        e.preventDefault();
        const nextText = text.slice(0, lineStart) + '- ' + text.slice(pos);
        onChangeText(nextText);
        requestAnimationFrame(() => {
          el.setSelectionRange(lineStart + 2, lineStart + 2);
          setCursorPos(lineStart + 2);
        });
        return;
      }
      if (beforeCursor === '[]' || beforeCursor === '[ ]') {
        e.preventDefault();
        const nextText = text.slice(0, lineStart) + '- [ ] ' + text.slice(pos);
        onChangeText(nextText);
        requestAnimationFrame(() => {
          el.setSelectionRange(lineStart + 6, lineStart + 6);
          setCursorPos(lineStart + 6);
        });
        return;
      }
    }

    // Enter で箇条書き・チェックリスト・番号リスト・引用を自動継続
    if (e.key === 'Enter' && !e.shiftKey && el.selectionStart === el.selectionEnd) {
      const pos = el.selectionStart;
      const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
      const line = text.slice(lineStart, pos);

      const checkMatch = line.match(/^(- \[[ xX]\] )(.*)$/);
      const bulletMatch = !checkMatch ? line.match(/^([-*] )(.*)$/) : null;
      const numMatch = line.match(/^(\d+)\. (.*)$/);
      const quoteMatch = line.match(/^(> )(.*)$/);

      const matched = checkMatch || bulletMatch || numMatch || quoteMatch;
      if (matched) {
        e.preventDefault();
        const body = matched[2];
        // 空のリスト行で Enter -> リスト終了
        if (!body.trim()) {
          const nextText = text.slice(0, lineStart) + text.slice(pos);
          onChangeText(nextText);
          requestAnimationFrame(() => {
            el.setSelectionRange(lineStart, lineStart);
            setCursorPos(lineStart);
          });
          return;
        }
        const nextPrefix = checkMatch
          ? '- [ ] '
          : bulletMatch
            ? '- '
            : numMatch
              ? `${Number(numMatch[1]) + 1}. `
              : '> ';
        const insert = `\n${nextPrefix}`;
        const nextText = text.slice(0, pos) + insert + text.slice(pos);
        onChangeText(nextText);
        requestAnimationFrame(() => {
          const nextPos = pos + insert.length;
          el.setSelectionRange(nextPos, nextPos);
          setCursorPos(nextPos);
        });
      }
    }
  };

  /** 表示モードでのチェックボックス直接トグル */
  const toggleChecklistLine = (lineIndex: number) => {
    const lines = text.split('\n');
    const target = lines[lineIndex];
    if (!target) return;
    if (/^- \[ \] /.test(target)) {
      lines[lineIndex] = target.replace(/^- \[ \] /, '- [x] ');
    } else if (/^- \[[xX]\] /.test(target)) {
      lines[lineIndex] = target.replace(/^- \[[xX]\] /, '- [ ] ');
    }
    onChangeText(lines.join('\n'));
  };

  if (editing) {
    return (
      <div className="relative min-h-[64px] px-1 py-0.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            onChangeText(e.target.value);
            setCursorPos(e.target.selectionStart);
          }}
          onSelect={(e) => setCursorPos(e.currentTarget.selectionStart)}
          onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // 右クリック書式メニュー表示中は編集状態を維持
            if (!contextMenuOpen) {
              onStopEdit();
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenTextContextMenu({
              clientX: e.clientX,
              clientY: e.clientY,
              selectionStart: e.currentTarget.selectionStart,
              selectionEnd: e.currentTarget.selectionEnd,
            });
          }}
          rows={Math.max(3, Math.min(24, text.split('\n').length + 1))}
          placeholder="メモを入力（# 見出し / - 箇条書き / - [ ] ToDo / $数式$ / 右クリックで装飾）..."
          className="block w-full resize-none bg-transparent text-xs leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        {/* レイアウトを動かさないオーバーレイバッジ */}
        <div className="pointer-events-none mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>{activeBlockLabel ? `書式: ${activeBlockLabel}` : 'Ctrl+B/I/U ・ 右クリックで装飾'}</span>
          <span>Ctrl+Enter / 外クリックで確定</span>
        </div>
      </div>
    );
  }

  // ---- リッチ表示モード（パディング・行間を編集モードと統一してレイアウトシフトを防止） ----
  const lines = text.split('\n');
  const isEmpty = !text.trim();

  return (
    <div
      onClick={onStartEdit}
      className="min-h-[64px] cursor-text space-y-1 px-1 py-0.5 text-xs leading-6 text-slate-100"
      title="クリックして編集"
    >
      {isEmpty ? (
        <div className="text-slate-500">クリックしてテキストを入力...</div>
      ) : (
        lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-3" />;
          }
          if (/^-{3,}$/.test(trimmed)) {
            return <hr key={idx} className="my-1.5 border-slate-700" />;
          }
          const h1 = line.match(/^# (.+)$/);
          if (h1) {
            return (
              <h1
                key={idx}
                className="text-lg font-bold leading-snug text-white"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(h1[1]) }}
              />
            );
          }
          const h2 = line.match(/^## (.+)$/);
          if (h2) {
            return (
              <h2
                key={idx}
                className="text-base font-bold leading-snug text-slate-100"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(h2[1]) }}
              />
            );
          }
          const h3 = line.match(/^### (.+)$/);
          if (h3) {
            return (
              <h3
                key={idx}
                className="text-sm font-semibold leading-snug text-indigo-200"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(h3[1]) }}
              />
            );
          }
          const check = line.match(/^- \[([ xX])\] (.*)$/);
          if (check) {
            const checked = check[1].toLowerCase() === 'x';
            return (
              <div key={idx} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleChecklistLine(idx)}
                  className="mt-1.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-500"
                />
                <span
                  className={checked ? 'text-slate-400 line-through' : 'text-slate-100'}
                  dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(check[2]) }}
                />
              </div>
            );
          }
          const bullet = line.match(/^[-*] (.+)$/);
          if (bullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(bullet[1]) }} />
              </div>
            );
          }
          const ordered = line.match(/^(\d+)\. (.+)$/);
          if (ordered) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="shrink-0 font-mono text-indigo-300">{ordered[1]}.</span>
                <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(ordered[2]) }} />
              </div>
            );
          }
          const quote = line.match(/^> (.*)$/);
          if (quote) {
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-indigo-400/70 bg-indigo-500/5 py-0.5 pl-2.5 text-slate-300"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(quote[1]) }}
              />
            );
          }
          if (line.startsWith('★')) {
            return (
              <div
                key={idx}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line) }}
              />
            );
          }
          return (
            <p
              key={idx}
              className="break-words"
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdownHtml(line) }}
            />
          );
        })
      )}
    </div>
  );
}
