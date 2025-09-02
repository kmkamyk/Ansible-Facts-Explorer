
import React from 'react';
import { ListIcon, ColumnsIcon } from './icons/Icons';

export type ViewMode = 'list' | 'pivot';

interface ViewSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ viewMode, onViewModeChange, className = '' }) => {
  return (
    <div className={`flex items-center bg-slate-200 dark:bg-zinc-800 rounded-full p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onViewModeChange('list')}
        className={`p-1.5 rounded-full transition-colors duration-200 ${
          viewMode === 'list'
            ? 'bg-slate-100 dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm'
            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100'
        }`}
        aria-pressed={viewMode === 'list'}
        title="List View"
      >
        <ListIcon />
        <span className="sr-only">List View</span>
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('pivot')}
        className={`p-1.5 rounded-full transition-colors duration-200 ${
          viewMode === 'pivot'
            ? 'bg-slate-100 dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm'
            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100'
        }`}
        aria-pressed={viewMode === 'pivot'}
        title="Pivot View"
      >
        <ColumnsIcon />
        <span className="sr-only">Pivot View</span>
      </button>
    </div>
  );
};

export default ViewSwitcher;
