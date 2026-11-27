// ---- 自然表示・関数電卓エンジン（安全な再帰下降パーサー + LaTeX 変換） ----

export type AngleUnit = 'RAD' | 'DEG';

export interface CalcEvaluation {
  ok: boolean;
  value: number | null;
  formatted: string;
  latexExpr: string;
  latexFull: string;
  error: string | null;
  /** 整数値のときの進数変換 */
  bases: { dec: string; hex: string; bin: string } | null;
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; op: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error('階乗は 0 以上の整数のみ対応しています');
  }
  if (n > 170) throw new Error('値が大きすぎます (n <= 170)');
  let acc = 1;
  for (let i = 2; i <= n; i++) acc *= i;
  return acc;
}

function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
    throw new Error('nPr は 0 <= r <= n の整数を指定してください');
  }
  let acc = 1;
  for (let i = 0; i < r; i++) acc *= n - i;
  return acc;
}

function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
    throw new Error('nCr は 0 <= r <= n の整数を指定してください');
  }
  const k = Math.min(r, n - r);
  let acc = 1;
  for (let i = 1; i <= k; i++) {
    acc = (acc * (n - k + i)) / i;
  }
  return Math.round(acc);
}

function tokenize(input: string): Token[] {
  const s = input
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt');

  const raw: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = Number(s.slice(i, j));
      if (Number.isNaN(num)) throw new Error(`数値が不正です: ${s.slice(i, j)}`);
      raw.push({ type: 'num', value: num });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      raw.push({ type: 'ident', name: s.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '(') {
      raw.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      raw.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      raw.push({ type: 'comma' });
      i++;
      continue;
    }
    if ('+-*/^!'.includes(ch)) {
      raw.push({ type: 'op', op: ch });
      i++;
      continue;
    }
    throw new Error(`未対応の文字: ${ch}`);
  }

  // 暗黙の乗算を補完（例: 2pi -> 2*pi, 3(4+5) -> 3*(4+5), (2)(3) -> (2)*(3), 2sin(30) -> 2*sin(30)）
  const out: Token[] = [];
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k];
    if (out.length > 0) {
      const prev = out[out.length - 1];
      const prevEndsValue =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'op' && prev.op === '!') ||
        (prev.type === 'ident' && prev.name in CONSTANTS);
      const curStartsValue = cur.type === 'lparen' || cur.type === 'ident' || cur.type === 'num';
      if (prevEndsValue && curStartsValue) {
        out.push({ type: 'op', op: '*' });
      }
    }
    out.push(cur);
  }
  return out;
}

