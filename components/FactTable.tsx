import React, { useState, useRef, useMemo, useEffect } from 'react';
import { FactRow, Density, SortConfig, SortableKey } from '../types';
import { DENSITY_THEME } from '../styles/densityTheme';
import { ArrowUpIcon, ArrowDownIcon } from './icons/Icons';

interface FactTableProps {
  facts: FactRow[];
  density: Density;
  showModifiedColumn: boolean;
  sortConfig: SortConfig | null;
  requestSort: (key: SortableKey) => void;
  onScrollProgress: (progress: number) => void;
  onCellClick: (value: string | number | boolean | null | object) => void;
}

const OVERSCAN = 5; // Number of rows to render above and below the visible area

const formatDate = (isoString?: string): string => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    // Format to 'YYYY-MM-DD HH:mm'
    return date.toISOString().slice(0, 16).replace('T', ' ');
  } catch (e) {
    return 'Invalid Date';
  }
};

const FactTable: React.FC<FactTableProps> = ({ facts, density, showModifiedColumn, sortConfig, requestSort, onScrollProgress, onCellClick }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { tableRowHeight: rowHeight, tableCellPadding: cellPadding } = DENSITY_THEME[density];

  // Reset scroll position when the user filters the facts
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setScrollTop(0);
    onScrollProgress(0); // Also reset progress
  }, [facts, onScrollProgress]);
  
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    setScrollTop(scrollTop);

    const scrollableHeight = scrollHeight - clientHeight;

    if (scrollableHeight <= 0) {
      onScrollProgress(0);
      return;
    }

    const progress = Math.min(100, (scrollTop / scrollableHeight) * 100);
    onScrollProgress(progress);
  };

  const { virtualRows, paddingTop, paddingBottom } = useMemo(() => {
    const totalRows = facts.length;
    // Estimate container height, or use a default if the ref isn't ready.
    const containerHeight = scrollContainerRef.current?.clientHeight || window.innerHeight * 0.6;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const endIndex = Math.min(
      totalRows - 1,
      Math.floor((scrollTop + containerHeight) / rowHeight) + OVERSCAN
    );

    const rows = facts.slice(startIndex, endIndex + 1);
    
    const top = startIndex * rowHeight;
    const bottom = (totalRows - (endIndex + 1)) * rowHeight;

    return { virtualRows: rows, paddingTop: top, paddingBottom: bottom };
  }, [facts, scrollTop, rowHeight]);

  if (facts.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-slate-500 dark:text-zinc-400">No facts found matching your search criteria.</p>
      </div>
    );
  }

  const renderSortArrow = (columnKey: SortableKey) => {
    if (sortConfig?.key !== columnKey) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUpIcon /> : <ArrowDownIcon />;
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="overflow-auto h-full"
    >
      <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800" style={{ tableLayout: 'fixed' }}>
        <thead className="bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10">
          <tr>
            <th scope="col" onClick={() => requestSort('host')} className={`pl-4 pr-3 text-left text-sm font-semibold text-slate-600 dark:text-zinc-300 sm:pl-6 ${cellPadding} ${showModifiedColumn ? 'w-[20%]' : 'w-[25%]'} cursor-pointer font-open-sans`}>
              <div className="flex items-center">Host<span className="ml-2">{renderSortArrow('host')}</span></div>
            </th>
            <th scope="col" onClick={() => requestSort('factPath')} className={`px-3 text-left text-sm font-semibold text-slate-600 dark:text-zinc-300 font-mono ${cellPadding} ${showModifiedColumn ? 'w-[35%]' : 'w-[40%]'} cursor-pointer`}>
              <div className="flex items-center">Fact Path<span className="ml-2">{renderSortArrow('factPath')}</span></div>
            </th>
            <th scope="col" onClick={() => requestSort('value')} className={`px-3 text-left text-sm font-semibold text-slate-600 dark:text-zinc-300 ${cellPadding} ${showModifiedColumn ? 'w-[30%]' : 'w-[35%]'} cursor-pointer`}>
              <div className="flex items-center">Value<span className="ml-2">{renderSortArrow('value')}</span></div>
            </th>
            {showModifiedColumn && (
              <th scope="col" onClick={() => requestSort('modified')} className={`px-3 text-left text-sm font-semibold text-slate-600 dark:text-zinc-300 w-[15%] ${cellPadding} cursor-pointer`}>
                  <div className="flex items-center">Modified<span className="ml-2">{renderSortArrow('modified')}</span></div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          {paddingTop > 0 && <tr style={{ height: `${paddingTop}px` }} />}
          {virtualRows.map((fact) => (
            <tr key={fact.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors" style={{ height: `${rowHeight}px` }}>
              <td onClick={() => onCellClick(fact.host)} className={`whitespace-nowrap overflow-hidden text-ellipsis pl-4 pr-3 text-sm font-medium text-slate-800 dark:text-zinc-100 sm:pl-6 ${cellPadding} font-open-sans cursor-pointer`}>{fact.host}</td>
              <td onClick={() => onCellClick(fact.factPath)} className={`whitespace-nowrap overflow-hidden text-ellipsis px-3 text-sm text-slate-500 dark:text-zinc-400 font-mono group-hover:text-slate-800 dark:group-hover:text-zinc-200 transition-colors ${cellPadding} cursor-pointer`}>{fact.factPath}</td>
              <td onClick={() => onCellClick(fact.value)} className={`whitespace-normal px-3 text-sm text-violet-600 dark:text-violet-400 font-mono break-all drop-shadow-[0_0_4px_rgba(167,139,250,0.3)] dark:drop-shadow-[0_0_6px_rgba(167,139,250,0.25)] ${cellPadding} cursor-pointer`}>{String(fact.value)}</td>
              {showModifiedColumn && (
                <td className={`whitespace-nowrap px-3 text-sm text-slate-500 dark:text-zinc-400 ${cellPadding}`}>
                  {formatDate(fact.modified)}
                </td>
              )}
            </tr>
          ))}
          {paddingBottom > 0 && <tr style={{ height: `${paddingBottom}px` }} />}
        </tbody>
      </table>
    </div>
  );
};

export default FactTable;