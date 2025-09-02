
import React, { useState, useMemo } from 'react';
import Button from './Button';

interface FactFilterProps {
  isVisible: boolean;
  allFactPaths: string[];
  visibleFactPaths: Set<string>;
  onVisibilityChange: (path: string, isVisible: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

const FactFilter: React.FC<FactFilterProps> = ({
  isVisible,
  allFactPaths,
  visibleFactPaths,
  onVisibilityChange,
  onSelectAll,
  onSelectNone
}) => {
  const [filterTerm, setFilterTerm] = useState('');

  const filteredPaths = useMemo(() => {
    if (!filterTerm) return allFactPaths;
    const lowercasedFilter = filterTerm.toLowerCase();
    return allFactPaths.filter(path => path.toLowerCase().includes(lowercasedFilter));
  }, [allFactPaths, filterTerm]);

  return (
    <div
      className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${
        isVisible ? 'max-h-96' : 'max-h-0'
      }`}
    >
      <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200/90 dark:border-zinc-800/90">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400 dark:text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </div>
            <input
              type="text"
              placeholder="Filter facts..."
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="block w-full sm:w-80 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md pl-10 pr-4 py-1.5 text-sm focus:ring-1 focus:ring-violet-500 focus:border-violet-500 dark:focus:ring-violet-400 dark:focus:border-violet-400 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={onSelectAll} variant="secondary" density="compact" className="text-xs">
              Select All
            </Button>
            <Button onClick={onSelectNone} variant="secondary" density="compact" className="text-xs">
              Select None
            </Button>
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
            {filteredPaths.map(path => (
              <label key={path} className="flex items-center space-x-2 cursor-pointer truncate">
                <input
                  type="checkbox"
                  checked={visibleFactPaths.has(path)}
                  onChange={(e) => onVisibilityChange(path, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-zinc-600 text-violet-600 focus:ring-violet-500 bg-white dark:bg-zinc-900 dark:checked:bg-violet-500"
                />
                <span className="text-sm text-slate-700 dark:text-zinc-300 font-mono truncate" title={path}>{path}</span>
              </label>
            ))}
          </div>
           {filteredPaths.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-zinc-400 text-center col-span-full py-4">No facts match your filter.</p>
           )}
        </div>
      </div>
    </div>
  );
};

export default FactFilter;
