import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  isEditing: boolean;
  titleClassName?: string;
  children?: ReactNode;
}

/** ウィジェット共通ヘッダー（編集モード時のドラッグハンドル） */
export default function WidgetHeader({ icon, title, isEditing, titleClassName = 'text-slate-400', children }: Props) {
  return (
    <div className={`drag-handle flex items-center justify-between gap-2 text-xs ${isEditing ? 'cursor-move' : ''}`}>
      <span className={`flex shrink-0 items-center gap-1.5 font-medium ${titleClassName}`}>
        {icon}
        {title}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        {isEditing && <span className="hidden text-blue-400 sm:inline">ドラッグで移動</span>}
        {children}
      </div>
    </div>
  );
}
