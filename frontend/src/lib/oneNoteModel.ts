import katex from 'katex';
import type { LectureNote } from '../types';
import { CODE_BLOCK_META, type CodeBlockLanguage } from './codeHighlight';

export type PageBackground = 'blank' | 'ruled' | 'grid';

export type InkToolKind = 'pen' | 'highlighter';

export interface InkPoint {
  x: number;
  y: number;
}

export interface InkStroke {
  id: string;
  tool: InkToolKind;
  color: string;
  width: number;
  opacity: number;
  points: InkPoint[];
  /** Shift キーで直線・矢印にスナップした場合 true */
  arrow?: boolean;
}

export type NoteContainer =
  | {
      id: string;
      kind: 'text';
      x: number;
      y: number;
      width: number;
      text: string;
    }
  | {
      id: string;
      kind: 'math';
      x: number;
      y: number;
      width: number;
      expr: string;
    }
  | {
      id: string;
      kind: 'code';
      x: number;
      y: number;
      width: number;
      language: CodeBlockLanguage;
      code: string;
      fileName?: string;
    };

export interface OneNotePageContent {
  version: 2;
  background: PageBackground;
  containers: NoteContainer[];
  strokes: InkStroke[];
}

export const SECTION_COLOR_PRESETS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#ec4899', // Pink
] as const;

export const DEFAULT_SECTION_NAME = '一般';
export const DEFAULT_SECTION_COLOR = '#6366f1';

let idSeq = 0;

export function nextOneNoteId(prefix: 'box' | 'ink'): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

export function createEmptyPageContent(background: PageBackground = 'grid'): OneNotePageContent {
  return {
    version: 2,
    background,
    containers: [
      {
        id: nextOneNoteId('box'),
        kind: 'text',
        x: 36,
        y: 32,
        width: 560,
        text: '# 新しいページ\n\nキャンバスの好きな場所をクリックまたは右クリックして、テキスト・数式・コードセルを自由に配置できます。',
      },
    ],
    strokes: [],
  };
}

export function createTextContainer(x: number, y: number, text = ''): NoteContainer {
  return {
    id: nextOneNoteId('box'),
    kind: 'text',
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y)),
    width: 440,
    text,
  };
}

export function createMathContainer(
  x: number,
  y: number,
  expr = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
): NoteContainer {
  return {
    id: nextOneNoteId('box'),
    kind: 'math',
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y)),
    width: 420,
    expr,
  };
}

export function createCodeContainer(x: number, y: number, language: CodeBlockLanguage): NoteContainer {
  const meta = CODE_BLOCK_META[language] ?? CODE_BLOCK_META.plaintext;
  return {
    id: nextOneNoteId('box'),
    kind: 'code',
    x: Math.max(12, Math.round(x)),
    y: Math.max(12, Math.round(y)),
    width: 560,
    language,
    fileName: meta.defaultFileName,
    code: meta.template,
  };
}

export function cloneContainer(c: NoteContainer): NoteContainer {
  return {
    ...c,
    id: nextOneNoteId('box'),
    x: c.x + 28,
    y: c.y + 28,
  };
}

/** contentJson を安全にパースする（空・壊れた JSON にも対応） */
export function parseOneNoteContent(raw: string | null | undefined): OneNotePageContent {
  if (!raw || !raw.trim()) {
    return createEmptyPageContent('grid');
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OneNotePageContent>;
    const background: PageBackground =
      parsed.background === 'blank' || parsed.background === 'ruled' || parsed.background === 'grid'
        ? parsed.background
        : 'grid';
    const containers = Array.isArray(parsed.containers) ? parsed.containers : [];
    const strokes = Array.isArray(parsed.strokes) ? parsed.strokes : [];
    return { version: 2, background, containers, strokes };
  } catch {
    return {
      version: 2,
      background: 'grid',
      containers: [createTextContainer(36, 32, raw)],
      strokes: [],
    };
  }
}

export function serializeOneNoteContent(content: OneNotePageContent): string {
  return JSON.stringify(content);
}

