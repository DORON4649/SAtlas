import { useEffect, useMemo, useState } from 'react';
import { FileUp, LoaderCircle, Sparkles, Upload, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { DAY_LABELS, SEMESTER_LABELS, currentAcademicTerm } from '../../lib/timetable';
import type { Semester, TimetableDraft, TimetableEntry, TimetableImportResponse } from '../../types';

interface Props {
  onClose: () => void;
  onSave: (entries: TimetableEntry[]) => Promise<void>;
}

interface DraftRow extends TimetableDraft {
  key: string;
  selected: boolean;
}

type Phase = 'select' | 'parsing' | 'review' | 'saving';

const inputCls =
  'w-full min-w-0 rounded border border-slate-700 bg-slate-800 px-1.5 py-1 text-xs text-slate-100 focus:border-blue-500 focus:outline-none';

/** 時間割 PDF → Gemini (JSON モード) 解析 → 確認・修正 → 保存 のモーダル */
export default function PdfImportModal({ onClose, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [academicYear, setAcademicYear] = useState(() => currentAcademicTerm(new Date()).academicYear);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState<'GEMINI' | 'OLLAMA_FALLBACK' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'saving' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('PDF ファイルを選択してください');
      return;
    }
    setError(null);
    setFile(f);
  };

  const parse = async () => {
    if (!file) return;
    setPhase('parsing');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<TimetableImportResponse>('/api/timetables/import-pdf', form);
      setModel(res.model);
      setProvider(res.provider ?? null);
      setRows(res.entries.map((e, i) => ({ ...e, campus: e.campus ?? '', room: e.room ?? '', key: `${i}`, selected: true })));
      setPhase('review');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('select');
    }
  };

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.selected && r.subject.trim());
  const counts = useMemo(
    () =>
      rows.reduce<Record<Semester, number>>(
        (acc, r) => ({ ...acc, [r.semester]: acc[r.semester] + 1 }),
        { SPRING: 0, FALL: 0, FULL_YEAR: 0 },
      ),
    [rows],
  );

  const save = async () => {
    if (selected.length === 0) return;
    setPhase('saving');
    setError(null);
    try {
      await onSave(
        selected.map((r) => ({
          academicYear,
          semester: r.semester,
          dayOfWeek: r.dayOfWeek,
          period: r.period,
          subject: r.subject.trim(),
          campus: r.campus || null,
          room: r.room || null,
        })),
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setPhase('review');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && phase !== 'saving' && onClose()}>
      <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-100">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            PDFから時間割をAI取込
          </h2>
          <button type="button" onClick={onClose} disabled={phase === 'saving'} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="閉じる">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {(phase === 'select' || phase === 'parsing') && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-400">
                履修登録確認書などの PDF をアップロードすると、Gemini API（JSON モード）が
                <span className="text-slate-200">前期・後期／曜日／時限／科目／教室</span>
                を解析します。保存前に内容を確認・修正できます。
              </p>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-sm transition ${
                  dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <Upload className="h-8 w-8 text-slate-500" />
                {file ? (
                  <span className="font-medium text-slate-100">{file.name}</span>
                ) : (
                  <span className="text-slate-400">PDF をドラッグ＆ドロップ、またはクリックして選択</span>
                )}
                <span className="text-[11px] text-slate-500">最大 20MB</span>
                <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300">
                登録する年度
                <input
                  type="number"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(Number(e.target.value))}
                  className="w-24 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 focus:outline-none"
                />
                年度
              </label>
            </div>
          )}

          {(phase === 'review' || phase === 'saving') && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>
                  {rows.length} 件を検出（前期 {counts.SPRING} / 後期 {counts.FALL} / 通年 {counts.FULL_YEAR}）
                </span>
                {provider && (
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                      provider === 'OLLAMA_FALLBACK'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                    }`}
                  >
                    {provider === 'OLLAMA_FALLBACK' ? 'Ollama フォールバック' : 'Gemini'}
                  </span>
                )}
                {model && <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]">{model}</span>}
                <span className="ml-auto">{academicYear}年度として保存</span>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-lg border border-slate-800 p-6 text-center text-sm text-slate-400">
                  授業を検出できませんでした。別の PDF でお試しください。
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full min-w-[720px] text-xs">
                    <thead className="bg-slate-800/60 text-slate-400">
                      <tr>
                        <th className="w-8 p-2">
                          <input
                            type="checkbox"
                            checked={rows.every((r) => r.selected)}
                            onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))}
                            className="accent-blue-500"
                          />
                        </th>
                        <th className="w-24 p-2 text-left">学期</th>
                        <th className="w-16 p-2 text-left">曜日</th>
                        <th className="w-16 p-2 text-left">時限</th>
                        <th className="p-2 text-left">科目</th>
                        <th className="w-28 p-2 text-left">キャンパス</th>
                        <th className="w-36 p-2 text-left">教室</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.key} className={`border-t border-slate-800 ${r.selected ? '' : 'opacity-40'}`}>
                          <td className="p-2 text-center">
                            <input type="checkbox" checked={r.selected} onChange={(e) => updateRow(r.key, { selected: e.target.checked })} className="accent-blue-500" />
                          </td>
                          <td className="p-1.5">
                            <select value={r.semester} onChange={(e) => updateRow(r.key, { semester: e.target.value as Semester })} className={inputCls}>
                              {(Object.keys(SEMESTER_LABELS) as Semester[]).map((s) => (
                                <option key={s} value={s}>
                                  {SEMESTER_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <select value={r.dayOfWeek} onChange={(e) => updateRow(r.key, { dayOfWeek: Number(e.target.value) })} className={inputCls}>
                              {DAY_LABELS.slice(1).map((d, i) => (
                                <option key={d} value={i + 1}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input type="number" min={1} max={10} value={r.period} onChange={(e) => updateRow(r.key, { period: Number(e.target.value) })} className={inputCls} />
                          </td>
                          <td className="p-1.5">
                            <input value={r.subject} onChange={(e) => updateRow(r.key, { subject: e.target.value })} className={inputCls} />
                          </td>
                          <td className="p-1.5">
                            <input value={r.campus ?? ''} onChange={(e) => updateRow(r.key, { campus: e.target.value })} className={inputCls} />
                          </td>
                          <td className="p-1.5">
                            <input value={r.room ?? ''} onChange={(e) => updateRow(r.key, { room: e.target.value })} className={inputCls} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3">
          {(phase === 'review' || phase === 'saving') && (
            <button
              type="button"
              disabled={phase === 'saving'}
              onClick={() => setPhase('select')}
              className="mr-auto rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              ← PDF を選び直す
            </button>
          )}
          <button type="button" onClick={onClose} disabled={phase === 'saving'} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            キャンセル
          </button>
          {(phase === 'select' || phase === 'parsing') && (
            <button
              type="button"
              disabled={!file || phase === 'parsing'}
              onClick={() => void parse()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {phase === 'parsing' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              {phase === 'parsing' ? 'AI が解析中...' : 'AI で解析'}
            </button>
          )}
          {(phase === 'review' || phase === 'saving') && (
            <button
              type="button"
              disabled={selected.length === 0 || phase === 'saving'}
              onClick={() => void save()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {phase === 'saving' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              選択した {selected.length} 件を時間割に保存
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
