interface Props {
  side: 'left' | 'right';
  open: boolean;
  className?: string;
}

/**
 * VS Code / Notion 風のサイドバー開閉アイコン。
 * 角丸フレーム (rx=3) の内部を左右に分け、展開時は該当側を塗りつぶし、折りたたみ時は枠線のみ表示する。
 */
export default function SidebarToggleIcon({ side, open, className = 'h-4 w-4' }: Props) {
  const isLeft = side === 'left';
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 展開時のみ該当サイドを塗りつぶす */}
      {open &&
        (isLeft ? (
          <path d="M4.5 3.5H7.5V16.5H4.5C3.4 16.5 2.5 15.6 2.5 14.5V5.5C2.5 4.4 3.4 3.5 4.5 3.5Z" fill="currentColor" />
        ) : (
          <path d="M12.5 3.5H15.5C16.6 3.5 17.5 4.4 17.5 5.5V14.5C17.5 15.6 16.6 16.5 15.5 16.5H12.5V3.5Z" fill="currentColor" />
        ))}
      {/* 外枠（角丸 rx=3） */}
      <rect x="2.25" y="3.25" width="15.5" height="13.5" rx="3" stroke="currentColor" strokeWidth="1.5" />
      {/* 内部の仕切り線 */}
      <line
        x1={isLeft ? '7.5' : '12.5'}
        y1="3.5"
        x2={isLeft ? '7.5' : '12.5'}
        y2="16.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