/** KaTeX 数式を HTML にレンダリング */
export function renderKatexHtml(expr: string, displayMode = true): { html: string; error: string | null } {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { html: '', error: null };
  }
  try {
    const html = katex.renderToString(trimmed, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
    });
    return { html, error: null };
  } catch (e) {
    const fallback = katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    });
    return { html: fallback, error: e instanceof Error ? e.message : '数式の構文エラー' };
  }
}

/** AI コンテキスト送信用のプレーンテキスト抽出 */
export function extractNoteTextForAi(note: LectureNote): string {
  const page = parseOneNoteContent(note.contentJson);
  const parts: string[] = [];
  for (const c of page.containers) {
    if (c.kind === 'text' && c.text.trim()) {
      parts.push(`[テキスト]\n${c.text.trim()}`);
    } else if (c.kind === 'math' && c.expr.trim()) {
      parts.push(`[数式 (LaTeX)]\n$$${c.expr.trim()}$$`);
    } else if (c.kind === 'code' && c.code.trim()) {
      parts.push(`[コードセル: ${c.language}]\n\`\`\`${c.language}\n${c.code.trim()}\n\`\`\``);
    }
  }
  if (page.strokes.length > 0) {
    parts.push(`（ページ上に手書きストローク ${page.strokes.length} 本あり）`);
  }
  return parts.join('\n\n');
}

/** 初回サンプルページ（見出し・KaTeX数式・Pythonコードセル・手書き図解の例） */
export function createSampleOneNoteContent(): OneNotePageContent {
  return {
    version: 2,
    background: 'grid',
    containers: [
      {
        id: 'sample-intro',
        kind: 'text',
        x: 32,
        y: 24,
        width: 540,
        text: [
          '# ようこそ！SAtlas OneNote 風 講義ノート',
          '',
          'このキャンバスは **自由配置** に対応しています。ヘッダーをドラッグして移動、右下でリサイズ、任意の位置で右クリックして挿入できます。',
          '',
          '★ 重要：上のリボン「描画」タブで、ページ全体に直接ペン・蛍光マーカー・Shift直線矢印を描き込めます！',
          '',
          '- [x] 左ペインで「科目 ＞ 色付きセクション ＞ ページ」を確認する',
          '- [ ] リボン「表示・ツール」から自然表示・関数電卓を開いて数式を挿入する',
          '- [ ] 右ペインの AI アシスタントで「ページの要約」を試す',
        ].join('\n'),
      },
      {
        id: 'sample-math',
        kind: 'math',
        x: 32,
        y: 310,
        width: 460,
        expr: '\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
      },
      {
        id: 'sample-code',
        kind: 'code',
        x: 32,
        y: 455,
        width: 560,
        language: 'python',
        code: [
          'def fib(n: int) -> list[int]:',
          '    a, b = 0, 1',
          '    out = []',
          '    for _ in range(n):',
          '        out.append(a)',
          '        a, b = b, a + b',
          '    return out',
          '',
          'print("フィボナッチ数列:", fib(8))',
        ].join('\n'),
      },
    ],
    strokes: [
      {
        id: 'sample-hl-1',
        tool: 'highlighter',
        color: '#fde047',
        width: 16,
        opacity: 0.4,
        points: [
          { x: 52, y: 122 },
          { x: 240, y: 122 },
          { x: 430, y: 122 },
        ],
      },
      {
        id: 'sample-arrow-1',
        tool: 'pen',
        color: '#38bdf8',
        width: 3,
        opacity: 1,
        arrow: true,
        points: [
          { x: 520, y: 355 },
          { x: 635, y: 355 },
        ],
      },
      {
        id: 'sample-circle-1',
        tool: 'pen',
        color: '#f43f5e',
        width: 2.5,
        opacity: 1,
        points: [
          { x: 645, y: 330 },
          { x: 695, y: 325 },
          { x: 740, y: 345 },
          { x: 735, y: 375 },
          { x: 685, y: 385 },
          { x: 645, y: 365 },
          { x: 645, y: 330 },
        ],
      },
    ],
  };
}
