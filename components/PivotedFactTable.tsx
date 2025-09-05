import React, { useRef, useEffect, useState } from 'react';
import { Density, SortConfig } from '../types';
import { DENSITY_THEME } from '../styles/densityTheme';
import { ArrowUpIcon, ArrowDownIcon, XSmallIcon } from './icons/Icons';

interface PivotedFactTableProps {
  data: Record<string, any>[];
  headers: string[];
  density: Density;
  sortConfig: SortConfig | null;
  requestSort: (key: string) => void;
  onRemoveFactPath: (path: string) => void;
  onScrollProgress: (progress: number) => void;
  onCellClick: (value: string | number | boolean | null | object) => void;
}

const PivotedFactTable: React.FC<PivotedFactTableProps> = ({ data, headers, density, sortConfig, requestSort, onRemoveFactPath, onScrollProgress, onCellClick }) => {
  const { tableRowHeight: rowHeight, tableCellPadding: cellPadding } = DENSITY_THEME[density];
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  // Sync scrolling between the top bar and the main content
  const handleMainScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight, scrollLeft } = event.currentTarget;
    
    // Update vertical scroll progress
    const scrollableHeight = scrollHeight - clientHeight;
    if (scrollableHeight <= 0) {
      onScrollProgress(0);
    } else {
      const progress = (scrollTop / scrollableHeight) * 100;
      onScrollProgress(progress);
    }

    // Sync horizontal scroll position to the top scrollbar
    if (topScrollbarRef.current && topScrollbarRef.current.scrollLeft !== scrollLeft) {
      topScrollbarRef.current.scrollLeft = scrollLeft;
    }
  };

  const handleTopScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft } = event.currentTarget;
    if (mainContainerRef.current && mainContainerRef.current.scrollLeft !== scrollLeft) {
      mainContainerRef.current.scrollLeft = scrollLeft;
    }
  };
  
  // Reset scroll and progress when data changes
  useEffect(() => {
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTop = 0;
    }
    onScrollProgress(0);
  }, [data, onScrollProgress]);

  // Use a ResizeObserver to keep the top scrollbar sizer div in sync with the table width
  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) return;

    const observer = new ResizeObserver(entries => {
        // Using requestAnimationFrame to prevent "ResizeObserver loop limit exceeded" error in some cases
        window.requestAnimationFrame(() => {
            if (entries && entries.length > 0) {
                setTableWidth(entries[0].contentRect.width);
            }
        });
    });

    observer.observe(tableElement);

    return () => {
      observer.disconnect();
    };
  }, []); // Run only once on mount

  if (data.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-slate-500 dark:text-zinc-400">No facts found matching your search criteria.</p>
      </div>
    );
  }

  const renderSortArrow = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUpIcon /> : <ArrowDownIcon />;
  };

  const handleRemoveClick = (e: React.MouseEvent, header: string) => {
    e.stopPropagation(); // Prevent column from being sorted when 'x' is clicked
    onRemoveFactPath(header);
  };

  const firstColumnHeader = headers[0] || 'hostname';
  const otherColumnHeaders = headers.slice(1);

  return (
    <div className="h-full flex flex-col">
        {/* Top Scrollbar */}
        <div
            ref={topScrollbarRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden"
            style={{ scrollbarWidth: 'thin' }}
        >
            <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
        </div>

        {/* Main Table Container */}
        <div
            ref={mainContainerRef}
            onScroll={handleMainScroll}
            className="overflow-auto flex-1"
        >
            <table ref={tableRef} className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800 border-separate" style={{ borderSpacing: 0 }}>
                <thead className="bg-slate-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                <tr>
                    <th 
                    scope="col" 
                    onClick={() => requestSort(firstColumnHeader)} 
                    className={`sticky left-0 z-20 bg-slate-50 dark:bg-zinc-800/50 pl-4 pr-3 text-left text-sm font-semibold text-slate-600 dark:text-zinc-300 sm:pl-6 ${cellPadding} cursor-pointer min-w-[200px] border-r border-slate-200 dark:border-zinc-700 font-open-sans`}
                    >
                    <div className="flex items-center">{firstColumnHeader}<span className="ml-2">{renderSortArrow(firstColumnHeader)}</span></div>
                    </th>
                    {otherColumnHeaders.map((header) => (
                    <th 
                        key={header} 
                        scope="col" 
                        onClick={() => requestSort(header)} 
                        className={`group px-3 text-left text-sm font-semibold text-slate-600 dark:text-zinc-300 font-mono ${cellPadding} cursor-pointer min-w-[250px]`}
                    >
                        <div className="flex items-center justify-between">
                        <span className="truncate" title={header}>{header}</span>
                        <div className="flex items-center">
                            <span className="ml-2">{renderSortArrow(header)}</span>
                            <button 
                            onClick={(e) => handleRemoveClick(e, header)}
                            className="ml-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-opacity focus:opacity-100 outline-none"
                            title={`Remove column: ${header}`}
                            >
                            <XSmallIcon />
                            </button>
                        </div>
                        </div>
                    </th>
                    ))}
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {data.map((row, rowIndex) => (
                    <tr key={row.hostname || rowIndex} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors" style={{ height: `${rowHeight}px` }}>
                    <td 
                        onClick={() => onCellClick(row[firstColumnHeader])}
                        className={`sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-slate-50 dark:group-hover:bg-zinc-800/50 whitespace-nowrap overflow-hidden text-ellipsis pl-4 pr-3 text-sm font-medium text-slate-800 dark:text-zinc-100 sm:pl-6 ${cellPadding} border-r border-slate-200 dark:border-zinc-700 transition-colors font-open-sans cursor-pointer`}
                    >
                        {row[firstColumnHeader]}
                    </td>
                    {otherColumnHeaders.map(header => (
                        <td 
                        onClick={() => onCellClick(row[header])}
                        key={header} 
                        className={`whitespace-nowrap overflow-hidden text-ellipsis px-3 text-sm text-slate-500 dark:text-zinc-400 font-mono group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors ${cellPadding} cursor-pointer`}
                        >
                        {String(row[header] === undefined || row[header] === null ? '' : row[header])}
                        </td>
                    ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default PivotedFactTable;
