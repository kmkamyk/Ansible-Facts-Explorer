import React, { useState } from 'react';
import { ClockIcon, FilterIcon, XSmallIcon, SparklesIcon } from './icons/Icons';
import Spinner from './Spinner';
import { Pill } from '../types';

interface SearchBarProps {
  searchPills: Pill[];
  setSearchPills: (pills: Pill[]) => void;
  searchInputValue: string;
  setSearchInputValue: (value: string) => void;
  onFilterClick: () => void;
  isFilterActive: boolean;
  isFilterDisabled: boolean;
  visibleFactCount: number;
  totalFactCount: number;
  showModifiedColumn: boolean;
  onToggleModifiedColumn: () => void;
  onAiSearch: (prompt: string) => void;
  isAiLoading: boolean;
  isAiEnabled: boolean;
  isAiSearchActive: boolean;
  setIsAiSearchActive: (isActive: boolean) => void;
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
  onAiSearch,
  isAiLoading,
  isAiEnabled,
  isAiSearchActive,
  setIsAiSearchActive
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const handleRemovePill = (idToRemove: string) => {
    setSearchPills(searchPills.filter(p => p.id !== idToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Add pill on Enter
    if (e.key === 'Enter' && searchInputValue.trim()) {
      e.preventDefault();
      if (isAiSearchActive) {
          onAiSearch(searchInputValue.trim());
      } else {
          const newPillValue = searchInputValue.trim();
          if (!searchPills.some(p => p.value === newPillValue)) {
            const newPill: Pill = { id: `${Date.now()}-${newPillValue}`, value: newPillValue, source: 'user' };
            setSearchPills([...searchPills, newPill]);
          }
      }
      setSearchInputValue('');
    }
    // Remove last pill on Backspace if input is empty
    else if (e.key === 'Backspace' && searchInputValue === '' && searchPills.length > 0) {
      handleRemovePill(searchPills[searchPills.length - 1].id);
    }
  };
  
  const searchBarContainerClasses = `
    flex flex-wrap items-center gap-2 p-1.5 pl-3 border rounded-lg transition-all duration-200
    focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-50 dark:focus-within:ring-offset-zinc-950 focus-within:ring-violet-500/80 dark:focus-within:ring-violet-400/80
    ${isAiSearchActive 
      ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-500/50' 
      : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700'
    }
  `;

  return (
    <div>
      <div className={searchBarContainerClasses}>
        <svg className="h-5 w-5 text-slate-400 dark:text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>

        {searchPills.map((pill) => (
          <span key={pill.id} className={`
            flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-medium animate-[fadeIn_0.2s_ease-in-out]
            ${pill.source === 'ai' 
              ? 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300 ring-1 ring-inset ring-fuchsia-200 dark:ring-fuchsia-500/30' 
              : 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200'
            }
          `}>
            {pill.source === 'ai' && <SparklesIcon className="h-4 w-4 text-fuchsia-500 dark:text-fuchsia-400" />}
            <span className="truncate max-w-xs">{pill.value}</span>
            <button
              onClick={() => handleRemovePill(pill.id)}
              className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-black/50"
              aria-label={`Remove filter: ${pill.value}`}
            >
              <XSmallIcon />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={searchInputValue}
          onChange={(e) => setSearchInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowHelp(true)}
          onBlur={() => setShowHelp(false)}
          placeholder={isAiSearchActive ? 'Describe the hosts you want to find...' : 'Search facts, use key=value, or ask AI...'}
          className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 py-1"
        />

        <div className="flex items-center gap-1.5 ml-auto">
            {isAiLoading && <Spinner className="w-5 h-5" />}
             <button 
                type="button" 
                onClick={() => setIsAiSearchActive(!isAiSearchActive)}
                disabled={!isAiEnabled}
                title={isAiEnabled ? (isAiSearchActive ? 'Disable AI Search' : 'Enable AI Search') : 'AI search is disabled on the backend'}
                className={`
                    px-2 py-1 rounded-md text-sm font-semibold transition-all duration-200 flex items-center gap-1.5
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isAiSearchActive
                        ? 'bg-violet-600 text-white shadow-sm hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                    }
                `}
            >
                <SparklesIcon className={`h-4 w-4 ${isAiSearchActive ? 'text-violet-200' : ''}`} />
                AI
            </button>
          <button 
            type="button"
            onClick={onToggleModifiedColumn}
            title={showModifiedColumn ? "Hide 'Modified' column" : "Show 'Modified' column"}
            className={`p-1.5 rounded-md transition-colors ${showModifiedColumn ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
          >
            <ClockIcon />
          </button>
           <button
                type="button"
                onClick={onFilterClick}
                disabled={isFilterDisabled}
                title="Filter visible facts"
                className={`p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative ${
                    isFilterActive
                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400'
                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
            >
                <FilterIcon />
                {!isFilterDisabled && totalFactCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-white bg-violet-500 rounded-full text-[10px] h-4 w-4 flex items-center justify-center font-bold">
                        {Math.round((visibleFactCount / totalFactCount) * 10)}
                    </span>
                )}
            </button>
        </div>
      </div>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showHelp && !isAiSearchActive ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
         <p className="text-xs text-slate-500 dark:text-zinc-400 pt-2">
            <b>Tip:</b> Use <code>key=value</code>, <code>key&gt;5</code>, or wrap text in <code>""</code> for exact matches. Use <code>|</code> for OR.
          </p>
      </div>
    </div>
  );
};

export default SearchBar;
