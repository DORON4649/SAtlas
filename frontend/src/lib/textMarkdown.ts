import { renderKatexHtml } from './oneNoteModel';

export type TextFormatAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'h1'
  | 'h2'
  | 'normal'
  | 'small'
  | 'bullet'
  | 'checklist'
  | 'inline-math';

export interface SelectionEditResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * 選択範囲の前後を指定デリミタでトグル装飾する。
 * すでに同じデリミタで囲まれていれば解除し、囲まれていなければ追加する。
 */
export function toggleInlineFormat(
  text: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder: string,
): SelectionEditResult {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  // ケース1: 選択範囲のすぐ外側にすでに prefix / suffix がある -> 解除
  if (before.endsWith(prefix) && after.startsWith(suffix)) {
    const nextText =
      before.slice(0, before.length - prefix.length) + selected + after.slice(suffix.length);
    return {
      text: nextText,
      selectionStart: start - prefix.length,
      selectionEnd: end - prefix.length,
    };
  }

  // ケース2: 選択範囲の内側自体が prefix ... suffix で囲まれている -> 解除
  if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length) {
    const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
    const nextText = before + unwrapped + after;
    return {
      text: nextText,
      selectionStart: start,
      selectionEnd: start + unwrapped.length,
    };
  }

  // ケース3: 新たに囲む（未選択時はプレースホルダを挿入して選択状態にする）
  const inner = selected || placeholder;
  const nextText = before + prefix + inner + suffix + after;
  return {
    text: nextText,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + inner.length,
  };
}

