import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext({ notify: () => {} });

// Lightweight replacement for window.alert: stacks messages in a live region and clears them on its own.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const notify = useCallback((message, tone = 'error') => {
    const id = nextId.current += 1;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[95] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map(({ id, message, tone }) => (
          <div key={id} role={tone === 'error' ? 'alert' : 'status'} className="page-enter pointer-events-auto flex items-start gap-3 rounded-xl border border-t-border-hi bg-t-surface-hi p-3.5 text-sm text-t-text shadow-card">
            {tone === 'error' ? <AlertCircle size={17} className="mt-0.5 shrink-0 text-t-danger" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-t-accent2" />}
            <span className="min-w-0 flex-1 break-words">{message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => dismiss(id)} className="shrink-0 rounded p-0.5 text-t-muted hover:text-t-text"><X size={15} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
