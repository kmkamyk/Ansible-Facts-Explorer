import React, { useRef, useState, useEffect, useCallback } from 'react';
import { QuestionMarkCircleIcon, FilterIcon, ClockIcon, XSmallIcon, ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';
import Spinner from './Spinner';

interface SearchBarProps {
  searchPills: string[];
  setSearchPills: (pills: string[] | ((prevState: string[]) => string[])) => void;
  searchInputValue: string;
  setSearchInputValue: (value: string) => void;
  onFilterClick: () => void;
  isFilterActive: boolean;
  isFilterDisabled: boolean;
  visibleFactCount: number;
  totalFactCount: number;
  allFactPaths: string[];
  showModifiedColumn: boolean;
  onToggleModifiedColumn: () => void;
  onAiSearch: (prompt: string, onSuccess: () => void) => void;
  isAiLoading: boolean;
  isAiEnabled: boolean;
}

const HighlightMatch: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight) return <>{text}</>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <strong key={i} className="font-bold">{part}</strong>
                ) : (
                    part
                )
            )}
        </span>
    );
};

const SearchModeButton: React.FC<{ onClick: () => void, isLoading: boolean, isAiMode: boolean }> = ({ onClick, isLoading, isAiMode }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className={`flex-shrink-0 h-9 w-20 flex items-center justify-center rounded-l-full border-r border-slate-300 dark:border-zinc-700 relative overflow-hidden group disabled:cursor-wait transition-colors ${
            isAiMode ? 'bg-violet-200 dark:bg-violet-900/60' : 'bg-slate-200 dark:bg-zinc-800'
        }`}
        title={isAiMode ? "Switch to Classic Search" : "Switch to AI Search"}
    >
        <span className={`font-semibold transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} ${
            isAiMode 
                ? 'text-sm text-slate-700 dark:text-zinc-200' 
                : 'bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-500 dark:to-fuchsia-400'
        }`}>
            {isAiMode ? 'Classic' : 'AI'}
        </span>
        {isLoading && (
            <div className={`absolute inset-0 flex items-center justify-center ${isAiMode ? 'bg-violet-200 dark:bg-violet-900/60' : 'bg-slate-200 dark:bg-zinc-800'}`}>
                <Spinner className="w-5 h-5" />
            </div>
        )}
    </button>
);

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
  allFactPaths,
  showModifiedColumn,
  onToggleModifiedColumn,
  onAiSearch,
  isAiLoading,
  isAiEnabled,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const handleRemovePill = (pillToRemove: string) => {
    setSearchPills(pills => pills.filter(pill => pill !== pillToRemove));
  };
  
  const handleToggleAiMode = () => {
    setIsAiMode(prev => !prev);
    setSearchInputValue(''); // Clear input on mode switch
  };

  useEffect(() => {
    if (isAiMode) {
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  }, [isAiMode]);
  
  useEffect(() => {
    if (searchInputValue && !isAiMode) {
        const lowercasedInput = searchInputValue.toLowerCase();
        
        const startsWith: string[] = [];
        const includes: string[] = [];

        for (const path of allFactPaths) {
            const lowercasedPath = path.toLowerCase();
            if (lowercasedPath.startsWith(lowercasedInput)) {
                startsWith.push(path);
            } else if (lowercasedPath.includes(lowercasedInput)) {
                includes.push(path);
            }
        }
        
        const filtered = [...startsWith.sort(), ...includes.sort()];
        setSuggestions(filtered);
        setShowSuggestions(true);
        setActiveSuggestionIndex(-1); // Reset active index on new input
    } else {
        setShowSuggestions(false);
    }
  }, [searchInputValue, allFactPaths, isAiMode]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    const newPill = suggestion.trim();
    if (newPill) {
      setSearchPills(prevPills => [...new Set([...prevPills, newPill])]);
    }
    setSearchInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
          return;
      }
      if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          return;
      }
      if (event.key === 'Enter' && activeSuggestionIndex > -1) {
          event.preventDefault();
          handleSuggestionClick(suggestions[activeSuggestionIndex]);
          return;
      }
       if (event.key === 'Escape') {
          setShowSuggestions(false);
          return;
      }
    }
    
    if (event.key === 'Enter' && searchInputValue.trim() !== '') {
        event.preventDefault();
        if (isAiMode) {
            onAiSearch(searchInputValue.trim(), () => {
                // After a successful AI search, remain in AI mode for subsequent queries.
            });
        } else {
            setSearchPills(prev => [...new Set([...prev, searchInputValue.trim()])]);
            setSearchInputValue('');
        }
    } else if (!isAiMode && event.key === 'Backspace' && searchInputValue === '' && searchPills.length > 0) {
      setSearchPills(pills => pills.slice(0, -1));
      event.preventDefault();
    } else if (isAiMode && event.key === 'Escape') {
      setIsAiMode(false);
      setSearchInputValue('');
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
    <div className="w-full relative" ref={searchWrapperRef}>
      <div
        className={`flex items-center w-full rounded-full h-9 focus-within:ring-2 focus-within:ring-violet-500/70 dark:focus-within:ring-violet-400/70 transition-all duration-200 pr-2 ${
            isAiMode 
            ? 'bg-violet-100 dark:bg-violet-950/40' 
            : 'bg-slate-200 dark:bg-zinc-800'
        }`}
      >
        {isAiEnabled && <SearchModeButton onClick={handleToggleAiMode} isLoading={isAiLoading} isAiMode={isAiMode} />}

        <svg className={`h-5 w-5 text-slate-500 dark:text-zinc-400 flex-shrink-0 ${isAiEnabled ? 'ml-3' : 'ml-4'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
            ref={inputRef}
            type="text"
            placeholder={isAiMode ? "Ask AI to find facts... (e.g., 'all ubuntu hosts with 4 cpus')" : (searchPills.length === 0 ? "Search facts..." : "Add filter...")}
            value={searchInputValue}
            onChange={(e) => setSearchInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`flex-grow bg-transparent text-sm placeholder-slate-500 dark:placeholder-zinc-400 text-slate-900 dark:text-zinc-100 focus:outline-none min-w-[100px] py-1 pl-2`}
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
                      <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">host=demo-db-1.example.com</code></li>
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

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1.5 w-full z-40 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <ul role="listbox">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion} role="option" aria-selected={index === activeSuggestionIndex}>
                <button
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full text-left px-3 py-2 text-sm font-mono truncate transition-colors ${
                    index === activeSuggestionIndex 
                      ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' 
                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <HighlightMatch text={suggestion} highlight={searchInputValue} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchBar;