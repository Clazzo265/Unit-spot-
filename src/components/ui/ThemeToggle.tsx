import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#11192C] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#18233D] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#E5B93C] shrink-0" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600 shrink-0" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
