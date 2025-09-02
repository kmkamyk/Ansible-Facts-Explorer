
import React from 'react';
import { Density } from '../types';

interface DensitySwitcherProps {
  density: Density;
  onDensityChange: (density: Density) => void;
  className?: string;
}

const DensityIcon: React.FC<{ density: Density }> = ({ density }) => {
  const yPositions = {
    compact: [4, 9, 14],
    comfortable: [3, 9, 15],
    spacious: [2, 9, 16],
  };

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="3" y={yPositions[density][0]} width="14" height="1.5" rx="0.75" />
      <rect x="3" y={yPositions[density][1]} width="14" height="1.5" rx="0.75" />
      <rect x="3" y={yPositions[density][2]} width="14" height="1.5" rx="0.75" />
    </svg>
  );
};

const DensitySwitcher: React.FC<DensitySwitcherProps> = ({ density, onDensityChange, className = '' }) => {
  const options: { value: Density; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
  ];

  return (
    <div className={`flex items-center bg-slate-200 dark:bg-zinc-800 rounded-full p-0.5 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onDensityChange(option.value)}
          className={`p-1.5 rounded-full transition-colors duration-200 ${
            density === option.value
              ? 'bg-slate-100 dark:bg-zinc-900 text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100'
          }`}
          aria-pressed={density === option.value}
          title={option.label}
        >
          <DensityIcon density={option.value} />
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DensitySwitcher;
