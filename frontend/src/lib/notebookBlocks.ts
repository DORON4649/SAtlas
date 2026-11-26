import { CODE_LANGUAGE_META, type CodeLanguage } from './codeRunner';

export interface ChecklistItem {
  checked: boolean;
  text: string;
}

export type VisualBlock =
  | { id: string; type: 'heading'; level: 1 | 2 | 3; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'bullet-list'; items: string[] }
  | { id: string; type: 'ordered-list'; items: string[] }
  | { id: string; type: 'checklist'; items: ChecklistItem[] }
  | { id: string; type: 'quote'; text: string }
  | { id: string; type: 'math'; expr: string }
  | { id: string; type: 'code-cell'; language: CodeLanguage; code: string }
  | { id: string; type: 'drawing'; dataUrl: string; caption: string }
  | { id: string; type: 'divider' };

let blockIdCounter = 0;

export function nextBlockId(): string {
  blockIdCounter += 1;
  return `blk-${blockIdCounter}`;
}

const RUN_CELL_HEADER_RE = /^```run:(python|java|c)\s*$/i;
const FENCE_START_RE = /^```([a-zA-Z0-9_+-]*)\s*$/;
const DRAWING_LINE_RE = /^!\[handwriting(?::([^\]]*))?\]\((data:image\/[^)\s]+)\)\s*$/;
const CHECKLIST_RE = /^[-*+]\s+\[([ xX])\]\s*(.*)$/;
const BULLET_RE = /^[-*+]\s+(.*)$/;
const ORDERED_RE = /^\d+\.\s+(.*)$/;

/** Markdown 文字列をビジュアル編集用ブロック配列へ変換する */
export function markdownToVisualBlocks(markdown: string): VisualBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: VisualBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    // 1. コード実行セル
    const runMatch = trimmed.match(RUN_CELL_HEADER_RE);
    if (runMatch) {
      const lang = runMatch[1].toLowerCase() as CodeLanguage;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === '```') i++;
      blocks.push({ id: nextBlockId(), type: 'code-cell', language: lang, code: codeLines.join('\n') });
      continue;
    }

    // 2. 通常コードブロック（python/java/c なら実行セル互換として扱うか段落保持）
    const fenceMatch = trimmed.match(FENCE_START_RE);
    if (fenceMatch) {
      const rawLang = fenceMatch[1].toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === '```') i++;
      if (rawLang === 'python' || rawLang === 'java' || rawLang === 'c') {
        blocks.push({
          id: nextBlockId(),
          type: 'code-cell',
          language: rawLang,
          code: codeLines.join('\n'),
        });
      } else {
        blocks.push({
          id: nextBlockId(),
          type: 'paragraph',
          text: `\`\`\`${rawLang}\n${codeLines.join('\n')}\n\`\`\``,
        });
      }
      continue;
    }

    // 3. ディスプレイ数式ブロック ($$ ... $$)
    if (trimmed.startsWith('$$')) {
      if (trimmed.length > 4 && trimmed.endsWith('$$')) {
        blocks.push({ id: nextBlockId(), type: 'math', expr: trimmed.slice(2, -2).trim() });
        i++;
        continue;
      }
      const exprLines: string[] = [];
      const firstRest = trimmed.slice(2).trim();
      if (firstRest) exprLines.push(firstRest);
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
      blocks.push({ id: nextBlockId(), type: 'math', expr: exprLines.join('\n').trim() });
      continue;
    }

    // 4. 手書きキャンバス画像ブロック
    const drawingMatch = trimmed.match(DRAWING_LINE_RE);
    if (drawingMatch) {
      blocks.push({
        id: nextBlockId(),
        type: 'drawing',
        caption: drawingMatch[1] ?? '手書き図解',
        dataUrl: drawingMatch[2],
      });
      i++;
      continue;
    }

    // 5. 区切り線
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ id: nextBlockId(), type: 'divider' });
      i++;
      continue;
    }

    // 6. 見出し (H1..H3)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        id: nextBlockId(),
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // 7. 引用
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ id: nextBlockId(), type: 'quote', text: quoteLines.join('\n') });
      continue;
    }

    // 8. チェックリスト
    if (CHECKLIST_RE.test(trimmed)) {
      const items: ChecklistItem[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(CHECKLIST_RE);
        if (!m) break;
        items.push({ checked: m[1].toLowerCase() === 'x', text: m[2] });
        i++;
      }
      blocks.push({ id: nextBlockId(), type: 'checklist', items });
      continue;
    }

    // 9. 箇条書き
    if (BULLET_RE.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const curTrim = lines[i].trim();
        if (CHECKLIST_RE.test(curTrim)) break;
        const m = curTrim.match(BULLET_RE);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ id: nextBlockId(), type: 'bullet-list', items });
      continue;
    }

    // 10. 番号付きリスト
    if (ORDERED_RE.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(ORDERED_RE);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ id: nextBlockId(), type: 'ordered-list', items });
      continue;
    }

    // 11. 段落
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (
        cur === '' ||
        RUN_CELL_HEADER_RE.test(cur) ||
        FENCE_START_RE.test(cur) ||
        cur.startsWith('$$') ||
        DRAWING_LINE_RE.test(cur) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(cur) ||
        /^(#{1,3})\s+/.test(cur) ||
        cur.startsWith('>') ||
        CHECKLIST_RE.test(cur) ||
        BULLET_RE.test(cur) ||
        ORDERED_RE.test(cur)
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ id: nextBlockId(), type: 'paragraph', text: paraLines.join('\n') });
  }

  if (blocks.length === 0) {
    blocks.push({ id: nextBlockId(), type: 'paragraph', text: '' });
  }
  return blocks;
}

