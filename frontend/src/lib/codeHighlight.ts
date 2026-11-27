import { CODE_LANGUAGE_META, type CodeLanguage } from './codeRunner';

export type DisplayOnlyLanguage =
  | 'typescript'
  | 'javascript'
  | 'cpp'
  | 'rust'
  | 'go'
  | 'php'
  | 'sql'
  | 'html'
  | 'css'
  | 'json'
  | 'bash'
  | 'plaintext';

export type CodeBlockLanguage = CodeLanguage | DisplayOnlyLanguage;

export interface CodeBlockMeta {
  label: string;
  defaultFileName: string;
  tabSize: 2 | 4;
  runnable: boolean;
  template: string;
}

export const RUNNABLE_LANGUAGES: CodeLanguage[] = ['python', 'java', 'c'];

export const DISPLAY_LANGUAGES: DisplayOnlyLanguage[] = [
  'typescript',
  'javascript',
  'cpp',
  'rust',
  'go',
  'php',
  'sql',
  'html',
  'css',
  'json',
  'bash',
  'plaintext',
];

export function isRunnableLanguage(lang: CodeBlockLanguage): lang is CodeLanguage {
  return lang === 'python' || lang === 'java' || lang === 'c';
}

export const CODE_BLOCK_META: Record<CodeBlockLanguage, CodeBlockMeta> = {
  python: {
    label: 'Python',
    defaultFileName: CODE_LANGUAGE_META.python.fileHint,
    tabSize: 4,
    runnable: true,
    template: CODE_LANGUAGE_META.python.template,
  },
  java: {
    label: 'Java',
    defaultFileName: CODE_LANGUAGE_META.java.fileHint,
    tabSize: 4,
    runnable: true,
    template: CODE_LANGUAGE_META.java.template,
  },
  c: {
    label: 'C',
    defaultFileName: CODE_LANGUAGE_META.c.fileHint,
    tabSize: 4,
    runnable: true,
    template: CODE_LANGUAGE_META.c.template,
  },
  typescript: {
    label: 'TypeScript',
    defaultFileName: 'index.ts',
    tabSize: 2,
    runnable: false,
    template: `interface Student {\n  id: number;\n  name: string;\n}\n\nconst greet = (s: Student): string => \`Hello, \${s.name}!\`;\n`,
  },
  javascript: {
    label: 'JavaScript',
    defaultFileName: 'script.js',
    tabSize: 2,
    runnable: false,
    template: `function sum(nums) {\n  return nums.reduce((acc, n) => acc + n, 0);\n}\n\nconsole.log(sum([1, 2, 3, 4]));\n`,
  },
  cpp: {
    label: 'C++',
    defaultFileName: 'main.cpp',
    tabSize: 4,
    runnable: false,
    template: `#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> v = {1, 2, 3};\n    std::cout << v.size() << std::endl;\n    return 0;\n}\n`,
  },
  rust: {
    label: 'Rust',
    defaultFileName: 'main.rs',
    tabSize: 4,
    runnable: false,
    template: `fn main() {\n    let nums = vec![1, 2, 3, 4];\n    let total: i32 = nums.iter().sum();\n    println!("sum = {}", total);\n}\n`,
  },
  go: {
    label: 'Go',
    defaultFileName: 'main.go',
    tabSize: 4,
    runnable: false,
    template: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, SAtlas!")\n}\n`,
  },
  php: {
    label: 'PHP',
    defaultFileName: 'index.php',
    tabSize: 4,
    runnable: false,
    template: `<?php\nfunction add(int $a, int $b): int {\n    return $a + $b;\n}\necho add(2, 3);\n`,
  },
  sql: {
    label: 'SQL',
    defaultFileName: 'query.sql',
    tabSize: 2,
    runnable: false,
    template: `SELECT subject_name, COUNT(*) AS note_count\nFROM lecture_notes\nWHERE is_pinned = TRUE\nGROUP BY subject_name\nORDER BY note_count DESC;\n`,
  },
  html: {
    label: 'HTML',
    defaultFileName: 'index.html',
    tabSize: 2,
    runnable: false,
    template: `<section class="card">\n  <h2>SAtlas Note</h2>\n  <p>Hello, world!</p>\n</section>\n`,
  },
  css: {
    label: 'CSS',
    defaultFileName: 'style.css',
    tabSize: 2,
    runnable: false,
    template: `.card {\n  display: flex;\n  padding: 16px;\n  color: #e2e8f0;\n  background: #0f172a;\n}\n`,
  },
  json: {
    label: 'JSON',
    defaultFileName: 'data.json',
    tabSize: 2,
    runnable: false,
    template: `{\n  "name": "satlas",\n  "version": "1.0.0",\n  "enabled": true\n}\n`,
  },
  bash: {
    label: 'Bash / Shell',
    defaultFileName: 'run.sh',
    tabSize: 2,
    runnable: false,
    template: `#!/usr/bin/env bash\nset -euo pipefail\necho "Building SAtlas..."\n`,
  },
  plaintext: {
    label: 'Plain Text',
    defaultFileName: 'memo.txt',
    tabSize: 2,
    runnable: false,
    template: '',
  },
};

