import katex from 'katex';
import type { CodeLanguage } from './codeRunner';

export type NotebookBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'hr' }
  | { type: 'math-block'; expr: string }
  | { type: 'drawing'; caption: string; dataUrl: string }
  | { type: 'code'; language: string; code: string }
  | {
      type: 'code-cell';
      language: CodeLanguage;
      code: string;
      /** 元 Markdown 内の置換対象範囲（文字オフセット） */
      startOffset: number;
      endOffset: number;
    };

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'math-inline'; expr: string }
  | { type: 'code-inline'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'link'; label: string; href: string };

const RUN_CELL_HEADER_RE = /^```run:(python|java|c)\s*$/i;
const FENCE_START_RE = /^```([a-zA-Z0-9_+-]*)\s*$/;
const DRAWING_LINE_RE = /^!\[handwriting(?::([^\]]*))?\]\((data:image\/[^)\s]+)\)\s*$/;

/** KaTeX で数式文字列を HTML へレンダリングする（構文エラー時も例外で落とさない）。 */
export function renderKatexToHtml(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr.trim(), {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return expr;
  }
}

/**
 * 講義ノート Markdown をブロック単位へ分解する。
 * ` ```run:python|java|c ` は実行セルブロック、`$$...$$` はディスプレイ数式として抽出する。
 */
export function parseNotebookBlocks(markdown: string): NotebookBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  // 各行の先頭文字オフセットを前計算
  const lineOffsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(acc);
    acc += lines[i].length + 1; // '\n' 分
  }

  const blocks: NotebookBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    // 1. コード実行セル (```run:python / java / c)
    const runMatch = trimmed.match(RUN_CELL_HEADER_RE);
    if (runMatch) {
      const lang = runMatch[1].toLowerCase() as CodeLanguage;
      const startOffset = lineOffsets[i];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      const endLineIdx = i < lines.length ? i : lines.length - 1;
      const endOffset = lineOffsets[endLineIdx] + lines[endLineIdx].length;
      if (i < lines.length && lines[i].trim() === '```') {
        i++;
      }
      blocks.push({
        type: 'code-cell',
        language: lang,
        code: codeLines.join('\n'),
        startOffset,
        endOffset,
      });
      continue;
    }

    // 2. 通常コードブロック (```lang)
    const fenceMatch = trimmed.match(FENCE_START_RE);
    if (fenceMatch) {
      const language = fenceMatch[1] || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === '```') {
        i++;
      }
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    // 3. ディスプレイ数式 ($$ ... $$)
    if (trimmed.startsWith('$$')) {
      // 単一行 $$expr$$
      if (trimmed.length > 4 && trimmed.endsWith('$$')) {
        blocks.push({ type: 'math-block', expr: trimmed.slice(2, -2).trim() });
        i++;
        continue;
      }
      const exprLines: string[] = [];
      const restFirst = trimmed.slice(2).trim();
      if (restFirst) exprLines.push(restFirst);
      i++;
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.endsWith('$$')) {
          const before = cur.slice(0, -2).trim();
          if (before) exprLines.push(before);
          i++;
          break;
        }
        exprLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'math-block', expr: exprLines.join('\n').trim() });
      continue;
    }

    // 3.5 手書き図解画像
    const drawingMatch = trimmed.match(DRAWING_LINE_RE);
    if (drawingMatch) {
      blocks.push({
        type: 'drawing',
        caption: drawingMatch[1] ?? '手書き図解',
        dataUrl: drawingMatch[2],
      });
      i++;
      continue;
    }

    // 4. 水平線
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 5. 見出し
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3 | 4,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // 6. 引用
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // 7. 箇条書き / 番号付きリスト
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const itemRe = ordered ? /^\d+\.\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(itemRe);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // 8. 段落
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (
        cur === '' ||
        RUN_CELL_HEADER_RE.test(cur) ||
        FENCE_START_RE.test(cur) ||
        cur.startsWith('$$') ||
        /^(#{1,4})\s+/.test(cur) ||
        cur.startsWith('>') ||
        /^[-*+]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(cur)
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
  }

  return blocks;
}

/**
 * 段落や見出し内のインライン要素（$...$ 数式・インラインコード・太字・斜体・リンク）をトークン化する。
 */
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern =
    /(`[^`]+`|\$(?!\$)(?:\\.|[^$\\])+\$|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, idx) });
    }
    const raw = match[0];
    if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ type: 'code-inline', value: raw.slice(1, -1) });
    } else if (raw.startsWith('$') && raw.endsWith('$')) {
      tokens.push({ type: 'math-inline', expr: raw.slice(1, -1) });
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    } else if (raw.startsWith('[')) {
      const m = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (m) {
        tokens.push({ type: 'link', label: m[1], href: m[2] });
      } else {
        tokens.push({ type: 'text', value: raw });
      }
    }
    lastIndex = idx + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return tokens;
}

/** Markdown 内の指定オフセット範囲を新しいコード実行セル文字列で置換する。 */
export function replaceCodeCellInMarkdown(
  markdown: string,
  startOffset: number,
  endOffset: number,
  language: CodeLanguage,
  code: string,
): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const replacement = `\`\`\`run:${language}\n${code}\n\`\`\``;
  return normalized.slice(0, startOffset) + replacement + normalized.slice(endOffset);
}
