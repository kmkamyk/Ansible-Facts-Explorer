
import React from 'react';
import { SunIcon, MoonIcon } from './icons/Icons';

type Theme = 'light' | 'dark';

interface ThemeSwitcherProps {
  theme: Theme;
  onToggleTheme: () => void;
  className?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, onToggleTheme, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onToggleTheme}
      className={`flex items-center justify-center p-2 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors duration-200 ${className}`}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

export default ThemeSwitcher;
