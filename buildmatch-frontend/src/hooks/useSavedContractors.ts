import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// ── Re-export the bookmark icon hook from context ─────────────────────────────
export { useSavedContractors } from '../context/SavedContractorsContext';

// ── List queries ──────────────────────────────────────────────────────────────

export function useSavedLists() {
  return useQuery({
    queryKey: ['saved-lists'],
    queryFn:  () => api.get('/saved/lists').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useListContractors(listId: string | null) {
  return useQuery({
    queryKey: ['saved-list-contractors', listId],
    queryFn:  () => api.get(`/saved/lists/${listId}/contractors`).then((r) => r.data.data),
    enabled:  !!listId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── List mutations ────────────────────────────────────────────────────────────

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post('/saved/lists', { name }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-lists'] }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => api.delete(`/saved/lists/${listId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-lists'] }),
  });
}

export function useRenameList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      api.put(`/saved/lists/${listId}`, { name }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-lists'] }),
  });
}

export function useRemoveFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, savedId }: { listId: string; savedId: string }) =>
      api.delete(`/saved/lists/${listId}/contractors/${savedId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['saved-list-contractors', vars.listId] });
    },
  });
}