const EXISTING_PREFIX_RE = /^(?:#{1,3}\s+|- \[[ xX]\]\s+|[-*]\s+|\d+\.\s+|>\s+)/;

/**
 * 選択範囲がまたがる全行の行頭ブロック記法を切り替える（同じ記法ならトグル解除）。
 */
export function toggleLineBlockFormat(
  text: string,
  start: number,
  end: number,
  target: 'h1' | 'h2' | 'h3' | 'normal' | 'bullet' | 'checklist' | 'ordered' | 'quote',
): SelectionEditResult {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const rawEndIdx = text.indexOf('\n', end);
  const lineEnd = rawEndIdx === -1 ? text.length : rawEndIdx;

  const segment = text.slice(lineStart, lineEnd);
  const lines = segment.split('\n');

  const targetPrefix = (idx: number): string => {
    switch (target) {
      case 'h1':
        return '# ';
      case 'h2':
        return '## ';
      case 'h3':
        return '### ';
      case 'bullet':
        return '- ';
      case 'checklist':
        return '- [ ] ';
      case 'ordered':
        return `${idx + 1}. `;
      case 'quote':
        return '> ';
      default:
        return '';
    }
  };

  const allAlreadyTarget =
    target !== 'normal' &&
    lines.every((l, idx) => {
      if (target === 'checklist') return /^- \[[ xX]\]\s+/.test(l);
      if (target === 'ordered') return /^\d+\.\s+/.test(l);
      return l.startsWith(targetPrefix(idx));
    });

  const updatedLines = lines.map((line, idx) => {
    const stripped = line.replace(EXISTING_PREFIX_RE, '');
    if (target === 'normal' || allAlreadyTarget) {
      return stripped;
    }
    return targetPrefix(idx) + stripped;
  });

  const nextSegment = updatedLines.join('\n');
  const nextText = text.slice(0, lineStart) + nextSegment + text.slice(lineEnd);
  return {
    text: nextText,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextSegment.length,
  };
}

/** 統合アクション適用ヘルパー */
export function applyTextFormatAction(
  text: string,
  start: number,
  end: number,
  action: TextFormatAction,
): SelectionEditResult {
  switch (action) {
    case 'bold':
      return toggleInlineFormat(text, start, end, '**', '**', '太字');
    case 'italic':
      return toggleInlineFormat(text, start, end, '*', '*', '斜体');
    case 'underline':
      return toggleInlineFormat(text, start, end, '<u>', '</u>', '下線');
    case 'strike':
      return toggleInlineFormat(text, start, end, '~~', '~~', '打ち消し線');
    case 'code':
      return toggleInlineFormat(text, start, end, '`', '`', 'code');
    case 'small':
      return toggleInlineFormat(text, start, end, '<small>', '</small>', '注釈');
    case 'inline-math':
      return toggleInlineFormat(text, start, end, '$', '$', 'x^2 + y^2 = r^2');
    case 'h1':
    case 'h2':
    case 'normal':
    case 'bullet':
    case 'checklist':
      return toggleLineBlockFormat(text, start, end, action);
  }
}

/** 現在のカーソル行のアクティブなブロック種別を検出（編集中インジケーター用） */
export function detectCurrentLineBlock(text: string, cursorPos: number): string | null {
  const lineStart = text.lastIndexOf('\n', Math.max(0, cursorPos - 1)) + 1;
  const lineEndRaw = text.indexOf('\n', cursorPos);
  const line = text.slice(lineStart, lineEndRaw === -1 ? text.length : lineEndRaw);

  if (line.startsWith('### ')) return '見出し 3';
  if (line.startsWith('## ')) return '見出し 2';
  if (line.startsWith('# ')) return '見出し 1';
  if (/^- \[[ xX]\] /.test(line)) return 'チェックリスト';
  if (/^[-*] /.test(line)) return '箇条書き';
  if (/^\d+\. /.test(line)) return '番号リスト';
  if (line.startsWith('> ')) return '引用';
  return null;
}

/** HTML エスケープ */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * インライン Markdown（**太字**, *斜体*, ~~打消~~, `code`, <u>下線</u>, <small>小文字</small>, $KaTeX$）を
 * 安全に HTML へ変換する。
 */
export function renderInlineMarkdownHtml(raw: string): string {
  const placeholders: string[] = [];
  const stash = (html: string): string => {
    const idx = placeholders.length;
    placeholders.push(html);
    return `@@SATLASPH${idx}@@`;
  };

  // 1. インラインコード (`...`) を先に退避（内部の数式・記号を誤変換しない）
  let s = raw.replace(/`([^`\n]+)`/g, (_m, code: string) =>
    stash(
      `<code class="rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-cyan-300">${escapeHtml(code)}</code>`,
    ),
  );

  // 2. インライン数式 ($...$) を KaTeX でレンダリングして退避
  s = s.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g, (_m, expr: string) => {
    const rendered = renderKatexHtml(expr, false);
    if (!rendered.html) return escapeHtml(`$${expr}$`);
    return stash(`<span class="inline-block align-middle text-slate-100">${rendered.html}</span>`);
  });

  // 3. 許可されたインライン HTML タグ (<u>, <small>) を退避
  s = s.replace(/<u>([\s\S]*?)<\/u>/gi, (_m, inner: string) =>
    stash(`<span class="underline decoration-indigo-300 underline-offset-2">${renderInlineMarkdownHtml(inner)}</span>`),
  );
  s = s.replace(/<small>([\s\S]*?)<\/small>/gi, (_m, inner: string) =>
    stash(`<span class="text-[10px] text-slate-400">${renderInlineMarkdownHtml(inner)}</span>`),
  );

  // 4. 残りの生テキストを HTML エスケープ
  s = escapeHtml(s);

  // 5. Markdown インライン装飾 (**太字**, ~~打消~~, *斜体*)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  s = s.replace(/~~(.+?)~~/g, '<del class="text-slate-400 line-through">$1</del>');
  s = s.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em class="italic text-slate-200">$1</em>');

  // 6. プレースホルダを復元
  return s.replace(/@@SATLASPH(\d+)@@/g, (_m, idxStr: string) => placeholders[Number(idxStr)] ?? '');
}