/** ビジュアル編集用ブロック配列を Markdown 文字列へシリアライズする */
export function visualBlocksToMarkdown(blocks: VisualBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `${'#'.repeat(block.level)} ${block.text}`;
        case 'paragraph':
          return block.text;
        case 'bullet-list':
          return block.items.map((item) => `- ${item}`).join('\n');
        case 'ordered-list':
          return block.items.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
        case 'checklist':
          return block.items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
        case 'quote':
          return block.text
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n');
        case 'math':
          return `$$\n${block.expr}\n$$`;
        case 'code-cell':
          return `\`\`\`run:${block.language}\n${block.code}\n\`\`\``;
        case 'drawing':
          return `![handwriting:${block.caption || '手書き図解'}](${block.dataUrl})`;
        case 'divider':
          return '---';
      }
    })
    .filter((chunk, idx, arr) => chunk !== '' || arr.length === 1 || idx < arr.length - 1)
    .join('\n\n');
}

/** 任意ブロックからテキスト表現を取り出す（ブロック種別変換用） */
export function extractBlockText(block: VisualBlock): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
      return block.text;
    case 'bullet-list':
    case 'ordered-list':
      return block.items.join('\n');
    case 'checklist':
      return block.items.map((i) => i.text).join('\n');
    case 'math':
      return block.expr;
    case 'code-cell':
      return block.code;
    case 'drawing':
      return block.caption;
    case 'divider':
      return '';
  }
}

/** ブロックを別のテキスト系ブロック種別へ変換する */
export function convertBlockType(
  block: VisualBlock,
  target: 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet-list' | 'ordered-list' | 'checklist' | 'quote',
): VisualBlock {
  const raw = extractBlockText(block);
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const safeLines = lines.length > 0 ? lines : [''];

  switch (target) {
    case 'h1':
      return { id: block.id, type: 'heading', level: 1, text: raw.replace(/\n+/g, ' ') };
    case 'h2':
      return { id: block.id, type: 'heading', level: 2, text: raw.replace(/\n+/g, ' ') };
    case 'h3':
      return { id: block.id, type: 'heading', level: 3, text: raw.replace(/\n+/g, ' ') };
    case 'bullet-list':
      return { id: block.id, type: 'bullet-list', items: safeLines };
    case 'ordered-list':
      return { id: block.id, type: 'ordered-list', items: safeLines };
    case 'checklist':
      return {
        id: block.id,
        type: 'checklist',
        items: safeLines.map((text) => ({ checked: false, text })),
      };
    case 'quote':
      return { id: block.id, type: 'quote', text: raw };
    default:
      return { id: block.id, type: 'paragraph', text: raw };
  }
}

/** ブロックの複製（新しい ID を付与） */
export function cloneBlock(block: VisualBlock): VisualBlock {
  switch (block.type) {
    case 'bullet-list':
    case 'ordered-list':
      return { ...block, id: nextBlockId(), items: [...block.items] };
    case 'checklist':
      return { ...block, id: nextBlockId(), items: block.items.map((item) => ({ ...item })) };
    default:
      return { ...block, id: nextBlockId() };
  }
}

export function createCodeCellBlock(language: CodeLanguage): VisualBlock {
  return {
    id: nextBlockId(),
    type: 'code-cell',
    language,
    code: CODE_LANGUAGE_META[language].template,
  };
}

export function createMathBlock(expr = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'): VisualBlock {
  return {
    id: nextBlockId(),
    type: 'math',
    expr,
  };
}

export function createLectureHeaderBlocks(subjectName: string): VisualBlock[] {
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  return [
    {
      id: nextBlockId(),
      type: 'heading',
      level: 1,
      text: `${subjectName || '講義'} 第〇回（${dateStr}）`,
    },
    {
      id: nextBlockId(),
      type: 'checklist',
      items: [
        { checked: false, text: '本日のテーマ・キーワードを整理する' },
        { checked: false, text: '演習問題・レポート締切を確認する' },
      ],
    },
    { id: nextBlockId(), type: 'divider' },
  ];
}
