import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextType {
  showToast: (title: string, options?: { message?: string; variant?: ToastVariant; durationMs?: number }) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      title: string,
      options: { message?: string; variant?: ToastVariant; durationMs?: number } = {}
    ) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const variant = options.variant || 'success';
      const durationMs = options.durationMs ?? 4000;

      setToasts((prev) => [...prev.slice(-3), { id, title, message: options.message, variant }]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Accessible Global Toast Viewport */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="no-print fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto z-[70] flex flex-col gap-2.5 md:w-96 pointer-events-none"
      >
        {toasts.map((t) => {
          const isError = t.variant === 'error';
          const isInfo = t.variant === 'info';

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto rounded-2xl border p-3.5 shadow-xl backdrop-blur-md flex items-start gap-3 transition-all ${
                isError
                  ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800/70 text-rose-950 dark:text-rose-100'
                  : isInfo
                    ? 'bg-blue-50/95 dark:bg-slate-900/95 border-blue-200 dark:border-blue-800/60 text-slate-900 dark:text-slate-100'
                    : 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-700/50 text-slate-900 dark:text-slate-100'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isError ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                ) : isInfo ? (
                  <Info className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-snug">{t.title}</p>
                {t.message && (
                  <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{t.message}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="min-w-[32px] min-h-[32px] -mr-1 -mt-1 flex items-center justify-center rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