/** 入力式を評価する */
export function evaluateScientific(expr: string, angleUnit: AngleUnit): CalcEvaluation {
  const trimmed = expr.trim();
  const latexExpr = expressionToLatex(trimmed);
  if (!trimmed) {
    return { ok: true, value: null, formatted: '', latexExpr: '', latexFull: '', error: null, bases: null };
  }

  try {
    const tokens = tokenize(trimmed);
    let pos = 0;
    const peek = (): Token | undefined => tokens[pos];
    const consume = (): Token => tokens[pos++];

    const toRad = (v: number) => (angleUnit === 'DEG' ? (v * Math.PI) / 180 : v);
    const fromRad = (v: number) => (angleUnit === 'DEG' ? (v * 180) / Math.PI : v);

    const parseAddSub = (): number => {
      let left = parseMulDiv();
      while (peek()?.type === 'op' && (peek() as { op: string }).op.match(/^[+-]$/)) {
        const op = (consume() as { op: string }).op;
        const right = parseMulDiv();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseMulDiv = (): number => {
      let left = parsePower();
      while (peek()?.type === 'op' && (peek() as { op: string }).op.match(/^[*/]$/)) {
        const op = (consume() as { op: string }).op;
        const right = parsePower();
        if (op === '/' && right === 0) throw new Error('0 で割ることはできません');
        left = op === '*' ? left * right : left / right;
      }
      return left;
    };

    const parsePower = (): number => {
      const base = parseUnary();
      if (peek()?.type === 'op' && (peek() as { op: string }).op === '^') {
        consume();
        const exp = parsePower();
        return Math.pow(base, exp);
      }
      return base;
    };

    const parseUnary = (): number => {
      if (peek()?.type === 'op' && (peek() as { op: string }).op === '-') {
        consume();
        return -parseUnary();
      }
      if (peek()?.type === 'op' && (peek() as { op: string }).op === '+') {
        consume();
        return parseUnary();
      }
      return parsePostfix();
    };

    const parsePostfix = (): number => {
      let val = parsePrimary();
      while (peek()?.type === 'op' && (peek() as { op: string }).op === '!') {
        consume();
        val = factorial(val);
      }
      return val;
    };

    const parsePrimary = (): number => {
      const tok = peek();
      if (!tok) throw new Error('式が途中で終わっています');
      if (tok.type === 'num') {
        consume();
        return tok.value;
      }
      if (tok.type === 'lparen') {
        consume();
        const val = parseAddSub();
        if (peek()?.type !== 'rparen') throw new Error('閉じ括弧 ) が不足しています');
        consume();
        return val;
      }
      if (tok.type === 'ident') {
        consume();
        const name = tok.name;
        const lower = name.toLowerCase();
        if (lower in CONSTANTS && peek()?.type !== 'lparen') {
          return CONSTANTS[lower];
        }
        if (peek()?.type !== 'lparen') {
          throw new Error(`関数 ${name} には括弧が必要です`);
        }
        consume(); // (
        const args: number[] = [];
        if (peek()?.type !== 'rparen') {
          args.push(parseAddSub());
          while (peek()?.type === 'comma') {
            consume();
            args.push(parseAddSub());
          }
        }
        if (peek()?.type !== 'rparen') throw new Error(`関数 ${name} の閉じ括弧 ) が不足しています`);
        consume();

        switch (lower) {
          case 'sin':
            return Math.sin(toRad(args[0]));
          case 'cos':
            return Math.cos(toRad(args[0]));
          case 'tan':
            return Math.tan(toRad(args[0]));
          case 'asin':
            return fromRad(Math.asin(args[0]));
          case 'acos':
            return fromRad(Math.acos(args[0]));
          case 'atan':
            return fromRad(Math.atan(args[0]));
          case 'ln':
            if (args[0] <= 0) throw new Error('ln の引数は正の数にしてください');
            return Math.log(args[0]);
          case 'log':
          case 'log10':
            if (args[0] <= 0) throw new Error('log10 の引数は正の数にしてください');
            return Math.log10(args[0]);
          case 'sqrt':
            if (args[0] < 0) throw new Error('sqrt の引数は 0 以上にしてください');
            return Math.sqrt(args[0]);
          case 'exp':
            return Math.exp(args[0]);
          case 'abs':
            return Math.abs(args[0]);
          case 'npr':
          case 'p':
            if (args.length !== 2) throw new Error('nPr(n, r) は2つの引数が必要です');
            return nPr(args[0], args[1]);
          case 'ncr':
          case 'c':
            if (args.length !== 2) throw new Error('nCr(n, r) は2つの引数が必要です');
            return nCr(args[0], args[1]);
          default:
            throw new Error(`未対応の関数: ${name}`);
        }
      }
      throw new Error('構文エラー');
    };

    const value = parseAddSub();
    if (pos < tokens.length) throw new Error('式の末尾に余分な文字があります');
    if (!Number.isFinite(value)) throw new Error('計算結果が有限ではありません');

    const cleaned = Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
    const formatted = String(cleaned);
    const isSafeInt = Number.isInteger(cleaned) && Math.abs(cleaned) <= Number.MAX_SAFE_INTEGER;
    const bases = isSafeInt
      ? {
          dec: cleaned.toString(10),
          hex: (cleaned < 0 ? '-' : '') + '0x' + Math.abs(cleaned).toString(16).toUpperCase(),
          bin: (cleaned < 0 ? '-' : '') + '0b' + Math.abs(cleaned).toString(2),
        }
      : null;

    return {
      ok: true,
      value: cleaned,
      formatted,
      latexExpr,
      latexFull: `${latexExpr} = ${formatted}`,
      error: null,
      bases,
    };
  } catch (e) {
    return {
      ok: false,
      value: null,
      formatted: '',
      latexExpr,
      latexFull: latexExpr,
      error: e instanceof Error ? e.message : '計算エラー',
      bases: null,
    };
  }
}

/** 計算式を KaTeX 用の自然表示 LaTeX に変換する */
export function expressionToLatex(expr: string): string {
  if (!expr.trim()) return '';
  let s = expr.trim();

  // nCr(n, r) / nPr(n, r)
  s = s.replace(/\bnCr\s*\(\s*([^,()]+)\s*,\s*([^,()]+)\s*\)/gi, '{}_{$1}\\mathrm{C}_{$2}');
  s = s.replace(/\bnPr\s*\(\s*([^,()]+)\s*,\s*([^,()]+)\s*\)/gi, '{}_{$1}\\mathrm{P}_{$2}');

  // sqrt(...) -> \sqrt{...}
  s = replaceFuncWithBraces(s, 'sqrt', (arg) => `\\sqrt{${arg}}`);
  s = replaceFuncWithBraces(s, 'exp', (arg) => `e^{${arg}}`);

  // 分数: (a)/(b) または 単純トークン a/b
  s = convertFractions(s);

  // 関数名
  s = s.replace(/\basin\b/gi, '\\arcsin');
  s = s.replace(/\bacos\b/gi, '\\arccos');
  s = s.replace(/\batan\b/gi, '\\arctan');
  s = s.replace(/\bsin\b/gi, '\\sin');
  s = s.replace(/\bcos\b/gi, '\\cos');
  s = s.replace(/\btan\b/gi, '\\tan');
  s = s.replace(/\bln\b/gi, '\\ln');
  s = s.replace(/\blog10\b/gi, '\\log_{10}');
  s = s.replace(/\blog\b/gi, '\\log_{10}');

  // 定数・演算子
  s = s.replace(/\bpi\b|π/gi, '\\pi ');
  s = s.replace(/\^(\([^()]+\)|[0-9a-zA-Z.-]+)/g, (_m, exp: string) => {
    const clean = exp.startsWith('(') && exp.endsWith(')') ? exp.slice(1, -1) : exp;
    return `^{${clean}}`;
  });
  s = s.replace(/\*/g, ' \\times ');
  return s;
}

function replaceFuncWithBraces(input: string, fnName: string, render: (arg: string) => string): string {
  const re = new RegExp(`\\b${fnName}\\s*\\(`, 'i');
  let cur = input;
  for (let guard = 0; guard < 12; guard++) {
    const m = re.exec(cur);
    if (!m) break;
    const start = m.index;
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < cur.length && depth > 0) {
      if (cur[i] === '(') depth++;
      else if (cur[i] === ')') depth--;
      i++;
    }
    if (depth !== 0) break;
    const inner = cur.slice(m.index + m[0].length, i - 1);
    cur = cur.slice(0, start) + render(inner) + cur.slice(i);
  }
  return cur;
}

function convertFractions(input: string): string {
  // (a+b)/(c+d) や 1/2 のような単純パターンを \frac{a}{b} に変換
  return input.replace(
    /(\([^()]+\)|[0-9a-zA-Z.\\{}]+)\s*\/\s*(\([^()]+\)|[0-9a-zA-Z.\\{}]+)/g,
    (_m, num: string, den: string) => {
      const n = num.startsWith('(') && num.endsWith(')') ? num.slice(1, -1) : num;
      const d = den.startsWith('(') && den.endsWith(')') ? den.slice(1, -1) : den;
      return `\\frac{${n}}{${d}}`;
    },
  );
}
