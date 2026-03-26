import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  toast: (message: string, type?: 'success' | 'error') => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Fixed toast container */}
      <div
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 16px',
              paddingRight: 12,
              borderRadius: 10,
              background: t.type === 'success' ? '#0F6E56' : '#DC2626',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font-family)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              maxWidth: 360,
              pointerEvents: 'auto',
              lineHeight: 1.4,
            }}
          >
            {t.type === 'success'
              ? <CheckCircle2 size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
              : <XCircle      size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
            }
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)', padding: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