const KEYWORDS: Record<CodeBlockLanguage, Set<string>> = {
  python: new Set([
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or',
    'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'pass',
    'break', 'continue', 'True', 'False', 'None', 'async', 'await', 'raise', 'global', 'nonlocal',
  ]),
  java: new Set([
    'public', 'private', 'protected', 'class', 'interface', 'record', 'enum', 'extends', 'implements',
    'static', 'final', 'void', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package',
    'true', 'false', 'null', 'this', 'super', 'var', 'boolean', 'int', 'long', 'double', 'float', 'char',
  ]),
  c: new Set([
    'int', 'long', 'short', 'char', 'float', 'double', 'void', 'unsigned', 'signed', 'const', 'static',
    'struct', 'typedef', 'enum', 'union', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
    'case', 'default', 'break', 'continue', 'sizeof', 'NULL', 'true', 'false', 'include', 'define',
  ]),
  cpp: new Set([
    'int', 'long', 'short', 'char', 'float', 'double', 'void', 'bool', 'auto', 'const', 'constexpr',
    'static', 'class', 'struct', 'namespace', 'template', 'typename', 'using', 'public', 'private',
    'protected', 'virtual', 'override', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'break', 'continue', 'new', 'delete', 'nullptr', 'true', 'false', 'std', 'include', 'define',
  ]),
  typescript: new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'from', 'default',
    'async', 'await', 'type', 'interface', 'enum', 'class', 'extends', 'implements', 'public', 'private',
    'readonly', 'as', 'keyof', 'typeof', 'in', 'of', 'true', 'false', 'null', 'undefined', 'void',
  ]),
  javascript: new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'from', 'default',
    'async', 'await', 'class', 'extends', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined',
  ]),
  rust: new Set([
    'fn', 'let', 'mut', 'const', 'pub', 'struct', 'enum', 'impl', 'trait', 'for', 'in', 'while', 'loop',
    'if', 'else', 'match', 'return', 'break', 'continue', 'use', 'mod', 'crate', 'where', 'async', 'await',
    'move', 'ref', 'self', 'Self', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'vec', 'println',
  ]),
  go: new Set([
    'package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'return',
    'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'go', 'defer',
    'select', 'true', 'false', 'nil', 'make', 'len', 'append', 'cap',
  ]),
  php: new Set([
    'function', 'class', 'public', 'private', 'protected', 'static', 'return', 'if', 'elseif', 'else',
    'foreach', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch',
    'finally', 'throw', 'echo', 'print', 'namespace', 'use', 'true', 'false', 'null', 'array', 'int', 'string',
  ]),
  sql: new Set([
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
    'ALTER', 'DROP', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN',
    'IS', 'NULL', 'TRUE', 'FALSE', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET',
    'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION',
  ]),
  html: new Set(),
  css: new Set(['important', 'from', 'to', 'media', 'keyframes', 'import']),
  json: new Set(['true', 'false', 'null']),
  bash: new Set([
    'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'in',
    'function', 'return', 'exit', 'export', 'local', 'set', 'echo', 'cd', 'ls', 'grep', 'awk', 'sed', 'true', 'false',
  ]),
  plaintext: new Set(),
};

const BUILTIN_TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'object', 'Promise', 'Array', 'Record', 'Map', 'Set',
  'String', 'Integer', 'Long', 'Double', 'Boolean', 'List', 'Optional', 'System',
  'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'usize', 'f32', 'f64', 'str', 'Vec', 'Option', 'Result',
  'size_t', 'uint8_t', 'uint32_t', 'int64_t', 'vector', 'iostream', 'fmt', 'int', 'float', 'dict', 'list', 'tuple',
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const span = (colorClass: string, raw: string) => `<span class="${colorClass}">${escapeHtml(raw)}</span>`;

/**
 * VS Code Dark+ 風の軽量シンタックスハイライト HTML を返す。
 * 等幅フォントの文字幅を変えないよう色のみ付与する（太字・斜体によるカーソルずれを防止）。
 */
