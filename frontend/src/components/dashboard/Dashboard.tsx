import { ResponsiveGridLayout, useContainerWidth, type Layout, type ResponsiveLayouts } from 'react-grid-layout';
import type { TimetableSource } from '../../hooks/useTimetable';
import { GRID_BREAKPOINTS, GRID_COLS, type GridBreakpoint } from '../../lib/layout';
import type { TimetableEntry } from '../../types';
import AssignmentsWidget from '../widgets/AssignmentsWidget';
import ClockWidget from '../widgets/ClockWidget';
import MemoWidget from '../widgets/MemoWidget';
import TimetableWidget from '../widgets/TimetableWidget';
import WeatherWidget from '../widgets/WeatherWidget';

interface Props {
  layouts: ResponsiveLayouts<GridBreakpoint>;
  onLayoutChange: (layout: Layout, layouts: ResponsiveLayouts<GridBreakpoint>) => void;
  isEditing: boolean;
  timetable: { entries: TimetableEntry[]; source: TimetableSource };
  onOpenImport: () => void;
}

export default function Dashboard({ layouts, onLayoutChange, isEditing, timetable, onOpenImport }: Props) {
  // パディングを持たない要素の幅を計測し、containerPadding=0 でグリッドを横いっぱいに広げる
  const { width, containerRef, mounted } = useContainerWidth();

  const frame = (variant: 'default' | 'accent' = 'default') =>
    `flex min-w-0 flex-col overflow-hidden rounded-2xl border p-4 transition ${
      variant === 'accent' ? 'bg-gradient-to-br from-slate-900 to-blue-950/40' : 'bg-slate-900/90'
    } ${
      isEditing
        ? 'border-blue-500/60 ring-1 ring-blue-500/30'
        : variant === 'accent'
          ? 'border-blue-500/30'
          : 'border-slate-800'
    }`;

  return (
    <div ref={containerRef} className="w-full min-w-0">
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={layouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={90}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: isEditing, handle: '.drag-handle', cancel: 'select,button,input,textarea,label' }}
          resizeConfig={{ enabled: isEditing }}
          onLayoutChange={onLayoutChange}
        >
          <div key="clock" className={frame()}>
            <ClockWidget isEditing={isEditing} />
          </div>
          <div key="weather" className={frame()}>
            <WeatherWidget isEditing={isEditing} />
          </div>
          <div key="current-class" className={frame('accent')}>
            <TimetableWidget isEditing={isEditing} entries={timetable.entries} source={timetable.source} onOpenImport={onOpenImport} />
          </div>
          <div key="assignments" className={frame()}>
            <AssignmentsWidget isEditing={isEditing} />
          </div>
          <div key="memos" className={frame()}>
            <MemoWidget isEditing={isEditing} />
          </div>
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
