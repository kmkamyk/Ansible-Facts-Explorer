import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Density, SortConfig } from '../types';
import { DENSITY_THEME } from '../styles/densityTheme';
import { ArrowUpIcon, ArrowDownIcon, XSmallIcon, ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';

// --- Custom Horizontal Scrollbar Component (defined within the same file as requested) ---

interface CustomHorizontalScrollbarProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const CustomHorizontalScrollbar: React.FC<CustomHorizontalScrollbarProps> = ({ scrollContainerRef }) => {
  const [thumbWidth, setThumbWidth] = useState(0);
  const [thumbPosition, setThumbPosition] = useState(0);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollDataRef = useRef({
    initialScrollLeft: 0,
    initialMouseX: 0,
  });

  const updateScrollbar = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      // Check for overflow with a small tolerance for sub-pixel rendering issues
      const hasOverflow = scrollWidth > clientWidth + 1;
      setIsOverflowing(hasOverflow);

      if (hasOverflow) {
        const trackWidth = trackRef.current?.clientWidth || clientWidth;
        const newThumbWidth = Math.max(20, (clientWidth / scrollWidth) * trackWidth); // Minimum thumb width
        const scrollableWidth = scrollWidth - clientWidth;
        const availableTrackSpace = trackWidth - newThumbWidth;
        const newThumbPosition = scrollableWidth > 0 ? (scrollLeft / scrollableWidth) * availableTrackSpace : 0;
        
        setThumbWidth(newThumbWidth);
        setThumbPosition(newThumbPosition);
      }
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Use ResizeObserver for the container and MutationObserver for the table itself for robustness
    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(el);

    const table = el.querySelector('table');
    const mutationObserver = new MutationObserver(updateScrollbar);
    if (table) {
        mutationObserver.observe(table, { childList: true, subtree: true, attributes: true });
    }

    el.addEventListener('scroll', updateScrollbar, { passive: true });
    window.addEventListener('resize', updateScrollbar);
    
    // Initial check after a short delay to allow for rendering
    const timer = setTimeout(updateScrollbar, 100);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (el) {
        el.removeEventListener('scroll', updateScrollbar);
      }
      window.removeEventListener('resize', updateScrollbar);
    };
  }, [scrollContainerRef, updateScrollbar]);
  
  const handleThumbMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    scrollDataRef.current = {
      initialScrollLeft: el.scrollLeft,
      initialMouseX: e.clientX,
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [scrollContainerRef]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current || !trackRef.current) return;
    
    const { initialScrollLeft, initialMouseX } = scrollDataRef.current;
    const dx = e.clientX - initialMouseX;
    
    const { scrollWidth, clientWidth } = scrollContainerRef.current;
    const trackWidth = trackRef.current.clientWidth;
    // Recalculate thumbWidth based on current state, not from closure
    const currentThumbWidth = Math.max(20, (clientWidth / scrollWidth) * trackWidth);
    const scrollableWidth = scrollWidth - clientWidth;
    const availableTrackSpace = trackWidth - currentThumbWidth;

    if (scrollableWidth <= 0 || availableTrackSpace <= 0) return;

    const scrollRatio = scrollableWidth / availableTrackSpace;
    
    scrollContainerRef.current.scrollLeft = initialScrollLeft + dx * scrollRatio;
  }, [isDragging, scrollContainerRef]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleScrollButtonClick = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!isOverflowing) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 py-1 bg-slate-50 dark:bg-zinc-900/70 border-t border-slate-200 dark:border-zinc-800 flex-shrink-0">
        <button 
            onClick={() => handleScrollButtonClick('left')} 
            className="p-1 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Scroll left"
        >
            <ChevronLeftIcon />
        </button>
        <div ref={trackRef} className="flex-1 h-3 bg-slate-200 dark:bg-zinc-800 rounded-full relative cursor-pointer">
            <div
                onMouseDown={handleThumbMouseDown}
                className={`absolute h-3 rounded-full transition-colors top-0 ${isDragging ? 'bg-violet-600 dark:bg-violet-500' : 'bg-slate-400 dark:bg-zinc-600 hover:bg-slate-500 dark:hover:bg-zinc-500'}`}
                style={{ width: `${thumbWidth}px`, left: `${thumbPosition}px`, cursor: isDragging ? 'grabbing' : 'grab' }}
            />
        </div>
        <button 
            onClick={() => handleScrollButtonClick('right')} 
            className="p-1 rounded-full text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Scroll right"
        >
            <ChevronRightIcon />
        </button>
    </div>
  );
};


// --- Main PivotedFactTable Component ---

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleVerticalScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const scrollableHeight = scrollHeight - clientHeight;
    
    if (scrollableHeight <= 0) {
      onScrollProgress(0);
      return;
    }
    const progress = (scrollTop / scrollableHeight) * 100;
    onScrollProgress(progress);
  };

  // Reset scroll and progress when data changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollContainerRef.current.scrollLeft = 0;
    }
    onScrollProgress(0);
  }, [data, onScrollProgress]);

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
        <div
          ref={scrollContainerRef}
          onScroll={handleVerticalScroll}
          className="overflow-auto flex-1"
        >
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800 border-separate" style={{ borderSpacing: 0 }}>
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
        <CustomHorizontalScrollbar scrollContainerRef={scrollContainerRef} />
    </div>
  );
};

export default PivotedFactTable;
