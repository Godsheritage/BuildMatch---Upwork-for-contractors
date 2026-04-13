import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { BugReportModal } from '../components/bug-report/BugReportModal';

interface BugReportContextValue {
  open: () => void;
}

const Ctx = createContext<BugReportContextValue | null>(null);

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen && <BugReportModal onClose={close} />}
    </Ctx.Provider>
  );
}

export function useBugReport(): BugReportContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) return { open: () => console.warn('BugReportProvider not mounted') };
  return ctx;
}
