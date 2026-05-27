import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsApi, Budget } from '../lib/api'

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsApi.list().then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) =>
      budgetsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: budgetsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}
