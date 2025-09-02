
import React from 'react';
import { Density } from '../types';
import { DENSITY_THEME } from '../styles/densityTheme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary';
  shape?: 'default' | 'pill';
  className?: string;
  density?: Density;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', shape = 'default', className = '', density = 'spacious', ...props }) => {
  const shapeClasses = shape === 'pill' ? 'rounded-full' : 'rounded-md';
  const shadowClass = variant === 'tertiary' ? '' : 'shadow-sm';

  const baseClasses = `${shapeClasses} ${shadowClass} font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-zinc-950 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`;
  
  const variantClasses = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500 dark:bg-violet-500 dark:hover:bg-violet-600 dark:focus:ring-violet-400',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-violet-500 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700 dark:focus:ring-violet-400',
    tertiary: 'bg-slate-200 text-slate-700 hover:bg-slate-300 focus:ring-violet-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus:ring-violet-400'
  };

  const densityClasses = DENSITY_THEME[density].button;

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${densityClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;