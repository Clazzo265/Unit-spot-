import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#131D33] border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-600 dark:text-cyan-400" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="min-h-[44px] bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
