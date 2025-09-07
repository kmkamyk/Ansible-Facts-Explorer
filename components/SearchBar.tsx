import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QuestionMarkCircleIcon, FilterIcon, ClockIcon, XSmallIcon, ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';

interface SearchBarProps {
  searchPills: string[];
  setSearchPills: (pills: string[]) => void;
  searchInputValue: string;
  setSearchInputValue: (value: string) => void;
  onFilterClick: () => void;
  isFilterActive: boolean;
  isFilterDisabled: boolean;
  visibleFactCount: number;
  totalFactCount: number;
  showModifiedColumn: boolean;
  onToggleModifiedColumn: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchPills,
  setSearchPills,
  searchInputValue,
  setSearchInputValue,
  onFilterClick,
  isFilterActive,
  isFilterDisabled,
  visibleFactCount,
  totalFactCount,
  showModifiedColumn,
  onToggleModifiedColumn,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const handleRemovePill = (pillToRemove: string) => {
    setSearchPills(searchPills.filter(pill => pill !== pillToRemove));
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && searchInputValue.trim() !== '') {
      // Add new pill, avoiding duplicates
      setSearchPills([...new Set([...searchPills, searchInputValue.trim()])]);
      setSearchInputValue('');
      event.preventDefault();
    } else if (event.key === 'Backspace' && searchInputValue === '' && searchPills.length > 0) {
      // Remove the last pill if backspace is pressed in an empty input
      setSearchPills(searchPills.slice(0, -1));
      event.preventDefault();
    }
  };

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const hasOverflow = el.scrollWidth > el.clientWidth;
      setCanScrollLeft(hasOverflow && el.scrollLeft > 5); // Add a small buffer
      // Use a small tolerance for floating point inaccuracies
      setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    } else {
        setCanScrollLeft(false);
        setCanScrollRight(false);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    // Check on resize and DOM mutations
    const observer = new ResizeObserver(checkScrollability);
    observer.observe(el);
    
    // Initial check and check when pills change
    const timer = setTimeout(checkScrollability, 50);

    return () => {
        observer.disconnect();
        clearTimeout(timer);
    };
  }, [searchPills, checkScrollability]);

  // Automatically scroll to the end when a new pill is added
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      // Use a timeout to ensure the DOM has fully updated after the state change
      // and the new pill is rendered, giving us the correct scrollWidth.
      setTimeout(() => {
        el.scrollTo({
          left: el.scrollWidth,
          behavior: 'smooth',
        });
      }, 50); 
    }
  }, [searchPills]);


  const handleScroll = (direction: 'left' | 'right') => {
      const el = scrollContainerRef.current;
      if (el) {
          const scrollAmount = direction === 'left' ? -200 : 200;
          el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
  };


  // Quick check to see if a pill is valid regex to avoid console errors.
  const isRegexValid = (pill: string): boolean => {
    try {
      new RegExp(pill);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-9 pl-3 pr-2 focus-within:ring-2 focus-within:ring-violet-500/70 dark:focus-within:ring-violet-400/70 transition-shadow duration-200`}
      >
        <svg className="h-5 w-5 text-slate-500 dark:text-zinc-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>

        <div className="flex items-center gap-2 flex-shrink min-w-0">
          {canScrollLeft && (
              <button
                  type="button"
                  onClick={() => handleScroll('left')}
                  className="flex-shrink-0 p-0.5 rounded-full bg-slate-300/50 hover:bg-slate-400/50 dark:bg-zinc-700/50 dark:hover:bg-zinc-600/50 text-slate-700 dark:text-zinc-200 transition-colors"
                  aria-label="Scroll left"
              >
                  <ChevronLeftIcon />
              </button>
          )}

          <div 
              ref={scrollContainerRef}
              onScroll={checkScrollability}
              className="flex items-center gap-2 overflow-x-auto min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
              {searchPills.map(pill => (
              <span
                  key={pill}
                  className={`flex-shrink-0 flex items-center gap-1.5 py-0.5 pl-2.5 pr-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  !isRegexValid(pill) 
                      ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300 ring-1 ring-red-500/30'
                      : 'bg-slate-300 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200'
                  }`}
              >
                  {pill}
                  <button
                  type="button"
                  onClick={() => handleRemovePill(pill)}
                  className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 focus:outline-none focus:bg-black/20 dark:focus:bg-white/30 transition-colors"
                  aria-label={`Remove filter: ${pill}`}
                  >
                  <XSmallIcon />
                  </button>
              </span>
              ))}
          </div>

          {canScrollRight && (
              <button
                  type="button"
                  onClick={() => handleScroll('right')}
                  className="flex-shrink-0 p-0.5 rounded-full bg-slate-300/50 hover:bg-slate-400/50 dark:bg-zinc-700/50 dark:hover:bg-zinc-600/50 text-slate-700 dark:text-zinc-200 transition-colors"
                  aria-label="Scroll right"
              >
                  <ChevronRightIcon />
              </button>
          )}
        </div>

        <input
            type="text"
            placeholder={searchPills.length === 0 ? "Search facts..." : "Add filter..."}
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow bg-transparent text-sm placeholder-slate-500 dark:placeholder-zinc-400 text-slate-900 dark:text-zinc-100 focus:outline-none min-w-[100px] py-1"
        />

        <div className="flex items-center gap-1.5 pl-1 flex-shrink-0">
          <button
            type="button"
            onClick={onFilterClick}
            disabled={isFilterDisabled}
            title="Filter visible facts"
            className={`flex-shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-200 dark:focus:ring-offset-zinc-800 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              isFilterActive
                ? 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-600/80'
                : 'bg-slate-300/70 dark:bg-zinc-700/70 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700'
            }`}
          >
            <FilterIcon />
            <span className="hidden sm:inline">Facts</span>
            {totalFactCount > 0 && (
              <span className="text-xs bg-slate-400/50 dark:bg-zinc-600/50 rounded-full px-1.5 py-0.5">
                {visibleFactCount}/{totalFactCount}
              </span>
            )}
          </button>

          <button
              type="button"
              onClick={onToggleModifiedColumn}
              title="Toggle modified date column"
              className={`flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-200 dark:focus:ring-offset-zinc-800 focus:ring-violet-500 ${
                showModifiedColumn
                  ? 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300'
                  : 'bg-slate-300/70 dark:bg-zinc-700/70 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700'
              }`}
          >
              <ClockIcon />
          </button>

          <div className="relative group flex items-center">
              <button type="button" className="text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors focus:outline-none" aria-label="Show search syntax help">
                  <QuestionMarkCircleIcon />
              </button>
              <div
                className="absolute top-full mt-2 right-1/2 translate-x-1/2 w-80 p-3 bg-slate-800 dark:bg-zinc-950 text-white text-xs rounded-lg shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 transition-all duration-200 pointer-events-none z-50 origin-top"
                role="tooltip"
              >
                  Type to filter results instantly. Press <strong>Enter</strong> to create a persistent filter pill. Results must match <strong>all</strong> active filters.
                  <br/><br/>
                  <strong className="font-semibold">Examples:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-left">
                      <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">vcpus{'>'}4</code> (key-value filter)</li>
                      <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">distribution=Ubuntu</code></li>
                      <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">"22.04"</code> (exact match)</li>
                      <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">web-</code> (regex search)</li>
                      <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">"kernel"|"system"</code> (OR search)</li>
                  </ul>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-slate-800 dark:border-b-zinc-950"></div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;