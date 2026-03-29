import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedContractorsContextValue {
  savedIds:   Record<string, string>;              // contractorProfileId → listId
  isSaved:    (contractorProfileId: string) => boolean;
  getListId:  (contractorProfileId: string) => string | undefined;
  toggle:     (contractorProfileId: string, listId?: string) => Promise<void>;
  totalSaved: number;
  isLoading:  boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const SavedContractorsContext = createContext<SavedContractorsContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function SavedContractorsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [savedIds, setSavedIds]   = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Track in-flight toggles to prevent double-clicks from creating race conditions
  const pendingRef = useRef<Set<string>>(new Set());

  const isInvestor = user?.role === 'INVESTOR';

  // ── Fetch saved IDs on login / role change ──────────────────────────────────
  useEffect(() => {
    if (!isInvestor) {
      setSavedIds({});
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api
      .get<{ success: boolean; data: { saved: Record<string, string> } }>('/saved/ids')
      .then((res) => {
        if (!cancelled) setSavedIds(res.data.data.saved ?? {});
      })
      .catch(() => {
        if (!cancelled) setSavedIds({});
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [isInvestor, user?.id]);

  // ── isSaved ─────────────────────────────────────────────────────────────────
  const isSaved = useCallback(
    (contractorProfileId: string): boolean => contractorProfileId in savedIds,
    [savedIds],
  );

  // ── getListId ────────────────────────────────────────────────────────────────
  const getListId = useCallback(
    (contractorProfileId: string): string | undefined => savedIds[contractorProfileId],
    [savedIds],
  );

  // ── toggle ───────────────────────────────────────────────────────────────────
  const toggle = useCallback(
    async (contractorProfileId: string, listId?: string): Promise<void> => {
      if (!isInvestor) return;

      // Prevent concurrent toggles on the same contractor
      if (pendingRef.current.has(contractorProfileId)) return;
      pendingRef.current.add(contractorProfileId);

      const wasSaved = contractorProfileId in savedIds;

      // Optimistic update
      setSavedIds((prev) => {
        const next = { ...prev };
        if (wasSaved) {
          delete next[contractorProfileId];
        } else {
          next[contractorProfileId] = 'pending';
        }
        return next;
      });

      try {
        const res = await api.post<{
          success: boolean;
          data: { saved: boolean; listId: string };
        }>('/saved/toggle', { contractorProfileId, listId });

        const { saved, listId: resolvedListId } = res.data.data;

        setSavedIds((prev) => {
          const next = { ...prev };
          if (saved) {
            next[contractorProfileId] = resolvedListId;
          } else {
            delete next[contractorProfileId];
          }
          return next;
        });
      } catch {
        // Revert optimistic update on error
        setSavedIds((prev) => {
          const next = { ...prev };
          if (wasSaved) {
            // Restore the original listId — we no longer have it, so re-fetch
            // For now, remove the key and let the next full fetch correct it
            delete next[contractorProfileId];
          } else {
            delete next[contractorProfileId];
          }
          return next;
        });
        toast('Could not update saved list. Please try again.', 'error');
      } finally {
        pendingRef.current.delete(contractorProfileId);
      }
    },
    [isInvestor, savedIds, toast],
  );

  return (
    <SavedContractorsContext.Provider
      value={{
        savedIds,
        isSaved,
        getListId,
        toggle,
        totalSaved: Object.keys(savedIds).length,
        isLoading,
      }}
    >
      {children}
    </SavedContractorsContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSavedContractors(): SavedContractorsContextValue {
  const ctx = useContext(SavedContractorsContext);
  if (!ctx) {
    throw new Error('useSavedContractors must be used inside SavedContractorsProvider');
  }
  return ctx;
}
