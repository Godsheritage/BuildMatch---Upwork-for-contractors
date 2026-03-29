import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface ToastAction { label: string; onClick: () => void; }
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; action?: ToastAction; }
interface ToastContextValue {
  toast: (message: string, type?: 'success' | 'error' | 'info', action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    action?: ToastAction,
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => dismiss(id), action ? 6000 : 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', paddingRight: 12, borderRadius: 10, background: t.type === 'success' ? '#0F6E56' : t.type === 'error' ? '#DC2626' : '#1B3A5C', color: '#fff', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-family)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxWidth: 360, pointerEvents: 'auto', lineHeight: 1.4 }}>
            {t.type === 'success' ? <CheckCircle2 size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} /> : t.type === 'error' ? <XCircle size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} /> : null}
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button onClick={() => { t.action!.onClick(); dismiss(t.id); }} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 5, cursor: 'pointer', color: '#fff', padding: '3px 9px', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center' }} aria-label="Dismiss">
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
