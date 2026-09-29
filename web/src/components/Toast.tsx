import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description?: string;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-success" />,
          warning: <AlertTriangle className="w-4 h-4 text-warning" />,
          error: <AlertCircle className="w-4 h-4 text-danger" />,
          info: <Info className="w-4 h-4 text-info" />,
        };

        const borderStyles = {
          success: 'border-success/30',
          warning: 'border-warning/30',
          error: 'border-danger/30',
          info: 'border-info/30',
        };

        return (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto p-3.5 bg-app-surface border radius-card elevation-sheet flex items-start gap-3 transition-all duration-200 animate-slideUp',
              borderStyles[t.type]
            )}
          >
            <div className="shrink-0 mt-0.5">{icons[t.type]}</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-app-text">{t.title}</h4>
              {t.description && (
                <p className="text-[11px] text-app-text-2 mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-app-text-3 hover:text-app-text shrink-0 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
