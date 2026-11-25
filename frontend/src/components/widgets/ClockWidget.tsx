import { Clock } from 'lucide-react';
import { useNow } from '../../hooks/useNow';
import WidgetHeader from './WidgetHeader';

export default function ClockWidget({ isEditing }: { isEditing: boolean }) {
  const now = useNow();
  return (
    <>
      <WidgetHeader icon={<Clock className="h-4 w-4 text-cyan-400" />} title="現在時刻" isEditing={isEditing} />
      <div className="mt-auto">
        <div className="font-mono text-3xl font-bold tracking-tight text-white">{now.toLocaleTimeString('ja-JP')}</div>
        <div className="mt-1 text-sm text-slate-400">
          {now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </div>
      </div>
    </>
  );
}
