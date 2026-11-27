import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  CalendarDays,
  ClipboardList,
  Code,
  Cpu,
  FileText,
  KeyRound,
  ListChecks,
  LoaderCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { extractNoteTextForAi } from '../../lib/oneNoteModel';
import type { AiChatResponse, AiContextType, AiProvider, CurrentUser, LectureNote } from '../../types';

interface Props {
  user: CurrentUser | null;
  onOpenSettings: () => void;
  /** ノート画面を開いているとき、現在編集・閲覧中のノートを渡す */
  activeNote?: LectureNote | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contextType?: AiContextType;
  provider?: AiProvider;
  model?: string;
}

const BASE_CONTEXT_CHIPS: { type: Exclude<AiContextType, 'NONE' | 'NOTEBOOK'>; label: string; icon: typeof CalendarDays }[] = [
  { type: 'TODAY_SCHEDULE', label: '今日の時間割', icon: CalendarDays },
  { type: 'ASSIGNMENTS', label: '未完了課題', icon: ClipboardList },
];

const NOTE_QUICK_PROMPTS: { label: string; prompt: string; icon: typeof FileText }[] = [
  {
    label: 'ページの要約',
    prompt: 'この講義ノートページの要点を箇条書きで分かりやすく要約してください。',
    icon: FileText,
  },
  {
    label: '数式・コード解説',
    prompt: 'この講義ノートページに含まれる数式やコードセルの意味・動作をステップごとに解説してください。',
    icon: Code,
  },
  {
    label: '確認クイズ作成',
    prompt: 'この講義ノートページの内容から理解度確認クイズを3問（解答と解説付き）作成してください。',
    icon: ListChecks,
  },
];

/** 右サイドパネル常駐の AI アシスタント */
export default function AiAssistantPanel({ user, onOpenSettings, activeNote = null }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextType, setContextType] = useState<AiContextType>('NONE');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgSeqRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const effectiveContext: AiContextType =
    contextType === 'NOTEBOOK' && !activeNote ? 'NONE' : contextType;

  const toggleContext = (t: Exclude<AiContextType, 'NONE'>) =>
    setContextType((prev) => (prev === t ? 'NONE' : t));

  const sendMessage = async (overrideText?: string, overrideContext?: AiContextType) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const targetContext = overrideContext ?? effectiveContext;

    msgSeqRef.current += 1;
    const userMsg: ChatMessage = {
      id: `u-${msgSeqRef.current}`,
      role: 'user',
      content: text,
      contextType: targetContext,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput('');
    if (overrideContext) setContextType(overrideContext);
    setSending(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        message: text,
        contextType: targetContext,
      };
      if (targetContext === 'NOTEBOOK' && activeNote) {
        payload.noteId = activeNote.id;
        payload.noteTitle = activeNote.title;
        payload.noteContent = extractNoteTextForAi(activeNote);
      }

      const res = await api.post<AiChatResponse>('/api/ai/chat', payload);
      msgSeqRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${msgSeqRef.current}`,
          role: 'assistant',
          content: res.reply,
          provider: res.provider,
          model: res.model,
          contextType: res.contextType,
        },
      ]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-72 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-200">AI アシスタント</span>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          title="個人 Gemini API キー・Ollama フォールバック設定"
        >
          <KeyRound className="h-3 w-3 text-cyan-400" />
          API設定
        </button>
      </div>

      {/* ステータス行 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 bg-slate-950/30 px-3 py-1.5 text-[10px] text-slate-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            user?.hasGeminiApiKey ? 'bg-emerald-400' : user?.enableOllamaFallback ? 'bg-amber-400' : 'bg-slate-600'
          }`}
        />
        <span>
          {user?.hasGeminiApiKey
            ? `個人キー (${user.geminiApiKeyMasked ?? '登録済'})`
            : '個人キー未登録'}
        </span>
        {user?.enableOllamaFallback && (
          <span className="ml-auto rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">
            Ollama予備ON
          </span>
        )}
      </div>

      {/* ノート画面専用クイックプロンプト */}
      {activeNote && (
        <div className="space-y-1.5 border-b border-slate-800/80 bg-cyan-950/15 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium text-cyan-300">
            <BookOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">ノート連携: {activeNote.title || '無題のノート'}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {NOTE_QUICK_PROMPTS.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                type="button"
                disabled={sending}
                onClick={() => void sendMessage(prompt, 'NOTEBOOK')}
                className="flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 text-xs">
        {messages.length === 0 && (
          <div className="space-y-2 rounded-lg border border-dashed border-slate-800 p-3 text-[11px] leading-relaxed text-slate-400">
            {activeNote ? (
              <>
                <p>上のクイックボタンや「開いているノートを含める」チップを使って、講義ノートの要約・解説・クイズ作成ができます。</p>
                <p className="text-[10px] text-slate-500">
                  例：「このノートの数式の導出過程をわかりやすく教えて」
                </p>
              </>
            ) : (
              <>
                <p>下のチップで「今日の時間割」や「未完了課題」を添付して質問できます。</p>
                <p className="text-[10px] text-slate-500">
                  例：「今日の空きコマでどの課題を進めるべき？」
                </p>
              </>
            )}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[92%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600/90 text-white'
                  : 'border border-slate-800 bg-slate-800/70 text-slate-100'
              }`}
            >
              {m.content}
            </div>
            {m.role === 'assistant' && m.provider && (
              <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px]">
                {m.provider === 'OLLAMA_FALLBACK' ? (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-medium text-amber-300">
                    <Cpu className="h-2.5 w-2.5" />
                    Ollama フォールバック応答
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-medium text-cyan-300">
                    <Sparkles className="h-2.5 w-2.5" />
                    Gemini 応答
                  </span>
                )}
                {m.model && <span className="text-slate-500">{m.model}</span>}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            AI が回答を生成中...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">
          {error}
        </div>
      )}

      {/* コンテキスト添付チップ＋入力欄 */}
      <form
        className="space-y-2 border-t border-slate-800 p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {activeNote && (
            <button
              type="button"
              onClick={() => toggleContext('NOTEBOOK')}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                effectiveContext === 'NOTEBOOK'
                  ? 'border-cyan-500/50 bg-cyan-600/25 text-cyan-200'
                  : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="h-3 w-3" />
              開いているページを含める
            </button>
          )}
          {BASE_CONTEXT_CHIPS.map(({ type, label, icon: Icon }) => {
            const active = effectiveContext === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleContext(type)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                  active
                    ? 'border-blue-500/50 bg-blue-600/25 text-blue-200'
                    : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            rows={2}
            placeholder="AI に質問（Enter で送信）"
            className="min-w-0 flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-40"
            aria-label="送信"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
