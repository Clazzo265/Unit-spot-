import React from 'react';

export const ViewSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-72 rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
        </div>
        <div className="h-11 w-36 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 p-5 space-y-3"
          >
            <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-7 w-36 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      <div className="h-72 rounded-2xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="h-10 w-full rounded-xl bg-slate-100 dark:bg-slate-800/60"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
