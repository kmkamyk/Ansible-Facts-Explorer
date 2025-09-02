import React from 'react';
import { Density } from '../types';
import { DENSITY_THEME } from '../styles/densityTheme';
import { QuestionMarkCircleIcon, XCircleIcon } from './icons/Icons';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isRegexValid: boolean;
  density?: Density;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, setSearchTerm, isRegexValid, density = 'spacious' }) => {
  const densityClasses = DENSITY_THEME[density].input;
  
  const baseInputClasses = `block w-full bg-slate-200 dark:bg-zinc-800 rounded-full pl-10 pr-16 text-sm placeholder-slate-500 dark:placeholder-zinc-400 text-slate-900 dark:text-zinc-100 focus:outline-none transition-shadow duration-200`;
  const validationClasses = !isRegexValid && searchTerm
    ? "ring-2 ring-red-500/70"
    : "focus:ring-2 focus:ring-violet-500/70 dark:focus:ring-violet-400/70";
    
  return (
    <div className="w-full max-w-lg">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-slate-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search facts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`${baseInputClasses} ${densityClasses} ${validationClasses}`}
          aria-invalid={!isRegexValid && searchTerm ? 'true' : 'false'}
          aria-describedby="regex-error"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
            {searchTerm && (
                <button 
                    type="button" 
                    onClick={() => setSearchTerm('')} 
                    className="text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors focus:outline-none" 
                    aria-label="Clear search"
                >
                    <XCircleIcon />
                </button>
            )}
            <div className="relative group flex items-center">
                <button type="button" className="text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors focus:outline-none" aria-label="Show search syntax help">
                    <QuestionMarkCircleIcon />
                </button>
                <div 
                  className="absolute top-full mt-2 right-1/2 translate-x-1/2 w-72 p-3 bg-slate-800 dark:bg-zinc-950 text-white text-xs rounded-lg shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 transition-all duration-200 pointer-events-none z-50 origin-top"
                  role="tooltip"
                >
                    Supports "exact", regex, and key-value filters.
                    <br/><br/>
                    <strong className="font-semibold">Examples:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-left">
                        <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">vcpus{'>'}4</code></li>
                        <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">distribution=Ubuntu</code></li>
                        <li><code className="bg-slate-700 dark:bg-zinc-800 text-violet-400 font-medium px-1 rounded-sm">"22.04"</code> (exact match)</li>
                    </ul>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-slate-800 dark:border-b-zinc-950"></div>
                </div>
            </div>
        </div>
      </div>
      {(!isRegexValid && searchTerm) && (
        <p id="regex-error" className="mt-1 text-xs text-red-500 dark:text-red-400" role="alert">
          Invalid regular expression.
        </p>
      )}
    </div>
  );
};

export default SearchBar;