export function highlightCodeHtml(code: string, language: CodeBlockLanguage): string {
  if (!code) return '';
  if (language === 'plaintext') return escapeHtml(code);

  if (language === 'html') {
    return highlightHtml(code);
  }
  if (language === 'css') {
    return highlightCss(code);
  }
  if (language === 'json') {
    return highlightJson(code);
  }

  const kw = KEYWORDS[language];
  const isSql = language === 'sql';
  const hashComment = language === 'python' || language === 'bash' || language === 'php';
  const slashComment = !isSql && language !== 'python' && language !== 'bash';

  // 単一パス正規表現トークナイザ
  const tokenRe = new RegExp(
    [
      '(?<blockComment>/\\*[\\s\\S]*?\\*/)',
      slashComment ? '(?<lineComment>//[^\\n]*)' : null,
      hashComment ? '(?<hashComment>#[^\\n]*)' : null,
      isSql ? '(?<sqlComment>--[^\\n]*)' : null,
      language === 'c' || language === 'cpp' ? '(?<preproc>^\\s*#[a-zA-Z]+)' : null,
      '(?<string>"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)',
      '(?<number>\\b(?:0x[0-9a-fA-F]+|0b[01]+|\\d+(?:\\.\\d+)?)\\b)',
      language === 'php' || language === 'bash' ? '(?<var>\\$[A-Za-z_][A-Za-z0-9_]*)' : null,
      '(?<ident>\\b[A-Za-z_][A-Za-z0-9_]*\\b)',
    ]
      .filter(Boolean)
      .join('|'),
    'gm',
  );

  let out = '';
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(code)) !== null) {
    if (m.index > lastIndex) {
      out += escapeHtml(code.slice(lastIndex, m.index));
    }
    const raw = m[0];
    const groups = m.groups ?? {};

    if (groups.blockComment || groups.lineComment || groups.hashComment || groups.sqlComment) {
      out += span('text-[#6A9955]', raw);
    } else if (groups.preproc) {
      out += span('text-[#C586C0]', raw);
    } else if (groups.string) {
      out += span('text-[#CE9178]', raw);
    } else if (groups.number) {
      out += span('text-[#B5CEA8]', raw);
    } else if (groups.var) {
      out += span('text-[#9CDCFE]', raw);
    } else if (groups.ident) {
      const checkKey = isSql ? raw.toUpperCase() : raw;
      const nextChar = code[m.index + raw.length];
      if (kw.has(checkKey)) {
        out += span('text-[#569CD6]', raw);
      } else if (BUILTIN_TYPES.has(raw) || /^[A-Z][A-Za-z0-9_]*$/.test(raw)) {
        out += span('text-[#4EC9B0]', raw);
      } else if (nextChar === '(') {
        out += span('text-[#DCDCAA]', raw);
      } else {
        out += escapeHtml(raw);
      }
    } else {
      out += escapeHtml(raw);
    }

    lastIndex = m.index + raw.length;
  }

  if (lastIndex < code.length) {
    out += escapeHtml(code.slice(lastIndex));
  }
  return out;
}

function highlightJson(code: string): string {
  const re = /(?<key>"(?:\\.|[^"\\])*")\s*(?=:)|(?<string>"(?:\\.|[^"\\])*")|(?<number>-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(?<bool>\b(?:true|false|null)\b)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out += escapeHtml(code.slice(last, m.index));
    const g = m.groups ?? {};
    if (g.key) out += span('text-[#9CDCFE]', m[0]);
    else if (g.string) out += span('text-[#CE9178]', m[0]);
    else if (g.number) out += span('text-[#B5CEA8]', m[0]);
    else if (g.bool) out += span('text-[#569CD6]', m[0]);
    else out += escapeHtml(m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) out += escapeHtml(code.slice(last));
  return out;
}

function highlightHtml(code: string): string {
  const re = /(?<comment><!--[\s\S]*?-->)|(?<tag><\/?[A-Za-z][A-Za-z0-9-]*)|(?<attr>\s[A-Za-z-:]+(?==))|(?<string>"[^"]*"|'[^']*')/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out += escapeHtml(code.slice(last, m.index));
    const g = m.groups ?? {};
    if (g.comment) out += span('text-[#6A9955]', m[0]);
    else if (g.tag) out += span('text-[#569CD6]', m[0]);
    else if (g.attr) out += span('text-[#9CDCFE]', m[0]);
    else if (g.string) out += span('text-[#CE9178]', m[0]);
    else out += escapeHtml(m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) out += escapeHtml(code.slice(last));
  return out;
}

function highlightCss(code: string): string {
  const re = /(?<comment>\/\*[\s\S]*?\*\/)|(?<prop>[a-z-]+(?=\s*:))|(?<hex>#[0-9a-fA-F]{3,8}\b)|(?<num>\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b)|(?<selector>[.#][A-Za-z0-9_-]+)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out += escapeHtml(code.slice(last, m.index));
    const g = m.groups ?? {};
    if (g.comment) out += span('text-[#6A9955]', m[0]);
    else if (g.prop) out += span('text-[#9CDCFE]', m[0]);
    else if (g.hex) out += span('text-[#CE9178]', m[0]);
    else if (g.num) out += span('text-[#B5CEA8]', m[0]);
    else if (g.selector) out += span('text-[#D7BA7D]', m[0]);
    else out += escapeHtml(m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) out += escapeHtml(code.slice(last));
  return out;
}
